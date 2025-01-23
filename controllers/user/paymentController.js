const Razorpay = require("razorpay");
const Order = require("../../models/orderSchema");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const createOrder = async (req, res) => {
  try {
    const orderData = await Order.findById(req.body.orderId);
    const amount = orderData.totalAmount;
    const options = {
      amount: amount * 100, // amount in paise
      currency: "INR",
    };
    const order = await razorpay.orders.create(options);
    console.log("Razorpay order created:", order);

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error)

    res.status(500).json({success: false,error: "Failed to create Razorpay order"});
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature,orderId} = req.body;

    // Check if all required parameters are present
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      console.error("Missing required payment parameters");
      
      // Update order status to payment failed
      await Order.findByIdAndUpdate(orderId, {paymentStatus: 'PaymentFailed',status: 'Pending'});

      return res.status(400).json({success: false,message: "Missing payment parameters",error: "Payment verification failed"});
    }

    console.log("Verifying payment:", {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    });

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
      .update(sign)
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      console.log("Payment signature verified");

      // Update order status in database
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'Completed',
        status: 'Processing',
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id
      });

      console.log("Order updated successfully");

      return res.json({success: true,message: "Payment verified successfully"})

    } else {
      console.log("Payment signature verification failed");

      // Payment verification failed, update order status
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'PaymentFailed',
        status: 'Pending'
      });

      return res.status(400).json({
        success: false,
        error: "Invalid payment signature",
        message: "Payment verification failed"
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    
    // Update order status to payment failed in case of any error
    if (req.body.orderId) {
      try {
        await Order.findByIdAndUpdate(req.body.orderId, {
          paymentStatus: 'PaymentFailed',
          status: 'Pending'
        });
      } catch (updateError) {
        console.error("Error updating order status:", updateError);
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      message: "An error occurred during payment verification"
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
};
