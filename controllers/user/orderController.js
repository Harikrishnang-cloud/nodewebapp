const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema'); 
const Wallet = require('../../models/walletSchema');
const PDFDocument = require('pdfkit');

const getPlaceOrderPage = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login'); 
        }

        const cart = await Cart.findOne({ userId: req.session.user._id }).populate('books.product');
        const cartItems = cart ? cart.books : []
        const user = await User.findById(req.session.user._id);
        const wallet = await Wallet.findOne({ userId: req.session.user._id });
        
        if (!user) {
            return res.redirect('/login'); 
        }

        console.log("User data:", user); 
        
        res.render('placeOrder', { 
            products: cartItems.map(item => ({...item.product.toObject(),quantity: item.quantity})),
            user:user,
            wallet: wallet || { balance: 0 },
            title: 'Place Order',
            couponDiscount: 0  
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
        let totalAmount = 50; // Base delivery fee (40) + packaging fee (10)
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

            //if product is in stock
            if(product.Quantity < item.quantity){
                return res.status(400).json({success:false, message:"Product out of stock"})
            }

            totalAmount += (product.salePrice * item.quantity);
        }

        // 1000 nu mukalil aanengil COD not allowed
        if (paymentMethod === 'cod' && totalAmount > 1000) {
            return res.status(400).json({success: false,
                message: 'COD is not available for orders above ₹1000. Please choose online payment or wallet.'});
        }

        console.log("before coupon", totalDiscount)
        // If a coupon is applied, calculate additional discount
        if (req.body.couponCode) {
            const coupon = await Coupon.findOne({ code: req.body.couponCode });
            if (coupon && coupon.isActive) {
                const couponDiscount = (totalAmount * coupon.discountPercentage) / 100;
                totalDiscount = totalDiscount + couponDiscount;
                totalAmount = totalAmount - couponDiscount;
            }
        }


        // Handle wallet payment
        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ userId: userId });
            if (!wallet || wallet.balance < totalAmount) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Insufficient wallet balance' ,
                    requiredAmount:totalAmount
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
            status: paymentMethod === 'cod' ? 'Pending' : 'Processing',
            deliveryFee: 40,
            packagingFee: 10,
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
            paymentStatus: paymentMethod === 'wallet' ? 'Completed' : 
                          paymentMethod === 'cod' ? 'Pending' : 'Processing'
        });

        try {
            if (paymentMethod === 'cod' || paymentMethod === 'wallet' || 
                (paymentMethod === 'online' )) {
                    
                    const checkQuantityPromises = orderItems.map(async (item) => {
                        const product = await Product.findById(item.product);
                        console.log("Product quantity check:", product.Quantity, item.quantity);
                        return (product.Quantity - item.quantity) < 0;
                    });
                    
                    const quantityChecks = await Promise.all(checkQuantityPromises);
                    const invalidQuantity = quantityChecks.some(isInvalid => isInvalid);
                    
                    console.log("Invalid quantity check result:", invalidQuantity);
                    
                    if(invalidQuantity){
                        return res.status(400).json({success:false, message:"Product out of stock"})
                    }
                    await newOrder.save();
                // Update product quantities
                for (const item of orderItems) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.Quantity = product.Quantity - item.quantity;
                        await product.save();
                    }       
                }

                // Clear the user's cart
                await Cart.findOneAndUpdate({ userId: userId },{ $set: { books: [] } });
            }

            res.status(200).json({
                success: true,
                orderId: newOrder._id,
                paymentMethod: paymentMethod,
                paymentStatus: newOrder.paymentStatus,
                amount:totalAmount
            });

        } catch (error) {

            console.error('Error processing order:', error);
            if (newOrder._id) {
                await Order.findByIdAndUpdate(newOrder._id, {
                    status: 'Error',
                    paymentStatus: 'Failed'
                });
            }
            res.status(500).json({ 
                success: false,
                message: 'Failed to process order. Please try again.'
            });
        }
    } catch (error) {
        console.error('Error placing order:', error);
        return res.redirect('/pageNotFound');
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
        res.redirect('/pageNotFound');
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

        if (!orders) {
            return res.redirect('/pageNotFound');
        }

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
        res.redirect('/pageNotFound');
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        const order = await Order.findOne({ _id: orderId, userId: userId });
        
        if (!order) {
            return res.redirect('/pageNotFound');
        }

        if (order.status === 'Shipped' || order.status === 'Delivered') {
            return res.status(400).json({success: false,message: 'Cannot cancel order that has been shipped or delivered'});
        }

        //refund amount 
        const refundAmount = order.totalAmount;

        // Return products 
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                product.Quantity = product.Quantity + item.quantity;
                await product.save();
            }
        }

        order.status = 'Cancelled';
        await order.save();

        // Handle refund based on payment method
        if (order.paymentMethod === 'online' || order.paymentMethod === 'wallet') {
            // Find or create wallet
            let wallet = await Wallet.findOne({ userId: userId });
            if (!wallet) {
                wallet = new Wallet({
                    userId: userId,
                    balance: 0,
                    transactions: []
                });
            }

            // Add refund to wallet
            wallet.balance = wallet.balance + refundAmount;
            wallet.transactions.push({
                type: 'credit',
                amount: refundAmount,
                description: `Refund for cancelled order #${order._id}`,
                timestamp: new Date()
            });

            await wallet.save();

            // Update order payment status
            order.paymentStatus = 'Refunded';
            await order.save();
        }
            res.json({success: true,message: 'Order cancelled successfully. Refund has been credited to your wallet.'});
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.redirect('/pageNotFound');
    }
};

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('userId');

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        // Create PDF document
        const doc = new PDFDocument();
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(24).text('BookLove Online Book sellers', { align: 'center' });
        doc.fontSize(15).text('Email:booklove@gmail.com',{align:'center'});
        doc.fontSize(15).text('place:Thiruvananthapuram, pin:691334',{align:'center'});
        doc.fontSize(15).text('phone:7907389098',{align:'center'});
        doc.fontSize(20).text('Invoice', { align: 'center', underline: true });
        doc.moveDown();
        
        

        // Customer details
        doc.fontSize(12).text(`Customer Name: ${order.userId.fullName}, ${order.userId.phone}`);
        doc.text(`Email: ${order.userId.email}`);
        doc.moveDown();

        // Shipping address
        doc.fontSize(12).text('Shipping Address:');
        doc.text(`${order.address.fullName}`);
        doc.text(`${order.address.street}`);
        doc.text(`${order.address.city}, ${order.address.state} ${order.address.pinCode}`);
        doc.moveDown();

        // Order details
        doc.fontSize(12).text(`Order ID: ${orderId}`);
        doc.text(`Date: ${order.orderDate.toLocaleDateString()}`);
        doc.moveDown();

        // Items table
        doc.text('Order Items:', { underline: true });
        doc.moveDown();

        let totalAmount = 0;
        order.items.forEach((item) => {
            doc.text(`${item.product.productName}`);
            doc.text(`Quantity: ${item.quantity} x ₹${item.price} = ₹${item.quantity * item.price}`);
            doc.moveDown(0.5);
            totalAmount += (item.quantity * item.price);
        });
        doc.text("(Shipping Fee: ₹40)");
        doc.text("(Packaging Fee: ₹10)");
        doc.moveDown();
        // Total
        doc.fontSize(14).text(`Total Amount: ₹${totalAmount + 50}`, { underline: true });
        
        // Payment details
        doc.moveDown();
        doc.fontSize(12).text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Payment Status: ${order.paymentStatus}`);

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.redirect('/pageNotFound');
    }
};

// Track order page
const trackOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('items.product');

        if (!order) {
            return res.status(404).render('404');
        }

        // Check if the order belongs to the logged-in user
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.status(403).render('403');
        }

        res.render('orderTracking', {
            order,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).render('500');
    }
};

// Get order status API
const getOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .select('status trackingHistory estimatedDeliveryDate');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        res.json({
            success: true,
            status: order.status,
            trackingHistory: order.trackingHistory,
            estimatedDelivery: order.estimatedDeliveryDate
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching order status' 
        });
    }
};

// Update tracking status (internal function)
const updateOrderStatus = async (orderId, status, location = '', description = '') => {
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        // Update main status
        order.status = status;

        // Add to tracking history
        order.trackingHistory.push({
            status,
            location,
            description,
            timestamp: new Date()
        });

        await order.save();
        return true;
    } catch (error) {
        console.error('Error updating order status:', error);
        return false;
    }
};

module.exports = {
    getPlaceOrderPage,
    placeOrder,
    getOrderConfirmation,
    getOrders,
    cancelOrder,
    generateInvoice,
    trackOrder,
    updateOrderStatus,
    getOrderStatus
};
