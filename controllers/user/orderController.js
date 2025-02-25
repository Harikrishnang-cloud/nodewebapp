const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema'); 
const Wallet = require('../../models/walletSchema');
const PDFDocument = require('pdfkit');
const Coupon = require('../../models/couponSchema');

// Generate 8-character order ID
const generateOrderId = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let orderId;
    let isUnique = false;
    
    while (!isUnique) {
        orderId = 'BL';
        
        for (let i = 0; i < 6; i++) {
            orderId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        // Check if this ID already exists
        const existingOrder = await Order.findOne({ orderId });
        if (!existingOrder) {
            isUnique = true;
        }
    }
    return orderId;
};

// Place order page
const getPlaceOrderPage = async (req, res) => {
    try {
        //not user 
        if (!req.session.user || !req.session.user._id) {
            return res.redirect('/login'); 
        }

        const cart = await Cart.findOne({ userId: req.session.user._id }).populate('books.product');
        console.log("cartlength",cart.books.length)
        if(cart.books.length===0){
            return res.redirect('/shop');
        }
        const cartItems = cart ? cart.books : []
        const user = await User.findById(req.session.user._id);
        const wallet = await Wallet.findOne({ userId: req.session.user._id });
        
        if (!user) {
            return res.redirect('/login'); 
        }

        console.log("UserData:", user); 
        
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
        const { items, addressIndex, paymentMethod, couponCode } = req.body;
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user || !user.address || !user.address[addressIndex]) {
            return res.status(400).json({ message: 'Invalid address selected' });
        }

        // Generate unique order ID
        const orderId = await generateOrderId();

        //select cheytha address fetch cheyyunnu
        const selectedAddress = user.address[addressIndex];

        // Fetch cart for validation
        const cart = await Cart.findOne({ userId: userId }).populate('books.product');

        // Fetch product details and calculate total
        let totalAmount = 50; // Base delivery fee (40) + packaging fee (10)
        const orderItems = [];
        let totalDiscount = 0;

        for (const item of JSON.parse(items)) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Calculate product discount
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
                message: 'COD is not available for orders above ₹1000. Please choose online payment or wallet.'
            });
        }

        console.log("before coupon", totalDiscount)
        // If a coupon is applied, calculate additional discount
        let couponDiscount = 0;
        if (req.body.couponCode) {
            const coupon = await Coupon.findOne({ code: req.body.couponCode });
            console.log("coupon code:", coupon)
            if (coupon && coupon.status) {
                couponDiscount = (totalAmount * coupon.discountAmount) / 100;
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
            orderId: orderId,
            userId: userId,
            items: orderItems,
            totalAmount: totalAmount,
            discount: couponDiscount,
            couponDiscount: couponDiscount,  // Store the coupon discount amount
            couponCode: req.body.couponCode,  // Store the coupon code used
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

                // Clear the user's cart, after placing an order
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

        // Get orders and ensure they all have order IDs
        let orders = await Order.find({ userId: userId })
            .populate('items.product')  // Populate product information
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        // Process orders to ensure return eligibility is properly set
        for (let order of orders) {
            if (!order.orderId) {
                const orderId = await generateOrderId();
                order.orderId = orderId;
                await order.save();
            }

            // If order is delivered but items don't have return status set
            if (order.status === 'Delivered') {
                let needsSave = false;
                
                // Set delivery date if not set
                if (!order.deliveryDate) {
                    order.deliveryDate = new Date();
                    needsSave = true;
                }

                // Set return eligibility for items
                if (!order.returnEligibleUntil) {
                    const returnEligibleDays = 7;
                    order.returnEligibleUntil = new Date(order.deliveryDate.getTime() + (returnEligibleDays * 24 * 60 * 60 * 1000));
                    needsSave = true;
                }

                // Check each item's return status
                order.items.forEach(item => {
                    // If order has a coupon, items are not returnable
                    if (order.couponCode) {
                        item.returnStatus = 'Not Eligible';
                        item.returnMessage = 'Returns not available for items purchased with coupon';
                    }
                    // Otherwise check normal eligibility
                    else { 
                        item.returnStatus = item.returnStatus ==='Not Eligible' ? 'Eligible' : item.returnStatus;
                    }
                });

                if (needsSave) {
                    order.markModified('items');
                    await order.save();
                }
            }
        }

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

        res.json({
            success: true,
            message: `Order cancelled successfully. ${order.paymentMethod === 'online' || order.paymentMethod === 'wallet' ? 'Refund of ₹' + refundAmount.toFixed(2) + ' has been credited to your wallet.' : ''}`
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while cancelling the order'
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
        doc.fontSize(12).text(`Order ID: ${order.orderId}`);
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

        // Add shipping and packaging fees
        const shippingFee = 40;
        const packagingFee = 10;
        doc.text(`Shipping Fee: ₹${shippingFee}`);
        doc.text(`Packaging Fee: ₹${packagingFee}`);
        
        // Subtotal before discount
        const subtotal = totalAmount + shippingFee + packagingFee;
        doc.text(`Subtotal: ₹${subtotal}`);

        // Apply discount only if coupon is used
        const discount = order.discount || 0;
        if(discount > 0){
            doc.text(`Coupon Discount: -₹${discount}`);
            totalAmount = subtotal - discount;
        } 
        
        doc.moveDown();
        // Total
        doc.fontSize(14).text(`Total Amount: ₹${totalAmount}`, { underline: true });
        
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
            return res.status(404).render('404');//Not-Found
        }

        // order belongs to the logged-in user
        if (order.userId.toString() !== req.session.user._id.toString()) {
            return res.status(403).render('403');//Forbidden
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

// Get order status 
const getOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .select('status trackingHistory estimatedDeliveryDate');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found'});
        }

        res.json({
            success: true,
            status: order.status,
            trackingHistory: order.trackingHistory,
            estimatedDelivery: order.estimatedDeliveryDate
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ success: false, message: 'Error fetching order status' });
    }
};

// Request return for an item
const requestReturn = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user._id;
        
        console.log('Return Request Data:', { orderId, itemId, reason, userId });

        const order = await Order.findOne({ _id: orderId, userId });
        console.log('Found Order:', order ? 'Yes' : 'No', order?._id);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if order is delivered
        console.log('Order Status:', order.status);
        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        // Find the specific item in the order
        const item = order.items.find(item => item._id.toString() === itemId);
        console.log('Found Item:', item ? 'Yes' : 'No', item?._id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }

        // Check if return is eligible
        const deliveryDate = order.deliveryDate;
        const returnEligibleDays = 7; // 7 days return policy
        const returnEligibleUntil = new Date(deliveryDate.getTime() + (returnEligibleDays * 24 * 60 * 60 * 1000));
        const currentDate = new Date();
        
        console.log('Return Eligibility:', {
            deliveryDate,
            returnEligibleUntil,
            currentDate,
            isEligible: currentDate <= returnEligibleUntil
        });

        if (!deliveryDate || currentDate > returnEligibleUntil) {
            return res.status(400).json({ success: false, 
                message: 'Return period has expired. Items can only be returned within 7 days of delivery' });
        }

        console.log('Item Return Status:', item.returnStatus);
        if (item.returnStatus !== 'Eligible') {
            return res.status(400).json({ success: false, message: 'This item is not eligible for return' });
        }

        // Calculate refund amount considering coupon discount if applicable
        let refundAmount = item.price * item.quantity;
        if (order.couponCode && order.couponDiscount) {
            const totalOrderValue = order.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            const discountPercentage = order.couponDiscount / totalOrderValue;
            refundAmount = refundAmount - (refundAmount * discountPercentage);
        }
        
        console.log('Refund Calculation:', {
            originalPrice: item.price,
            quantity: item.quantity,
            couponDiscount: order.couponDiscount,
            finalRefundAmount: refundAmount
        });

        // Update item return status and refund info
        item.returnStatus = 'Requested';
        item.returnRequestDate = new Date();
        item.returnReason = reason;
        item.refundInfo = {
            amount: refundAmount,
            method: 'wallet', // Default to wallet refund
            message: 'Return request initiated',
            timestamp: new Date()
        };

        // Mark the changes as modified so mongoose knows to save them
        order.markModified('items');
        await order.save();
        console.log('Order saved successfully');

        res.status(200).json({ 
            success: true, 
            message: 'Return request submitted successfully',
            refundAmount: refundAmount,
            refundMethod: 'wallet'
        });

    } catch (error) {
        console.error('Error in requestReturn:', error);
        res.status(500).json({ success: false, message: 'Failed to submit return request', error: error.message });
    }
};

