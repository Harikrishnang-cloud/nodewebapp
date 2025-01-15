const Razorpay = require('razorpay');
const crypto = require('crypto');
// const Order = require('../../models/orderModel');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
});


const createOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        console.log('Creating Razorpay order:', { amount });

        const options = {
            amount: amount * 100, // amount in paise
            currency: 'INR',
        };

        const order = await razorpay.orders.create(options);
        console.log('Razorpay order created:', order);

        res.json({
            success: true,
            order,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create Razorpay order'
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        console.log('Verifying payment:', {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        });

        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
            .update(sign)
            .digest('hex');

        if (razorpay_signature === expectedSign) {
            console.log('Payment signature verified');
            
            // Update order status in database
            // await Order.findByIdAndUpdate(orderId, {
            //     paymentStatus: 'completed',
            //     paymentId: razorpay_payment_id,
            //     razorpayOrderId: razorpay_order_id
            // });

            console.log('Order updated successfully');

            return res.json({
                success: true,
                message: 'Payment verified successfully'
            });
        } else {
            console.log('Payment signature verification failed');
            
            // Payment verification failed, update order status
            // await Order.findByIdAndUpdate(orderId, {
            //     paymentStatus: 'failed'
            // });

            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment'
        });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
};