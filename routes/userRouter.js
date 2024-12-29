const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/userController');
const auth = require('../middlewares/middle')
// Page routes----> oro page nteyum route
router.get('/', userController.loadHomepage);
router.get('/pageNotFound', userController.pageNotFound);
router.get('/shop', userController.loadShopping);
router.get('/login',auth.preventToLogin, userController.loginpage);
router.get('/signup', userController.loadSignup);
router.get('/otp', userController.otp);
router.get('/resendotp', userController.resendotp);


// Signup and OTP routes
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);

// Google Auth --> passport route
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }),(req, res) => {
  res.redirect('/');
});
//authentication//
router.get('/login',userController.loadlogin)
router.post('/login',userController.login)
router.get('/logout',userController.logoutpage)

module.exports = router;
