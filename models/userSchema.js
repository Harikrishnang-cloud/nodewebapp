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
    googleId:{
        type:String
    }
    ,
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
        pinCode : {type:String,required:true},
        phone :{type:String,required:true},
    }],
    wallet: {
        balance: {
            type: Number,
            default: 0
        },
        transactions: [{
            amount: {
                type: Number,
                required: true
            },
            type: {
                type: String,
                enum: ['credit', 'debit'],
                required: true
            },
            description: {
                type: String,
                required: true
            },
            orderId: {
                type: Schema.Types.ObjectId,
                ref: 'Order'
            },
            date: {
                type: Date,
                default: Date.now
            }
        }]
    },
    createdOn : {
        type : Date,
        default : Date.now,
    }
})
const User = mongoose.model("User",userSchema);

module.exports = User;