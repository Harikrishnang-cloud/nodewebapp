const Coupon = require('../../models/couponSchema');
const cart = require('../../models/cartSchema')

// Get available coupons
const getAvailableCoupons = async (req, res) => {
    try {
        const totalAmount = req.query.amount;

        const currentDate = new Date();
        // Find active coupons that haven't expired
        const coupons = await Coupon.find({status: true,expiryDate: { $gt: currentDate },minimumPurchase:{$lt:totalAmount}})
        
        console.log("coupons VANNU",coupons);

        res.status(200).json({success: true,coupons: coupons});

    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({success: false,message: 'Failed to fetch coupons'});
    }
};

// Apply coupon
const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user._id;
        console.log("coupon code:",couponCode)
        console.log("userName,id:",userId)

        // Find the coupon
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            status: true,
            expiryDate: { $gt: new Date() }
        });
        console.log("coupon name:",coupon)

        if(!coupon){
            return res.status(400).json({success: false,message:'Coupon not found'})
        }

        // Check if coupon usage limit is reached
        if (coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({success: false,message: 'Coupon usage limit reached'});
        }
        // console.log("coupon details",coupon)
        
        if(coupon.minimumPurchase > req.body.total){
            return res.status(400).json({success: false,message: 'Minimum purchase amount not met'});
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            //percentage aanengil -->
            discount = (req.body.total * coupon.discountAmount) / 100;
        } else {
            //flat-amount aanengil -->
            discount = coupon.discountAmount;
        }
        res.json({success: true,discount: discount,message: 'Coupon applied successfully'});

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({success: false,message: 'Failed to apply coupon'});
    }
};

module.exports = {
    getAvailableCoupons,
    applyCoupon
};
