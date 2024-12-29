const mongoose = require('mongoose')
const {Schema} = mongoose;


const adminSchema = new Schema({
    email : {
        type : String,
        required : true,
        unique : true,
    },
    password : {
        type : String,
        required : false
    },
   
})
const admin = mongoose.model("admin",adminSchema);

module.exports = admin;