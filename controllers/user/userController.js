const User = require("../../models/userSchema");
const otpModel = require("../../models/otpSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const userHelper = require('../../helpers/userHelper')
const bcrypt = require('bcrypt')
const Books = require("../../models/productSchema")
const { redirect } = require("server/reply");
const productHelper = require('../../helpers/productHelper')
const Cart = require("../../models/cartSchema");

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
    console.log("validotp", validotp)
    if (validotp == userOtp) {
      console.log(req.session.userData)
      const hashpass = await bcrypt.hash(req.session.userData.password, 10)
      userHelper.createUser({ ...req.session.userData, password: hashpass })
        .then((response) => {
          res.json({ success: true })
        }).catch((error) => {
          console.log(error.message);

          res.json({ success: false })
        })
    }
    else {
      res.json({ success: false })
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
  const { fullName, email, phone, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // console.log("Email already registered.");
      // return res.render("signup", { message: "Email already registered." });
      return res.status(400).send("Email already registered.");
    }

    // Generate OTP
    const otp = generateOtp();
    console.log("otp");

    const emailSent = await sendVerificationEmail(email, otp);
    console.log("email,send", emailSent);

    if (!emailSent) {
      // return res.render("signup", { message: "Failed to send OTP.please try again." })
      return res.status(500).send("Failed to send OTP.please try again.");
    }
    if (emailSent) {
      // const res = await otpModel.create({ 
      //   email: email,
      //   otp: otp,
      // });
      req.session.singupotp = otp;
      // console.log("otp",otp);
      console.log(`Mail send to ${email} otp is ${otp}`);

    }
    console.log(req.body);

    req.session.userOtp = otp;
    req.session.userData = req.body;

    // return res.render("otp", { message: "OTP sent to your email" });
    return res.status(200).send("OTP sent to your email");
  } catch (error) {
    console.error("Error during signup process:", error.message);
    res.redirect("/pageNotFound");
  }
};

// Load Signup Page
const loadSignup = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect('/')
    }
    else {
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
    const page = 1; // Default to first page
    const limit = 9; // Products per page
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments({ isListed: true });
    const totalPages = Math.ceil(totalProducts / limit);

    const productsList = await Product.find({ isListed: true })
      .populate('category')
      .skip(skip)
      .limit(limit);

    const categoriesList = await Category.find({ isListed: true });

    res.render("shop", {
      products: productsList,
      categories: categoriesList,
      user: req.session.user || null,
      currentPage: page,
      totalPages: totalPages
    });

  } catch (error) {
    console.error("Shopping page not loading:", error);
    res.status(500).send("Server Error");
  }
};

//resend otp
const resendotp = async (req, res) => {
  try {
    console.log("resend otp")
    console.log("session", req.session.userData)
    if (req.session.userData && req.session.userData.email) {
      console.log("generating otp")
      const otp = generateOtp();
      console.log(req.session.userData.email, otp);
      const emailSent = await sendVerificationEmail(
        req.session.userData.email, otp
      );
      console.log(emailSent);
      return res.status(200).send("OTP resent successfully!");
    }
    else {
      return res.status(404).send("User not found")
    }
  } catch (error) {
    res.status(500).send("Server Error");
    console.log("resendOtp is error", error);
  }
};

// Load Homepage
const loadHomepage = async (req, res) => {
  // console.log("Session", req.session.user)
  try {
    const userbooks = await Books.aggregate([
      { $match: { status: "Unblock" } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "cat"
        }
      },
      { $unwind: "$cat" },
      { $limit: 5 }
    ])
      .limit(5)
      
    console.log("home books ", userbooks)
    const categoryBooks = await Category.aggregate([
      { $match: { isListed: true } },
      { $limit: 4 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products"
        }
      },
      {
        $addFields: {
          products: {
            $filter: {
              input: "$products",
              as: "product",
              cond: { $eq: ["$$product.status", "Unblock"] }
            }
          }
        }
      },
      { $addFields: { topProducts: { $slice: ["$products", 5] } } },
      {
        $project: {
          products: 0
        }
      }
    ]);
    const response = await productHelper.productOfferCalculate(userbooks)

    res.render("home", {
      user: req.session.user,
      book: userbooks,
      cats: categoryBooks
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
    req.session.user = null//session distroy
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
const loadlogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login")
    }
    else {
      res.redirect("/")
    }
  } catch (error) {
    res.redirect("/pageNoteFound")
  }
}

