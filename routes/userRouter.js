const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/userController');
const cartController = require('../controllers/user/cartController')
const orderController = require('../controllers/user/orderController')
const auth = require('../middlewares/middle')
const loginauth = require('../middlewares/auth')

// Page routes----> oro page nteyum route
router.get('/', userController.loadHomepage);
router.get('/pageNotFound', userController.pageNotFound);
router.get('/shop', userController.loadShopping);
router.get('/login',auth.preventToLogin, userController.loginpage);
router.get('/signup', userController.loadSignup);
router.get('/otp', userController.otp);
router.get('/resendotp', userController.resendotp);

// Shop page route
router.get('/user/shop/:page', userController.getShopPage);
router.post('/user/filter-products', userController.filterProducts);

//order routes
router.get('/placeOrder',loginauth.userAuth,orderController.getPlaceOrderPage)
router.post('/placeOrder',loginauth.userAuth,orderController.placeOrder)
router.get('/orderConfirmation/:orderId',loginauth.userAuth,orderController.getOrderConfirmation)
router.get('/orders',loginauth.userAuth,orderController.getOrders)
router.post('/cancelOrder/:orderId',loginauth.userAuth,orderController.cancelOrder)

//user pages route
router.get('/userProfile',loginauth.userAuth,userController.userProfile); //if user is login then go to that usrProfile page
router.post('/userProfile',loginauth.userAuth,userController.updateProfile)
router.post('/updatePass',loginauth.userAuth,userController.updatePass)
router.get('/editProfile',loginauth.userAuth,userController.editProfile)

// Address management routes
router.get('/userAddress',loginauth.userAuth,userController.userAddress);
router.post('/addAddress',loginauth.userAuth,userController.addAddress);
router.post('/editAddress',loginauth.userAuth,userController.editAddress);
router.post('/deleteAddress',loginauth.userAuth,userController.deleteAddress);

// cart routes
router.get('/user/cart',loginauth.userAuth,cartController.getCart)
router.post('/addToCart',loginauth.userAuth,cartController.addToCart)
router.delete('/removeFromCart',loginauth.userAuth,cartController.removeFromCart)
router.get('/cartCount',loginauth.userAuth,cartController.getCartCount)


// Signup and OTP routes
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);

// Google Auth --> passport route
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }),(req, res) => {req.session.user = req.session.passport.user
  res.redirect('/');
});

//authentication//
router.post('/login',userController.login)
router.get('/logout',userController.logoutpage)
router.get("/productDetails", userController.productDetails)


module.exports = router;
