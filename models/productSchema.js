const mongoose = require('mongoose')
const {Schema} = mongoose;

const productSchema = new mongoose.Schema({
    productName : {
        type : String,
        required : true 
    },
    description : {
        type : String,
        required : true
    },
    publication : {
        type : Schema.Types.ObjectId,
        ref : "Publication",
        required : true
    },
    category : {
        type : Schema.Types.ObjectId,
        ref : "category",
        required : true
    },
    regularPrice : {
        type : Number,
        required : true
    },
    salePrice : {
        type : Number,
        required : true
    },
    productOffer : {
        type : Number,
        default : 0
    },
    Quantity : {
        type : Number,
        default : true
    },
    productImage: [
        {
             type: String 
            }],
    isBlocked : {
        type : Boolean,
        default : false
    },
    // status : {
    //     type : String,
    //     enum : ["Available","Out of Stock","Discontinued"],
    //     required : true,
    //     default : "Available"
    // },
    status: {
        type: String,
        enum: ["Block", "Unblock"],
        required: true,
        default: "Unblock",
    },    

},{timestamps : true})

const Product = mongoose.model("Product",productSchema)
module.exports = Product;