//login pagilekk render cheyth pokan
const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const findUser = await User.findOne({ isAdmin: 0, email: email, })
    if (!findUser) {
      return res.json({ status: 400, success: false, message: "No user Found with this EmailId" })
    }
    if (findUser.isBlocked) {
      console.log("okkk");

      return res.json({ status: 400, success: false, message: "No user Found with this EmailId" })
    }

    const passwordMatch = bcrypt.compare(password, findUser.password)
    if (!passwordMatch) {
      return res.json({ success: false, message: "password mismatch" })//No user
    }

    req.session.user = findUser;
    res.json({ success: true })


  } catch (error) {
    console.error("login error", error)
    res.render("login", { message: "login failed.Please try again later..." })
  }
}

//login page nte passing prevent cheyyan
const productDetails = async (req, res) => {
  try {
    const productId = req.query.id
    console.log("product", productId)
    const productData = await Product.findOne({ _id: productId })
    console.log(productData)
    res.render('productDetails', { data: productData, user: req.session.user })
  } catch (err) {
    console.log(err)
  }
}

//load userProfile

const userProfile = async (req, res) => {
  try {
    console.log(req.session.user)
    res.render('userProfile', { user: req.session.user })

  } catch (error) {
    console.log(error)
  }
}

//Update profile controller
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;
    console.log("Request body", req.body);

    if (!fullName || !email || !phone) {
      return res.status(400).json({ status: 'error', message: 'All fields are required.', });
    }
    const id = req.session.user._id;
    console.log(id)
    // Find the user and update
    const updatedUser = await User.findByIdAndUpdate(id, { fullName, email, phone }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.', });
    }

    return res.status(200).json({
      status: 'success', message: 'Profile updated successfully!',
      user: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
    return res.redirect('/userProfile')
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error.', });
  }
};

//update Password
const updatePass = async (req, res) => {
  try {
    console.log("This is req", req.body)
    const { CurrentPassword, newPassword, } = req.body;
    const user = await User.findOne({ _id: req.session.user._id })
    console.log("user", user)
    const isPasswordMatch = await bcrypt.compare(CurrentPassword, user.password)
    if (isPasswordMatch === false) {
      return res.status(400).json({ success: false, message: "OLd password is incorrect" })
    } else {
      console.log("this is pass ", newPassword)
      user.password = await bcrypt.hash(newPassword, 10)
      user.save()
      return res.status(200).json({ success: true, message: "Password updated succefuly" })
    }
  } catch (error) {
    console.log(error)
  }
}

//load user Address
const userAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id).populate('address');
    if (!user) {
      return res.status(404).send('User not found');
    }
    const cart = await Cart.findOne({ userId: req.session.user._id });
    const hasItems = cart && cart.books && cart.books.length > 0;
    
    res.render('userAddress', { 
      user,
      hasItems
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Server Error');
  }
};

// add new address
const addAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const newAddress = {
      fullName: req.body.fullName,
      street: req.body.street,
      city: req.body.city,
      state: req.body.state,
      pinCode: req.body.pinCode,
      phone: req.body.phone
    };

    await User.findByIdAndUpdate(userId, { $push: { address: newAddress } }, { new: true });
    res.redirect('/userAddress');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

// edit address
const editAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressIndex = req.body.index;
    const updatedAddress = {
      fullName: req.body.fullName,
      street: req.body.street,
      city: req.body.city,
      state: req.body.state,
      pinCode: req.body.pinCode,
      phone: req.body.phone
    };

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User is not found');
    }

    if (!user.address) {
      user.address = [];
    }

    user.address[addressIndex] = updatedAddress;
    await user.save();

    res.redirect('/userAddress');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

// delete address
const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressIndex = req.body.index;
    const addressId = req.body.id;

    const response = await User.findByIdAndUpdate(userId, { $pull: { address: { _id: addressId } } }, { new: true });
    console.log(response)
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

//edit profile
const editProfile = async (req, res) => {
  try {
    res.render('editProfile', { user: req.session.user })

  } catch (error) {
    console.log(error)
  }
}



