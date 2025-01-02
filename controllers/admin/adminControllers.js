const adminModel = require('../../models/adminSchema')
const mongoose = require("mongoose")
const bcrypt = require('bcrypt')
const Category = require('../../models/categorySchema')

//page-error ne vendi
const pageerror = async (req,res)=>{
  res.render("admin-error")
}

// login-page load cheyyan
const loadLogin = (req,res)=>{
    if(req.session.admin){
      return res.redirect("/admin/dashboard")
    }
    else{
      res.render("adminlogin",{message:null})
    }
}

// dashboard load cheyyan
const loaddashboard = (req,res)=>{
  try {
    
    if(req.session.admin){
        console.log("call vannu");
        return res.render("dashboard")
    }
  } 
  catch (error) {
    console.log("dashboard cannot load",error)     
  }
}

//admin validation
const adminLogin = async(req,res)=>{
    try {
         const  {email ,password} = req.body
         console.log(req.body)
        const admindata = await adminModel.findOne({email:email}) 
        
        if(admindata){
          console.log(admindata.password===password);
          if(admindata.password===password){
            req.session.admin = admindata._id+""
            res.status(200).json({success:true,message:"admin login successfully"})
          }
        }
    } 
    catch (error) {
      console.log("login error",error);
    }
}
//logout nte contro.
const logout = async(req,res)=>{
  try {
    console.log("A")
    req.session.admin = null;
    res.redirect("/admin/login")
  } catch (error) {
    console.log("unexpected error during logout",error);
    res.redirect("/pageerror")
  }
}


module.exports = {
    loadLogin,
    loaddashboard,
    adminLogin,
    pageerror,
    logout,
    
}