const adminModel = require('../../models/adminSchema')
const mongoose = require("mongoose")
const bcrypt = require('bcrypt')
const Category = require('../../models/categorySchema')

//page-error ->
const pageerror = async (req,res)=>{
  res.render("admin-error")
}

// login-page load ->
const loadLogin = (req,res)=>{
    if(req.session.admin){
      return res.redirect("/admin/dashboard")
    }
    else{
      res.render("adminlogin",{message:null})
    }
}

// dashboard load ->
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

//admin validation ->
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);
    const admindata = await adminModel.findOne({ email: email });

    if (admindata) {
      if (admindata.password === password) {
        req.session.admin = admindata._id + "";
        return res.status(200).json({ success: true, message: "Admin login successful" });
      } else {
        return res.status(401).json({ success: false, message: "Incorrect password" });
      }
    } else {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
  } catch (error) {
    console.log("login error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//logout controller ->
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