// Mark item as eligible for return when order is delivered
const markItemsEligibleForReturn = async (orderId) => {
    try {
        console.log('Marking items eligible for return for order:', orderId);
        
        const order = await Order.findById(orderId).populate('items.product');
        if (!order) {
            console.log('Order not found for eligibility marking');
            return;
        }

        // Set delivery date and return eligibility
        order.deliveryDate = new Date();
        const returnEligibleDays = 7;
        order.returnEligibleUntil = new Date(order.deliveryDate.getTime() + (returnEligibleDays * 24 * 60 * 60 * 1000));

        console.log('Processing return eligibility for items:', order.items.length);
        
        // All items are eligible for return within the return period
        for (const item of order.items) {
            console.log('Checking item:', item._id, 'Product:', item.product?._id);
            
            if (item.product && !item.product.nonReturnable) {
                item.returnStatus = 'Eligible';
                item.returnMessage = 'Eligible for return within 7 days of delivery';
                console.log('Item marked as eligible');
            } else {
                item.returnStatus = 'Not Eligible';
                item.returnMessage = item.product ? 'This item is not eligible for return' : 'Product information not found';
                console.log('Item marked as not eligible');
            }
        }

        order.markModified('items');
        await order.save();
        console.log('Successfully saved return eligibility status');
        
    } catch (error) {
        console.error('Error marking items for return eligibility:', error);
    }
};

