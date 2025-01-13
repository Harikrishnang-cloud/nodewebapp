const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');

// Get wishlist page
const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        if (!userId) {
            return res.redirect('/login');
        }

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            model: 'Product',
            select: 'productName description regularPrice salePrice productImage'
        });

        // Transform the data to match your view expectations
        const wishlistItems = wishlist ? wishlist.products.map(item => ({
            _id: item.productId._id,
            productName: item.productId.productName,
            description: item.productId.description,
            regularPrice: item.productId.regularPrice,
            salePrice: item.productId.salePrice,
            productImage: item.productId.productImage
        })) : [];

        console.log('Wishlist items:', wishlistItems);
        
        res.render('wishlist', {
            wishlistItems,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Add to wishlist
const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.body.productId;

        console.log('Adding to wishlist:', { userId, productId });

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login first' });
        }

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: []
            });
        }

        // Check if product already exists in wishlist
        const productExists = wishlist.products.some(item => 
            item.productId.toString() === productId
        );

        if (!productExists) {
            wishlist.products.push({ productId });
            await wishlist.save();
            res.json({ success: true, message: 'Product added to wishlist' });
        } else {
            res.json({ success: false, message: 'Product already in wishlist' });
        }
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;  
        const productId = req.body.productId;

        console.log('Removing from wishlist:', { userId, productId });

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        const result = await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        console.log('Remove result:', result);

        if (result.modifiedCount > 0) {
            res.json({ success: true, message: 'Product removed from wishlist' });
        } else {
            res.json({ success: false, message: 'Product not found in wishlist' });
        }
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get wishlist count
const getWishlistCount = async (req, res) => {
    try {
        const userId = req.session.user._id;
        if (!userId) {
            return res.json({ success: true, count: 0 });
        }

        const wishlist = await Wishlist.findOne({ userId });
        const count = wishlist ? wishlist.products.length : 0;
        return res.json({ success: true, count });
    } catch (error) {
        console.error('Error getting wishlist count:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    getWishlistCount
};