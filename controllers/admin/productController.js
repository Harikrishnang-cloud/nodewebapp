const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const multer = require("multer")
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose")
const publicationSchema = require("../../models/publicationSchema");



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
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const images = [];
        for (const file of req.files) {
            const originalImagePath = file.path; 
            const resizedImagePath = path.join(uploadDir, `${Date.now()}-${file.originalname}`); 
            try {
                // Resize and save the image
                await sharp(originalImagePath).resize({ width: 400, height: 500 }).toFile(resizedImagePath);
                images.push(path.basename(resizedImagePath));
                console.log(images)
            } catch (error) {
                console.error('Error processing image:', error.message);
                throw error;
            }
        }
        
        console.log("Processed Images:", images);

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
    console.log('deleteProduct controller ill enter aayi');
    try {
        const id = req.params.id;
        // Find product and toggle the status
        const product = await Product.findById(id);
        console.log('this is the product :',product);
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        product.status = product.status === "Unblock" ? "Block" : "Unblock";
        await product.save();
        res.status(200).json({message: `Product status updated to ${product.status ? 'Listed' : 'Unlisted'}`,status: product.status,});
    } catch (error) {
        console.error('Error toggling product status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

//edit-Product
const editProduct = async(req,res)=>{
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category').populate('publication')
        if (product.productImage && product.productImage.length > 0) {
            product.productImage = product.productImage.map(imgPath => {
                return imgPath.replace(/\\/g, '/').replace('../controllers/public/uploads/', '');
            });
        }
        
        console.log(product.productImage); 
        const categories = await Category.find();
        const publication = await publicationSchema.find({});

        res.render('editProduct',{product,cat:categories,publication})
    } catch (error) {
        console.error("Error loading edit page:", error.message)
        res.status(500).send("Failed to load the edit page.")
    }
}
//Update-Product
const updateProduct = async (req, res) => {
    console.log('Update Product Controller Hit');
    try {
        const productId = req.params.id;
        const { productName, description, regularPrice, salePrice, category, Quantity, publication, removeImages, existingImages } = req.body;

        console.log('Request Params:', req.params);
        console.log('Request Body:', req.body);
        console.log('Request files:', req.files);
        console.log('Remove Images:', removeImages);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID format" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        let updatedImages = existingImages || [];
        if (removeImages && Array.isArray(removeImages)) {
            // Filter out images to remove and delete them from the filesystem
            updatedImages = updatedImages.filter(img => !removeImages.includes(img));
            removeImages.forEach(image => {
                const filePath = path.join(__dirname, '../public/uploads', image);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath); // Delete the file
                        console.log(`Deleted file: ${filePath}`);
                    } catch (err) {
                        console.error(`Error deleting file: ${filePath}`, err.message);
                    }
                }
            });
        }
        if (req.files && req.files['images']) {
            const newImages = req.files['images'].map(file => file.path.replace(/\\/g, '/'));
            updatedImages.push(...newImages);
        }

        const updatedData = {
            productName: productName || product.productName,
            description: description || product.description,
            category: category || product.category,
            Quantity: Quantity || product.Quantity,
            publication: publication || product.publication,
            regularPrice: regularPrice || product.regularPrice,
            salePrice: salePrice || product.salePrice,
            productImage: updatedImages,
        };

        // Update the product in the database
        const updatedProduct = await Product.findByIdAndUpdate(productId, updatedData, { new: true });
        console.log(updatedImages)
        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        console.log('Updated Product:', updatedProduct)
        res.redirect("/admin/productview")
    } catch (error) {
        console.error('Error updating product:', error.stack);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};  


module.exports = {
    productAddpage,
    productAdd,
    productview,
    deleteProduct,
    editProduct,
    updateProduct,
   
}
