const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

// Generate 8-character order ID (same as user controller)
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

//orders with pagination
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 6; 
        const skip = (page - 1) * limit;

        // Add filter for return requests
        const returnFilter = req.query.filter === 'returns' ? {
            'items.returnStatus': { $in: ['Requested', 'Approved', 'Rejected'] }
        } : {};

        const totalOrders = await Order.countDocuments(returnFilter);
        const totalPages = Math.ceil(totalOrders / limit);
        let orders = await Order.find(returnFilter)
            .populate('userId', 'fullName email')
            .populate('items.product', 'productName images price')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        // Ensure all orders have order IDs
        for (let order of orders) {
            if (!order.orderId) {
                const orderId = await generateOrderId();
                order.orderId = orderId;
                await order.save();
            }
        }

        res.render('adminOrders', {
            orders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages,
            title: 'Order Management',
            currentFilter: req.query.filter || 'all'
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
        
        // Find order by orderId instead of _id
        const order = await Order.findOne({ orderId: orderId });
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({success: false,message: 'Invalid status'});
        }

        //  already delivered or cancelled --> no change
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({success: false,message: `Cannot change status of ${order.status.toLowerCase()} order`});
        }
 
        // Update the order status
        order.status = status;
        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Error updating order status' });
    }
};

// Get order details
const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Find order by orderId instead of _id
        const order = await Order.findOne({ orderId: orderId })
            .populate('userId', 'fullName email')
            .populate('items.product', 'productName images price');
       console.log("order",order)
        if (!order) {
            return res.status(404).send('Order not found');
        }
        res.render('orderDetails', {order,title: 'Order Details'});

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
            return res.status(404).json({success: false,message: 'Order is not found'});
        }
        
        if (order.status === 'Delivered') {
            return res.status(400).json({success: false,message: 'Cannot cancel a delivered order'});
        }

        order.status = 'Cancelled';
        if (order.paymentMethod === 'online' && order.paymentStatus === 'Completed') {
            order.paymentStatus = 'Refund Initiated';
        }
        
        await order.save();
        res.json({success: true,message: 'Order cancelled successfully'});
        
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({success: false,message: 'Failed to cancel order'});
    }
};

//update status
const updateStatus = async (req, res) => {
    try {
        const  { orderId, status } = req.body;
        
        const update = await Order.updateOne({ orderId: orderId }, { $set: { status: status } });
        if (update.modifiedCount > 0) {
         return res.status(200).json({ success: true, message: 'Order status updated successfully' });
        }
        else
        {
           return res.status(400).json({ success: false, message: 'Failed to update order status' });
        }
        
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// Handle return request
const handleReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, action, rejectionReason } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.returnStatus !== 'Requested') {
            return res.status(400).json({ success: false, message: 'Item is not in return requested state' });
        }

        if (action === 'approve') {
            item.returnStatus = 'Approved';
        } else if (action === 'reject') {
            if (!rejectionReason) {
                return res.status(400).json({ success: false, message: 'Rejection reason is required' });
            }
            item.returnStatus = 'Rejected';
            item.rejectionReason = rejectionReason;
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        order.markModified('items');
        await order.save();

        res.json({ success: true, message: `Return request ${action}d successfully` });
    } catch (error) {
        console.error('Error handling return request:', error);
        res.status(500).json({ success: false, message: 'Error handling return request' });
    }
};

module.exports = {
    getOrders,
    updateOrderStatus,
    getOrderDetails,
    cancelOrder,
    updateStatus,
    handleReturnRequest
};