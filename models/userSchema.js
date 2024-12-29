const mongoose = require('mongoose')
const {Schema} = mongoose;

const userSchema = new Schema({
    fullName : {
        type : String,
        required : true
    },
    email : {
        type : String,
        required : true,
        unique : true,
    },
    phone : {
        type : String,
        required : false,
        unique : false,
        sparse : true,
        default : null
    },
    googleId : {
        type : String,
        unique : true,
        sparse: true  // 'sparse' allows multiple null values
    },
    password : {
        type : String,
        required : false
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    isAdmin : {
        type : Boolean,
        default : false
    },
    isVerify :{
        type : Boolean,
        default : false
    },
    // cart : [{
    //     type : Schema.Types.ObjectId,
    //     ref:"Cart"
    // }],
    // wallet : [{
    //     type : Schema.Types.ObjectId,
    //     default : "Wishlist"
    // }],
    // orderHistory : [{
    //     type : Schema.Types.ObjectId,
    //     ref : "Order"
    // }],
    createdOn : {
        type : Date,
        default : Date.now,
    },
    // referalCode : {
    //     type : String
    // },
    // redeemed : {
    //     type : Boolean
    // },
    // redeemedUsers : [{
    //     type : Schema.Types.ObjectId,
    //     ref : "User"
    // }], 
    // SearchHistory : {
    //     category : {
    //         type : Schema.Types.ObjectId,
    //         ref : "Category",
    //     },
    //     brand : {
    //         type : String
    //     },
    //     searchOn : {
    //         type : Date,
    //         default : Date.now
    //     }
    // }
})
const User = mongoose.model("User",userSchema);

module.exports = User;