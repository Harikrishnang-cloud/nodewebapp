const express = require('express')
const multer = require('multer')
const path = require('path')
const router = express.Router()
const adminController = require("../controllers/admin/adminControllers")
const {userAuth,adminAuth} = require("../middlewares/auth")
const customerController = require("../controllers/admin/customer")
const categoryController = require("../controllers/admin/categoryController")
const productController = require("../controllers/admin/productController")
const publicationController =require("../controllers/admin/publicationController")
const orderController = require("../controllers/admin/orderController")
const { upload } = require('../middlewares/multer'); 
// const auth = require('../middleware/adminAuth');

//admin pages
router.get("/pageerror",adminController.pageerror)
router.get("/login",adminController.loadLogin)
router.get("/dashboard",adminAuth,adminController.loaddashboard)
router.post("/login",adminController.adminLogin)
router.get("/logout",adminController.logout)

//Customer Management
router.get("/users",adminAuth,customerController.customerInfo)
router.post("/blockCustomer/toggle",adminAuth,customerController.customerBlocked)//Block & Unblock 

//Category Management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/editCategory/:id",adminAuth,categoryController.editCategory)
router.post("/category/edit/:id",adminAuth,categoryController.updateCategory)

//Publication Management
router.get("/publication",adminAuth,publicationController.publicationInfo)
router.post("/addpublication",adminAuth,publicationController.addPublication)
router.get("/updatepublication/:id",adminAuth,publicationController.updatePublication)
router.get("/editPublication/:id",adminAuth,publicationController.editPublication)
router.post("/editPublication/:id",adminAuth,publicationController.postEditPublication)

//Product Management
router.get("/addProduct",adminAuth,productController.productAddpage);
router.post("/addProduct",adminAuth,upload.array('images', 4),productController.productAdd)
router.get("/productview",adminAuth,productController.productview)
router.post('/products/toggle-status/:id',adminAuth,productController.deleteProduct);
router.get("/editProduct/:id",adminAuth,productController.editProduct)
router.post("/editProduct/:id",adminAuth,upload.array('images',4),productController.updateProduct)

// Order Management Routes
router.get('/orders', adminAuth,  orderController.getOrders);
router.get('/order-details/:orderId',adminAuth,  orderController.getOrderDetails);
router.post('/update-order-status',adminAuth, orderController.updateOrderStatus);
router.post('/orders/:orderId/cancel', adminAuth, orderController.cancelOrder);

module.exports = router;