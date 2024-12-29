const express = require('express');
const multer = require('multer');
const path = require('path');
const productController = require('../controllers/admin/productController');
const adminAuth = require('../middlewares/auth');
const router = express.Router();


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads')); // Adjusted path
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
})

// const upload = multer({
//     storage,
//     fileFilter: (req, file, cb) => {
       
        
//         const allowedTypes = /jpeg|jpg|png/;
//         const mimetype = allowedTypes.test(file.mimetype);
//         const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//         if (mimetype && extname) {
//             return cb(null, true);
//         }
//         cb(new Error('Only .png, .jpg, and .jpeg formats are allowed!'));
//     },
//     limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
// })
const upload = multer({ storage });

module.exports =  {
    storage,
    upload
}