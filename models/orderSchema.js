const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: {
            type: String,
            required: true
        },
        productDescription: {
            type: String,
            required: true
        },
        productImage: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    deliveryFee: {
        type: Number,
        default: 40
    },
    discount: {
        type: Number,
        default: 0
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    estimatedDeliveryDate: {
        type: Date,
        default: function() {
            const date = new Date();
            date.setDate(date.getDate() + 5);
            return date;
        }
    },
    trackingHistory: [{
        status: {
            type: String,
            enum: ['Order Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
            required: true
        },
        location: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        description: String
    }],
    address: {
        fullName: {
            type: String,
            required: true
        },
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true,
            default: 'India'
        },
        pinCode: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'wallet'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'PaymentFailed', 'RefundInitiated', 'Refunded', 'Processing'],
        default: 'Pending'
    }
}, {
    timestamps: true
});

// Add indexes for better query performance
orderSchema.index({ userId: 1, orderDate: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);