//shop page controller
const getShopPage = async (req, res) => {
  try {
    const page = parseInt(req.params.page) || 1;
    const limit = 9; // Products per page
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments({ isListed: true });
    const totalPages = Math.ceil(totalProducts / limit);

    const productsList = await Product.find({ isListed: true })
      .populate('category')
      .skip(skip)
      .limit(limit);

    const categoriesList = await Category.find({ isListed: true });

    res.render('shop', {
      products: productsList,
      categories: categoriesList,
      user: req.session.user || null,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

// Filter products controller
const filterProducts = async (req, res) => {
  try {
    const { categories, maxPrice, search, sort } = req.body;

    // Build the filter query
    let query = { isListed: true };

    // Add category filter
    if (categories && categories.length > 0) {
      query.category = { $in: categories };
    }

    // Add price filter
    if (maxPrice) {
      query.salePrice = { $lte: parseFloat(maxPrice) };
    }

    // Add search filter
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build the sort query
    let sortQuery = {};
    switch (sort) {
      case 'featured':
        sortQuery = { isFeatured: -1, createdAt: -1 };
        break;
      case 'rating':
        sortQuery = { averageRating: -1 };
        break;
      case 'new_arrivals':
        sortQuery = { createdAt: -1 };
        break;
      case 'popularity':
        sortQuery = { purchaseCount: -1 };
        break;
      case 'price_asc':
        sortQuery = { salePrice: 1 };
        break;
      case 'price_desc':
        sortQuery = { salePrice: -1 };
        break;
      case 'name_asc':
        sortQuery = { productName: 1 };
        break;
      case 'name_desc':
        sortQuery = { productName: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    // Execute the query
    const products = await Product.find(query)
      .populate('category')
      .sort(sortQuery)
      .lean();

    res.json({
      success: true,
      products: products
    });

  } catch (error) {
    console.error('Filter products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error filtering products'
    });
  }
};

// Search products controller
const searchProducts = async (req, res) => {
  try {
    const query = req.query.query;

    if (!query) {
      return res.json({ products: [] });
    }

    // Create a case-insensitive search regex
    const searchRegex = new RegExp(query, 'i');

    // Search in product name and description
    const products = await Product.find({
      $or: [
        { productName: { $regex: searchRegex } },
        { description: { $regex: searchRegex } }
      ]
    });

    res.json({ products });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
};

// Forgot Password Controller
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Generate OTP
    const otp = generateOtp();
    console.log("otp is : ", otp);

    // Save OTP to session
    req.session.resetPasswordOtp = {
      email,
      otp,
      timestamp: Date.now()
    };

    // Send OTP via email
    await sendVerificationEmail(email, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request'
    });
  }
};

// Reset Password Controller
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Verify OTP
    if (!req.session.resetPasswordOtp ||
      req.session.resetPasswordOtp.email !== email ||
      req.session.resetPasswordOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check OTP expiry (10 minutes)
    const otpAge = Date.now() - req.session.resetPasswordOtp.timestamp;
    if (otpAge > 10 * 60 * 1000) {
      delete req.session.resetPasswordOtp;
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Clear the OTP from session
    delete req.session.resetPasswordOtp;

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};
//about page
const about = async (req, res) => {
  try {
    const user = req.session.user;
    res.render('about', { user });
  } catch (error) {
    console.error('Error in about page:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

//get contact page
const contact = async (req, res) => {
  try {
    const user = req.session.user;
    res.render('contact', { user, message: null });
  } catch (error) {
    console.error('Error in contact page:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};
//Contact page submit
const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const user = req.session.user;

    res.render('contact', { 
      user,
      message: {
        type: 'success',
        text: 'Thank you for your message! We will get back to you soon.'
      }
    });
  } catch (error) {
    console.error('Error in contact form submission:', error);
    res.render('contact', { 
      user: req.session.user,
      message: {
        type: 'error',
        text: 'There was an error sending your message. Please try again.'
      }
    });
  }
};

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
  logoutpage,
  productDetails,
  userProfile,
  updateProfile,
  updatePass,
  userAddress,
  editProfile,
  addAddress,
  editAddress,
  deleteAddress,
  getShopPage,
  filterProducts,
  searchProducts,
  forgotPassword,
  resetPassword,
  about,
  contact,
  submitContact
};
