const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const multer = require("multer")
const path = require("path");
const sharp = require("sharp");
// const { publicationInfo } = require("./publicationController");
// const Publication = require('../../models/publicationSchema');
const publicationSchema = require("../../models/publicationSchema");




// //Multer session
// const storage = multer.diskStorage({
//     destination: './public/uploads/', // Folder to save uploaded files
//     filename: (req, file, cb) => {
//         cb(null, `${Date.now()}_${file.originalname}`);
//     },
// });

// // File upload validation
// const fileFilter = (req, file, cb) => {
//     const fileTypes = /jpeg|jpg|png|gif/;
//     const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
//     const mimeType = fileTypes.test(file.mimetype);

//     if (extName && mimeType) {
//         cb(null, true);
//     } else {
//         cb('Error: Images only!');
//     }
// };

// const upload = multer({
//     storage,
//     fileFilter,
//     limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
// });


//product add page
const productAdd = async (req, res) => {
    try {
        
        const { productName, description, category, Quantity, publication, regularPrice, salePrice } = req.body;

        // Validate required fields
        if (!productName || !category || !Quantity || !regularPrice) {
            return res.status(400).send('Missing required fields. Please check your input.');
        }
        console.log("Data vannu",req.files)

        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('At least one product image is required.');
        }

        const uploadDir = path.join(__dirname, '../public/uploads');

        // Ensure the uploads directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, 
                { recursive: true });
        }
        
        const images = [];
        for (const file of req.files) {
            const originalImagePath = file.path; // Path of the uploaded file
            const resizedImagePath = path.join(uploadDir, `${Date.now()}-${file.originalname}`); // Save path with unique name
        
            try {
                // Resize and save the image
                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);
        
                // Push the relative path of the resized image
                images.push(path.relative('public', resizedImagePath));
            } catch (error) {
                console.error('Error processing image:', error.message);
                throw error;
            }
        }
        
        console.log("Processed Images:", images);

        // Save product to database
        const newProduct = new Product({
            productName,
            description,
            category,
            Quantity,
            publication,
            regularPrice,
            salePrice: salePrice || null, 
            productImage:images
        });
        await newProduct.save();

        console.log('Product added successfully:', newProduct);
        res.redirect('/admin/productview');
    } catch (error) {
        console.error('Error adding product:', error.message);
        res.status(500).send('Failed to add product. Please try again later.');
    }
};



// product add cheyyan
const productAddpage = async (req,res)=>{
    try {
        const category = await Category.find({isListed:true});
        const publicationList = await publicationSchema.find({});

        
        res.render("addProduct",{ cat:category, pub:publicationList,})
    }    
    catch (error) {
        console.error("Error fetching data for Add Product page:", error);
        res.status(500).send("Server Error");
    }
}

//product-view page
const productview = async (req, res) => {
    try {
        const products = await Product.find({isListed:true}).populate('category').populate('publication')
       
        res.render('productview', { products }); 
    } catch (error) {
        console.error(error.message);
        res.status(500).send("wrong aanu. atha error vannath");
    }
};

const deleteProduct = async (req, res) => {
    console.log('lolololo');
    
    try {
        const id = req.params.id;

        // Find product and toggle the status
        const product = await Product.findById(id);
        console.log('thi ',product);
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        product.status = product.status === "Unblock" ? "Block" : "Unblock";
        await product.save();

        res.status(200).json({
            message: `Product status updated to ${product.status ? 'Listed' : 'Unlisted'}`,
            status: product.status,
        });
    } catch (error) {
        console.error('Error toggling product status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


module.exports = {
    productAddpage,
    productAdd,
    productview,
    deleteProduct
}
