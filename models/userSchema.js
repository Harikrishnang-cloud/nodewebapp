const mongoose = require('mongoose');
const { type } = require('server/reply');
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
    google: {
        id: {
            type: String,
            unique: true,
            sparse: true
        },
        name: {
            type: String
        },
        email: {
            type: String
        },
        picture: {
            type: String
        }
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
    address : [{
        fullName : {type:String,required:true},
        street : {type:String,required:true},
        city : {type:String,required:true},
        state : {type:String,required:true},
        // country : {type:String,required:true},
        pinCode : {type:String,required:true},
        phone :{type:String,required:true},
        }],
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