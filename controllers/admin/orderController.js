const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

//orders with pagination
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

        res.render('adminOrders', {orders,
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

// status update cheyyan
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({success: false,message: 'Order is not found'});
        }

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({success: false,message: 'Invalid status'});
        }

        //  already delivered or cancelled --> no change
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: `Cannot change status of ${order.status.toLowerCase()} order`
            });
        }

        // update aayath db ill save cheyyanam
        order.status = status;
        await order.save();

        res.json({success: true,message: 'Order status updated successfully'});

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

        res.render('orderDetails', {
            order,
            title: 'Order Details',
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
                message: 'Order is not found'
            });
        }
        
        if (order.status === 'Delivered') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a delivered order'
            });
        }

        order.status = 'Cancelled';
        if (order.paymentMethod === 'online' && order.paymentStatus === 'Completed') {
            order.paymentStatus = 'Refund Initiated';
        }
        
        await order.save();
        
        res.json({success: true,message: 'Order cancelled successfully'});
        
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
};


const updateStatus = async (req, res) => {
    try {
        const  { orderId, status } = req.body;
        console.log("orderId, status",orderId, status);
        
        const update = await Order.updateOne({ _id: orderId }, { $set: { status: status } });
        if (update.modifiedCount > 0) {
         return   res.status(200).json({ success: true, message: 'Order status updated successfully' });
        }else{
           return res.status(400).json({ success: false, message: 'Failed to update order status' });
        }
        
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    getOrders,
    updateOrderStatus,
    getOrderDetails,
    cancelOrder,
    updateStatus
};