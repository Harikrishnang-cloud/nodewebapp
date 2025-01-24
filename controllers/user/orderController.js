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
            status: paymentMethod === 'cod' ? 'Pending' : 'Processing',
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
            paymentStatus: paymentMethod === 'wallet' ? 'Completed' : 
                          paymentMethod === 'cod' ? 'Pending' : 'Processing'
        });

        try {
            await newOrder.save();
            
            // Only update product quantities and clear cart if payment is successful or COD
            if (paymentMethod === 'cod' || paymentMethod === 'wallet' || 
               (paymentMethod === 'online' )) {
                
                // Update product quantities
                for (const item of orderItems) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.Quantity -= item.quantity;
                        await product.save();
                    }
                }

                // Clear the user's cart
                await Cart.findOneAndUpdate(
                    { userId: userId },
                    { $set: { books: [] } }
                );
            }

            // Handle online payment failure scenario
            // if (paymentMethod === 'online' && newOrder.paymentStatus === 'Processing') {
            //     setTimeout(async () => {
            //         const order = await Order.findById(newOrder._id);
            //         if (order && order.paymentStatus === 'Processing') {
            //             order.paymentStatus = 'Failed';
            //             order.status = 'Payment Failed';
            //             await order.save();
            //         }
            //     }, 300000); // Check after 5 minutes
            // }
    
            res.status(200).json({
                success: true,
                orderId: newOrder._id,
                paymentMethod: paymentMethod,
                paymentStatus: newOrder.paymentStatus
            });

        } catch (error) {
            // If there's an error saving the order or updating products
            console.error('Error processing order:', error);
            if (newOrder._id) {
                // If order was created but subsequent operations failed
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
        res.status(500).json({ 
            success: false,
            message: 'Failed to place order. Please try again later.'
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

        // Calculate refund amount (total amount including shipping)
        const refundAmount = order.totalAmount;

        // Update order status to cancelled
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
            wallet.balance += refundAmount;
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

        res.json({
            success: true,
            message: 'Order cancelled successfully. Refund has been credited to your wallet.'
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
};

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('userId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
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
        doc.moveDown();
        // Total
        doc.fontSize(14).text(`Total Amount: ₹${totalAmount + 40}`, { underline: true });
        
        // Payment details
        doc.moveDown();
        doc.fontSize(12).text(`Payment Method: ${order.paymentMethod}`);
        doc.text(`Payment Status: ${order.paymentStatus}`);

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Error generating invoice' });
    }
};

module.exports = {
    getPlaceOrderPage,
    placeOrder,
    getOrderConfirmation,
    getOrders,
    cancelOrder,
    generateInvoice
};
