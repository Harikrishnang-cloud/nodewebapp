const User = require("../../models/userSchema");
const otpModel = require("../../models/otpSchema");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const userHelper = require('../../helpers/userHelper')
const bcrypt = require('bcrypt')
const Books = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Product = require('../../models/productSchema');
const { redirect } = require("server/reply");
const Cart = require('../../models/cartSchema');
const { MongoUnexpectedServerResponseError } = require("mongodb");


//cart view
const getCart = async(req,res)=>{
    try {
        console.log(req.session.user)
        const cart = await Cart.findOne({userId:req.session.user._id}).populate('books.product')
        console.log("This is cart Data",cart)
        
      res.render('cart',{user:req.session.user,cart:cart||{books:[]}})
    } 
    catch (error) {
      console.log(error);
      
    }
  }

//add to Cart Controller
const addToCart = async (req, res) => {
    try {
        const productId = req.body.id;
        const quantity = parseInt(req.body.quantity) || 1;
        const user = await User.findOne({ _id: req.session.user._id });
        if(!user){
            return res.status(400).json({success:false,message:"No user Found with this EmailId"})
        }

        const cart = await Cart.findOne({userId:user._id});
        const product = await Product.findById(productId);
        
        // Check if product exists
        if(!product) {
            return res.status(404).json({success:false, message:"Product not found"});
        }

        // Check if product is in stock
        if(product.Quantity <= 0) {
            return res.status(400).json({success:false, message:"Product is out of stock"});
        }

        if(!cart){
            // Check if requested quantity is available
            if(quantity > product.Quantity) {
                return res.status(400).json({success:false, message:`Only ${product.Quantity} units available`});
            }

            const newCart = new Cart({
                userId:user._id,
                books:[{product:productId, quantity:quantity}]
            })
            await newCart.save();
            return res.status(200).json({success:true, message:"Product added to cart successfully", cartCount: 1})
        }else{
            const productIndex = cart.books.findIndex((book) => book.product.toString() === productId);
            if (productIndex !== -1) {
                const newQuantity = cart.books[productIndex].quantity + quantity;
                if(newQuantity > product.Quantity){
                    return res.status(400).json({success:false, message:`Only ${product.Quantity} units available`})
                }else if(newQuantity <= 0){
                    return res.status(400).json({success:false,message:"At least one product is required"})
                }else if(newQuantity > 5){
                    return res.status(400).json({success:false,message:"You can add only 5 products at a time"})
                }
                cart.books[productIndex].quantity += quantity;
            } else {
                if(quantity > product.Quantity){
                    return res.status(400).json({success:false, message:`Only ${product.Quantity} units available`})
                }
                cart.books.push({ product: productId, quantity: quantity });
            }
            await cart.save();
            return res.status(200).json({success:true, message:"Product added to cart successfully", cartCount: cart.books.length})
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false, message:"Internal Server Error"})
    }
}

//Delete from cart
const removeFromCart = async (req, res) => {
    try {
        const productId = req.body.id;
        const user = await User.findOne({ _id: req.session.user._id });
        if(!user){
            return res.status(400).json({success:false,message:"No user Found with this EmailId"})
        }
        const cart = await Cart.findOne({userId:user._id});
        const productIndex = cart.books.findIndex((book) => book.product.toString() === productId);
        if (productIndex !== -1) {
            cart.books.splice(productIndex, 1);
            await cart.save();
            return res.status(200).json({success:true, message:"Product removed from cart successfully", cartCount: cart.books.length})
        } else {
            return res.status(400).json({success:false,message:"Product not found in cart"})
        }
    } catch (error) {
        return res.status(500).json({success:false, message:"Internal Server Error"})
    }
}

// Get cart count
const getCartCount = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.session.user._id });
        if(!user){
            return res.status(400).json({success:false,message:"No user Found"})
        }
        const cart = await Cart.findOne({userId:user._id});
        const count = cart ? cart.books.length : 0;
        return res.json({success:true, count});
    } catch (error) {
        console.log(error);
        return res.status(500).json({success:false,message:"Internal Server Error"})
    }
}

module.exports = {
    addToCart, 
    getCart,
    removeFromCart,
    getCartCount
}