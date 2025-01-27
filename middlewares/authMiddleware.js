const User = require('../models/userSchema');

const checkBlockedStatus = async (req, res, next) => {
    try {
        
        if (!req.session.user) {
            return next();
        }

        // Check if user exists and is blocked
        const user = await User.findById(req.session.user._id);
        if (!user || user.isBlocked) {
            
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
            });
            
            return res.redirect('/login?error=Your account has been blocked. Please contact support.');
        }

        // User exists and is not blocked, proceed
        next();
    } catch (error) {
        console.error('Error checking blocked status:', error);
        next(error);
    }
};

module.exports = {
    checkBlockedStatus
};
