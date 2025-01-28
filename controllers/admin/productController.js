const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const multer = require("multer")
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose")
const publicationSchema = require("../../models/publicationSchema");
const { productOfferCalculate } = require('../../helpers/productHelper');


//product add page
const productAdd = async (req, res) => {
    try {
        const { productName, description, category, Quantity, publication, regularPrice, salePrice } = req.body;

        if (!productName || !category || !Quantity || !regularPrice) {
            return res.status(400).send('Missing required fields. Please check your input.');
        }   

        // Validate quantity is not negative
        if (Quantity < 0) {
            return res.status(400).send('Product quantity cannot be negative.');
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('At least one product image is required.');
        }

        // Use absolute path for uploads directory
        const uploadDir = path.join(__dirname, '../../public/uploads');
        
        // Ensure upload directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const images = [];
        console.log(`Processing ${req.files.length} new files...`);

        for (const file of req.files) {
            try {
                const originalImagePath = file.path;
                // Generate a clean filename
                const ext = 'webp'; 
                const filename = `${Date.now()}-${path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '-')}.${ext}`;
                const resizedImagePath = path.join(uploadDir, filename);

                console.log(`Processing file: ${filename}`);

                // Process image with sharp
                await sharp(originalImagePath)
                    .resize(800, 800, { 
                        fit: 'inside',
                        withoutEnlargement: true 
                    })
                    .webp({ quality: 80 })
                    .toFile(resizedImagePath);

                // Add processed image to array
                images.push(filename);

                // Clean up original file
                fs.unlink(originalImagePath, (err) => {
                    if (err) console.error(`Error removing original file: ${err.message}`);
                });

            } catch (error) {
                console.error(`Error processing image: ${error.message}`);

                continue;
            }
        }

        if (images.length === 0) {
            return res.status(400).send('Failed to process any of the uploaded images. Please try again with valid image files.');
        }

        const newProduct = new Product({
            productName,
            description,
            category,
            Quantity,
            publication,
            regularPrice,
            salePrice: salePrice || null,
            productImage: images
        });

        await newProduct.save();
        console.log('Product added successfully with images:', images);
        res.redirect('/admin/productview');

    } catch (error) {
        console.error('Error in productAdd:', error);
        res.status(500).send(`Failed to add product: ${error.message}`);
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

// product-view page
const productview = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 6; 
        const skip = (page - 1) * limit; 

        // Fetch total products count
        const totalProducts = await Product.countDocuments({});
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch paginated products
        const products = await Product.find({})
            .skip(skip)
            .limit(limit)
            .populate('category')
            .populate('publication');

        res.render('productview', {
            products,
            currentPage: page,
            totalPages,
            limit,
        });
    } catch (error) {
        console.error('Error in productview controller:', error.message);
        res.status(500).send('Internal Server Error');
    }
};


//delete-Product
const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findById(id);
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Toggle the status
        product.status = product.status === "Unblock" ? "Block" : "Unblock";
        await product.save();

        // Send back a clear message
        res.status(200).json({
            message: `Product has been ${product.status === "Block" ? "blocked" : "unblocked"} successfully`,
            status: product.status
        });
    } catch (error) {
        console.error('Error toggling product status:', error);
        res.status(500).json({ message: 'Failed to update product status' });
    }
};

//edit-Product
const editProduct = async(req,res)=>{
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId)
            .populate('category')
            .populate('publication');

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Ensure productImage is always an array
        product.productImage = product.productImage || [];

        // Log the product images for debugging
        console.log('Product images before render:', product.productImage);

        const categories = await Category.find();
        const publication = await publicationSchema.find({});

        res.render('editProduct', {
            product,
            cat: categories,
            publication
        });
    } catch (error) {
        console.error("Error loading edit page:", error.message);
        res.status(500).send("Failed to load the edit page.");
    }
}
//Update-Product
const updateProduct = async (req, res) => {
    console.log('Update controllerill enter aayi');
    try {
        const productId = req.params.id;
        const { productName, description, regularPrice, salePrice, category, Quantity, publication, removeImages, existingImages } = req.body;

        console.log('Request Params:', req.params);
        console.log('Request Body:', req.body);
        console.log('Request files:', req.files);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID format" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        let updatedImages = [];
        
        if (existingImages) {
            
            const existingImagesArray = Array.isArray(existingImages) ? existingImages : [existingImages];
            updatedImages = existingImagesArray.filter(Boolean);
        }

        console.log('Existing images after filter:', updatedImages);

        // Remove images if specified
        if (removeImages) {
            const imagesToRemove = Array.isArray(removeImages) ? removeImages : [removeImages];
            
            // Delete files from filesystem
            for (const image of imagesToRemove) {
                const filePath = path.join(__dirname, '../public/uploads', image);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted file: ${filePath}`);
                    } catch (err) {
                        console.error(`Error deleting file: ${filePath}`, err.message);
                    }
                }
            }

            // Remove from updatedImages array
            updatedImages = updatedImages.filter(img => !imagesToRemove.includes(img));
        }

        console.log('Images after removal:', updatedImages);

        // Process and save new images
        if (req.files && Array.isArray(req.files)) {
            console.log('Processing new files:', req.files.length);
            const uploadDir = path.join(__dirname, '../../public/uploads');
            
            // Ensure upload directory exists
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Process each new image
            for (const file of req.files) {
                try {
                    console.log('Processing file:', file.originalname);
                    const timestamp = Date.now();
                    const filename = `${timestamp}-${file.originalname.replace(/\s+/g, '-')}`;
                    const resizedImagePath = path.join(uploadDir, filename);

                    // Resize and save the image using the temporary path
                    await sharp(file.path)
                        .resize(800, 800, {
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .webp({ quality: 80 })
                        .toFile(resizedImagePath);

                    // Add the new filename to the images array
                    updatedImages.push(filename);

                    // Clean up the temporary file
                    fs.unlink(file.path, (err) => {
                        if (err) console.error('Error removing temporary file:', err);
                    });

                    console.log('Product saved aayi:', filename);

                } catch (error) {
                    console.error('Error processing image:', error.message);
                    // Continue with other images if one fails
                    continue;
                }
            }
        }

        const updatedData = {
            productName: productName || product.productName,
            description: description || product.description,
            category: category || product.category,
            Quantity: Quantity || product.Quantity,
            publication: publication || product.publication,
            regularPrice: regularPrice || product.regularPrice,
            salePrice: salePrice || product.salePrice,
            productImage: updatedImages 
        };

        //quantity is not negative
        if (updatedData.Quantity < 0) {
            return res.status(400).json({ success: false, message: "Product quantity is not negative"});
        }

        console.log('Database ill save aayi:', updatedData);

        // Update the product in the database
        const updatedProduct = await Product.findByIdAndUpdate(
            productId, 
            updatedData, 
            { new: true }
        ).populate('category').populate('publication');

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        console.log('Updated Product in DB:', updatedProduct);
        res.redirect("/admin/productview");
        
    } catch (error) {
        console.error('Error updating product:', error.stack);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};  


// Check if product name exists 
const checkProductName = async (req, res) => {
    try {
        const productName = req.query.name;
        const existingProduct = await Product.findOne({ productName: { $regex: new RegExp(`^${productName}$`, 'i') } });
        res.json({ exists: !!existingProduct });
    } catch (error) {
        console.error('Error checking product name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    productAddpage,
    productAdd,
    productview,
    deleteProduct,
    editProduct,
    updateProduct,
    checkProductName
}
