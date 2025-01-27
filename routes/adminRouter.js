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
const couponController = require("../controllers/admin/couponController")
const salesReportController = require("../controllers/admin/salesReportController")
const chartController = require("../controllers/admin/chartController")
const { uploadMiddleware } = require('../middlewares/multer'); 

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
router.patch("/category/updateStatus/:id",adminAuth,categoryController.updateCategoryStatus)
router.get('/check-category-name', adminAuth, categoryController.checkCategoryName);

//Publication Management
router.get("/publication",adminAuth,publicationController.publicationInfo)
router.post("/addPublication",adminAuth,publicationController.addPublication)
router.get("/updatepublication/:id",adminAuth,publicationController.updatePublication)
router.get("/editPublication/:id",adminAuth,publicationController.editPublication)
router.post("/editPublication/:id",adminAuth,publicationController.postEditPublication)
router.get('/check-publication-name', adminAuth, publicationController.checkPublicationName);

//Product Management
router.get("/addproduct",adminAuth,productController.productAddpage);
router.post("/addProduct",adminAuth,uploadMiddleware,productController.productAdd)
router.get("/productview",adminAuth,productController.productview)
router.patch('/products/toggle-status/:id',adminAuth,productController.deleteProduct);
router.get("/editProduct/:id",adminAuth,productController.editProduct)
router.post("/editProduct/:id",adminAuth,uploadMiddleware,productController.updateProduct)
router.get('/check-product-name', adminAuth, productController.checkProductName);

// Chart Data
router.get("/chart-data", adminAuth, chartController.getChartData)

// Order Management Routes
router.get('/orders', adminAuth,  orderController.getOrders);
router.get('/order-details/:orderId',adminAuth,  orderController.getOrderDetails);
router.post('/update-order-status',adminAuth, orderController.updateOrderStatus);
router.post('/orders/:orderId/cancel', adminAuth, orderController.cancelOrder);
router.patch('/update-order-status', adminAuth, orderController.updateStatus);

//coupon Management Routes
router.get("/coupon", adminAuth, couponController.couponInfo);
router.get("/addCoupon", adminAuth, couponController.getAddCouponPage);
router.post("/addCoupon", adminAuth, couponController.addCoupon);
router.get("/editCoupon/:id", adminAuth, couponController.getEditCouponPage);
router.put("/editCoupon/:id", adminAuth, couponController.updateCoupon);
router.delete("/coupon/toggle-status/:id", adminAuth, couponController.toggleCouponStatus);
router.delete("/coupon/delete/:id", adminAuth, couponController.deleteCoupon);

//Sales Report
router.get("/salesReport", adminAuth, salesReportController.getSalesReport);
router.get("/sales-report/download", adminAuth, salesReportController.downloadSalesReport);

module.exports = router;