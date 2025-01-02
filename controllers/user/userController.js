const User = require("../../models/userSchema");
const otpModel = require("../../models/otpSchema");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const userHelper = require('../../helpers/userHelper')
const bcrypt = require('bcrypt')
const Books = require("../../models/productSchema")
const Category = require("../../models/categorySchema")



// Page Not Found Controller
const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    console.error("Error rendering 404 page:", error);
    res.redirect("/pageNotFound");
  }
};
//otp-verify cheyyan ulla controller
const verifyOtp = async (req, res) => {
  try {
    const userOtp = req.body.otp;
    // const validotp = await otpModel.findOne({otp:userOtp})
    const validotp = req.session.singupotp
    console.log("validotp",validotp)
       
    if(validotp){
     userHelper.createUser(req.session.userData)
     .then((response)=>{
      res.json({success:true})
     }).catch((error)=>{
      console.log(error.message);
      
      res.json({success:false})
     })    
    }
     
  } catch (error) {
    console.error("Error rendering 404 page:", error);
    res.redirect("/pageNotFound");
  }
};

// Generate OTP Function
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// Send Verification Email
async function sendVerificationEmail(email, otp) {
  try {
    console.log("send mail vannu");
    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      port: 465,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Account - Your App",
      text: `Your OTP is: ${otp} Thank you for using our service.`,
    });

    return info.accepted.length > 0;
  } 
  catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}
// Signup Controller
const signup = async (req, res) => {
const { fullName, email, phone, password} = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.render("signup", { message: "Email already registered." });
    }

    // Generate OTP
    const otp = generateOtp();
    console.log("otp");
    
    const emailSent = await sendVerificationEmail(email, otp);
    console.log("email,send",emailSent);
    
    if (!emailSent) {
      return res.render("signup",{message:"Failed to send OTP.please try again."})
    }
    if (emailSent) {
      // const res = await otpModel.create({ 
      //   email: email,
      //   otp: otp,
      // });
      req.session.singupotp = otp;
      console.log("otp",otp);
      
    }
    console.log(req.body);
    
    req.session.userOtp = otp;
    req.session.userData = req.body;

    return res.render("otp", { message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error during signup process:", error.message);
    res.redirect("/pageNotFound");
  }
};

// Load Signup Page
const loadSignup = async (req, res) => {
  try {
   if(req.session.user)
   {
    return res.redirect('/')
   }
   else{
    res.render("signup");
   }
  } catch (error) {
    console.error("Signup page not loading:", error);
    res.status(500).send("Server Error");
  }
};

// Load Shopping Page
const loadShopping = async (req, res) => {
  try {
    res.render("shop");
    
  } catch (error) {
    console.error("Shopping page not loading:", error);
    res.status(500).send("Server Error");
  }
};

//resend otp
const resendotp = async (req, res) => {
  try {

    if (req.session.userData.email) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(
        req.session.userData.email,otp
      );

      if(emailSent){
        const res = await otpModel.create({otp:otp})
      }
      console.log(emailSent);
      res.status(200).send("OTP resent successfully!");
    }
  } catch (error) {
    console.log("resendOtp is error", error);
  } 
};
// Load Homepage
const loadHomepage = async (req, res) => {
  console.log("Session", req.session.user)
  try {
    const userbooks = await Books.find({isListed:true})
    .limit(5)

    const categoryBooks = await Category.aggregate([
      {$match:{ isListed : true}},
      {
        $limit:4,
      },{
        $lookup:{from:"products",localField:"_id",foreignField:"category",as:"products"}
      },
      {$addFields:{topProducts:{$slice:["$products",5]}}},
      {
        $project:{
          products:0
        }
      }
    ]) 

    // console.log(categoryBooks)
    res.render("home",{
      user:req.session.user,
      book:userbooks,
      cats:categoryBooks
    });
  } catch (error) {
    console.error("Homepage not found:", error);
    res.status(500).send("Server Error");
  }
};

// Load Login Page
const loginpage = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.error("Login page error:", error.message);
    res.status(404).send("Server Error");
  }
};
//logout
const logoutpage = async (req, res) => {
  try {
    req.session.user=null//session distroy
    res.redirect("/login");
  } catch (error) {
    console.error("Login page error:", error.message);
    res.status(404).send("Server Error");
  }
};
// OTP Page
const otp = async (req, res) => {
  try {
    res.render("otp", { message: null });
  } catch (error) {
    console.error("OTP page error:", error.message);
    res.status(500).send("Server Error");
  }
};
//login page ne load akkan after otp
const loadlogin = async(req,res)=>{
  try {
    if(!req.session.user){
      return res.render("login")
    }
    else{
      res.redirect("/")
    }
  } catch (error) {
    res.redirect("/pageNoteFound")
  }
}
//login pagilekk render cheyth pokan
const login = async (req,res)=>{
  try {
    const {email,password}=req.body
    const findUser = await User.findOne({isAdmin:0,email:email,})
    if(!findUser){
      return res.json({status:400,success:false,message:"No user Found with this EmailId"})
    }
    if(findUser.isBlocked){
      console.log("okkk");
      
      return res.json({status:400,success:false,message:"No user Found with this EmailId"})
    }

    const passwordMatch = password===findUser.password
    if(!passwordMatch){
      return res.json({success:false,message:"password mismatch"})//No user
    }

    req.session.user = findUser;
     res.json({success:true})


  } catch (error) {
    console.error("login error",error)
    res.render("login",{message:"login failed.Please try again later..."})
  }
}
//login page nte passing prevent cheyyan



module.exports = {
  loadHomepage,
  loadShopping,
  loadSignup,
  loadlogin,
  signup,
  pageNotFound,
  loginpage,
  otp,
  resendotp,
  verifyOtp,
  login,
  logoutpage
};