const updateOrderStatus = async (orderId, status, location = '', description = '') => {
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        const previousStatus = order.status;
        order.status = status;
        
        // Add to tracking history
        order.trackingHistory.push({
            status,
            location,
            description,
            timestamp: new Date()
        });

        // If order is delivered, mark items as eligible for return
        if (status === 'Delivered' && previousStatus !== 'Delivered') {
            await markItemsEligibleForReturn(orderId);
        }

        // If order status changes from Delivered, make items not eligible for return
        if (previousStatus === 'Delivered' && status !== 'Delivered') {
            order.items.forEach(item => {
                if (item.returnStatus === 'Eligible') {
                    item.returnStatus = 'Not Eligible';
                }
            });
            order.markModified('items');
        }

        await order.save();
        return true;
    } catch (error) {
        console.error('Error updating order status:', error);
        return false;
    }
};

// Migrate existing orders to new order ID format
const migrateExistingOrders = async () => {
    try {
        // Get all orders that don't have an orderId
        const orders = await Order.find({ orderId: { $exists: false } });
        
        for (const order of orders) {
            // Generate new order ID
            const orderId = await generateOrderId();
            
            // Update the order with new ID
            await Order.findByIdAndUpdate(order._id, { orderId: orderId });
        }
        
        console.log(`Successfully migrated ${orders.length} orders to new ID format`);
    } catch (error) {
        console.error('Error migrating orders:', error);
    }
};

// Run migration when server starts
migrateExistingOrders();

module.exports = {
    getPlaceOrderPage,
    placeOrder,
    getOrderConfirmation,
    getOrders,
    cancelOrder,
    generateInvoice,
    trackOrder,
    getOrderStatus,
    updateOrderStatus,
    requestReturn,
    markItemsEligibleForReturn
};
