const Coupon = require('../../models/couponSchema');

// Get all coupons
const couponInfo = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.render('coupon', { coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get add coupon page
const getAddCouponPage = async (req, res) => {
    try {
        res.render('addCoupon');
    } catch (error) {
        console.error('Error loading add coupon page:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Add new coupon
const addCoupon = async (req, res) => {
    try {
        const {code,description,discountType,discountAmount,minimumPurchase,usageLimit,expiryDate} = req.body;

        // Validate discount amount
        if (discountType === 'percentage' && (discountAmount < 0 || discountAmount > 100)) {
            return res.status(400).json({success: false,message: 'Percentage discount must be between 0 and 100' });
        }

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            description,
            discountType,
            discountAmount,
            minimumPurchase,
            usageLimit,
            expiryDate: new Date(expiryDate)
        });

        await coupon.save();
        res.status(201).json({ success: true, message: 'Coupon created successfully' });
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get coupon for editing
const editCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        res.json({ success: true, coupon });
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get edit coupon page
const getEditCouponPage = async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        
        res.render('editCoupon', { coupon });
    } catch (error) {
        console.error('Error loading edit coupon page:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Update coupon
const updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const {code,description,discountType,discountAmount,minimumPurchase,usageLimit,expiryDate} = req.body;

        // Validate discount amount
        if (discountType === 'percentage' && (discountAmount < 0 || discountAmount > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Percentage discount must be between 0 and 100'
            });
        }

        if (discountType === 'fixed' && discountAmount <= 0) {
            return res.status(400).json({success: false,message: 'Fixed discount must be greater than 0'});
        }

        // Check if coupon exists
        const existingCoupon = await Coupon.findById(couponId);
        if (!existingCoupon) {
            return res.status(404).json({success: false,message: 'Coupon not found'});
        }

        // Check if code is unique (excluding current coupon)
        if (code.toUpperCase() !== existingCoupon.code) {
            const duplicateCoupon = await Coupon.findOne({
                _id: { $ne: couponId },
                code: code.toUpperCase()
            });

            if (duplicateCoupon) {
                return res.status(400).json({success: false,message: 'Coupon code already exists'});
            }
        }

        // Update coupon with type conversion
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                code: code.toUpperCase(),
                description,
                discountType,
                discountAmount: Number(discountAmount),
                minimumPurchase: Number(minimumPurchase),
                usageLimit: Number(usageLimit),
                expiryDate: new Date(expiryDate)
            },
            { new: true, runValidators: true }
        );

        res.json({success: true,message: 'Coupon updated successfully',coupon: updatedCoupon});
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({success: false,message: error.message || 'Failed to update coupon'});
    }
};

// Toggle coupon status (active/inactive)
const toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        coupon.status = !coupon.status;
        await coupon.save();

        res.json({success: true,message: `Coupon ${coupon.status ? 'activated' : 'deactivated'} successfully`});
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;

        // Check if coupon exists
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({success: false,message: 'Coupon not found'});
        }

        // Delete the coupon
        await Coupon.findByIdAndDelete(couponId);

        res.json({success: true,message: 'Coupon deleted successfully'});
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({success: false,message: error.message || 'Failed to delete coupon'});
    }
};

module.exports = {
    couponInfo,
    getAddCouponPage,
    addCoupon,
    editCoupon,
    getEditCouponPage,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon
};
