const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

// Get all orders with pagination
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find()
            .populate('userId', 'name email')
            .populate('items.product', 'name images price')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); 

        res.render('adminOrders', {
            orders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages,
            title: 'Order Management'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Update order status
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Validate status transition
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Prevent status change if order is already delivered or cancelled
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: `Cannot change status of ${order.status.toLowerCase()} order`
            });
        }

        // Update order status
        order.status = status;
        await order.save();

        res.json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
};

// Get order details
const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('userId', 'name email')
            .populate('items.product', 'name images price');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        res.render('admin/orderDetails', {
            order,
            title: 'Order Details',
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Cancel order
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status === 'Delivered') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel delivered order'
            });
        }

        order.status = 'Cancelled';
        if (order.paymentMethod === 'online' && order.paymentStatus === 'Completed') {
            order.paymentStatus = 'Refund Initiated';
        }
        
        await order.save();

        res.json({
            success: true,
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
};

module.exports = {
    getOrders,
    updateOrderStatus,
    getOrderDetails,
    cancelOrder
};