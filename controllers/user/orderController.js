const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema'); 
const Wallet = require('../../models/walletSchema');

const getPlaceOrderPage = async (req, res) => {
    try {

        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login'); 
        }

        const cart = await Cart.findOne({ userId: req.session.user._id }).populate('books.product');
        const cartItems = cart ? cart.books : [];
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.redirect('/login'); 
        }

        console.log("User data:", user); 
        
        res.render('placeOrder', { 
            products: cartItems.map(item => ({
                ...item.product.toObject(),
                quantity: item.quantity
            })),
            user:user,
            title: 'Place Order',
            couponDiscount: 0  // Initialize coupon discount as 0
        });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Internal Server Error');
    }
};

const placeOrder = async (req, res) => {
    try {
        const { items, addressIndex, paymentMethod } = req.body;
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user || !user.address || !user.address[addressIndex]) {
            return res.status(400).json({ message: 'Invalid address selected' });
        }

        const selectedAddress = user.address[addressIndex];
        
        // Fetch product details and calculate total
        let totalAmount = 40; // Base delivery fee
        const orderItems = [];
        let totalDiscount = 0;

        for (const item of JSON.parse(items)) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Calculate discount for this item
            const itemDiscount = (product.regularPrice - product.salePrice) * item.quantity;
            totalDiscount += itemDiscount;

            orderItems.push({
                product: item.productId,
                productName: product.productName,
                productDescription: product.description,
                productImage: product.productImage[0],
                quantity: item.quantity,
                price: product.salePrice,
                originalPrice: product.price,
                itemDiscount: itemDiscount
            });

            totalAmount += (product.salePrice * item.quantity);
        }
        console.log("before coupon", totalDiscount)
        // If a coupon is applied, calculate additional discount
        if (req.body.couponCode) {
            const coupon = await Coupon.findOne({ code: req.body.couponCode });
            if (coupon && coupon.isActive) {
                const couponDiscount = (totalAmount * coupon.discountPercentage) / 100;
                totalDiscount += couponDiscount;
                totalAmount -= couponDiscount;
            }
        }

        // // Calculate savings (total discount)
        // const savings = totalDiscount;

        // Handle wallet payment
        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ userId: userId });
            if (!wallet || wallet.balance < totalAmount) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Insufficient wallet balance' 
                });
            }

            // Deduct amount from wallet
            await Wallet.findOneAndUpdate(
                { userId: userId },
                {
                    $inc: { balance: -totalAmount },
                    $push: {
                        transactions: {
                            type: 'debit',
                            amount: totalAmount,
                            description: `Payment for order`,
                        }
                    }
                }
            );
        }
        console.log("discount",totalDiscount)
        // Create new order with mapped address fields
        const newOrder = new Order({
            userId: userId,
            items: orderItems,
            totalAmount: totalAmount,
            discount: totalDiscount,
            status: 'Pending',
            deliveryFee: 40,
            orderDate: new Date(),
            address: {
                fullName: selectedAddress.fullName,
                phone: selectedAddress.phone,
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                country: selectedAddress.country || 'India',
                pinCode: selectedAddress.pinCode 
            },
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'wallet' ? 'Completed' : (paymentMethod === 'cod' ? 'Pending' : 'Processing')
        });
   
        await newOrder.save();
        
        // Clear the user's cart after successful order
        await Cart.findOneAndUpdate(
            { userId: userId },
            { $set: { books: [] } }
        );
  
        res.status(200).json({
            success: true,
            orderId: newOrder._id,
            paymentMethod: paymentMethod
        });

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to place order'
        });
    }
};

const getOrderConfirmation = async (req, res) => {
    try {
        console.log("order confirm controller hit")
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate('userId', 'name email');

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        res.render('orderConfirm', {
            title: 'Order Confirmation',
            order: order
        });
    } catch (error) {
        console.error('Error fetching order confirmation:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ userId: userId })
            .populate('items.product', 'productName productImage salePrice')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        res.render('orders', {
            title: 'My Orders',
            orders: orders,
            user: req.session.user,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        const order = await Order.findOne({ _id: orderId, userId: userId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status === 'Shipped' || order.status === 'Delivered') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel order that has been shipped or delivered'
            });
        }

        // Update order status to cancelled
        order.status = 'Cancelled';
        await order.save();

        // If payment was made, initiate refund process here
        if (order.paymentMethod === 'online' && order.paymentStatus === 'Completed') {
            // Implement refund logic here
            order.paymentStatus = 'Refund Initiated';
            await order.save();
        }

        res.json({success: true,message: 'Order cancelled successfully'});
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({success: false,message: 'Failed to cancel order'});
    }
};


module.exports = {
    getPlaceOrderPage,
    placeOrder,
    getOrderConfirmation,
    getOrders,
    cancelOrder,
   
};
