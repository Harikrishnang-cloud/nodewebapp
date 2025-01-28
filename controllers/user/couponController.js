const Coupon = require('../../models/couponSchema');

// Get available coupons
const getAvailableCoupons = async (req, res) => {
    try {
        const currentDate = new Date();
        // Find active coupons that haven't expired
        const coupons = await Coupon.find({status: true,expiryDate: { $gt: currentDate }})
        
        console.log("coupons VANNU",coupons);

        res.json({success: true,coupons: coupons});

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

        // Find the coupon
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            status: true,
            expiryDate: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({success: false,message: 'Invalid or expired coupon code'});
        }

        // Check if coupon usage limit is reached
        if (coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({success: false,message: 'Coupon usage limit reached'});
        }
        
        if(coupon.minimumPurchase > req.body.total){
            return res.status(400).json({success: false,message: 'Minimum purchase amount not met'});
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = (req.body.total * coupon.discountAmount) / 100;
        } else {
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
