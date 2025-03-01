const adminModel = require('../../models/adminSchema')
const mongoose = require("mongoose")
const bcrypt = require('bcrypt')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Publication = require('../../models/publicationSchema')
const Wallet = require('../../models/walletSchema')


//page-error controller --->
const pageError = async (req, res) => {
    try {
        const errorMessage = req.query.error || 'An error occurred';
        const statusCode = req.query.status || 500;
        res.status(statusCode).render("page-404", {error: errorMessage,status: statusCode,layout: 'admin-layout'});
    } catch (error) {
        console.error('Error in admin error page:', error);
        res.status(500).send('Internal Server Error');
    }
};

// login-page load --->
const loadLogin = (req,res)=>{
    if(req.session.admin){
      return res.redirect("/admin/dashboard")
    }else{
      res.render("adminlogin",{message:null})
    }
}

// dashboard load ->
const loaddashboard = async (req, res) => {
  try {
    if (req.session.admin) {
      // Fetch top 10 products
      const topProducts = await Order.aggregate([{ $unwind: "$items" },
        {
          $group: {_id: "$items.product",totalSold: { $sum: "$items.quantity" }}
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {$lookup: {from: "products",localField: "_id",foreignField: "_id",as: "productDetails"}},
        {
          $project: {
            name: { $arrayElemAt: ["$productDetails.productName", 0] },
            sales: "$totalSold"
          }
        }
      ]);


      // Fetch top 10 categories
      const topCategories = await Order.aggregate([{ $unwind: "$items" },
        {$lookup: {from: "products",localField: "items.product",foreignField: "_id",as: "product"}},
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product.category",totalSold: { $sum: "$items.quantity" }}
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        {
          $project: {
            name: { $arrayElemAt: ["$categoryDetails.name", 0] },
            sales: "$totalSold"
          }
        }
      ]);


      // Fetch top 10 publications
      const topPublications = await Order.aggregate([
        { $unwind: "$items" },
        {$lookup: {
            from: "products",
            localField: "items.product",foreignField: "_id",as: "product"}
        },
        { $unwind: "$product" },
        {$group: {_id: "$product.publication",totalSold: { $sum: "$items.quantity" }}},
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "publications",
            localField: "_id",
            foreignField: "_id",
            as: "publicationDetails"
          }
        },
        {
          $project: {
            name: { $arrayElemAt: ["$publicationDetails.name", 0] },
            sales: "$totalSold"
          }
        }
      ]);

      // Get yearly, monthly, and weekly sales data
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const startOfWeek = new Date(currentDate.getTime() - (currentDate.getDay() * 24 * 60 * 60 * 1000));

      const salesData = {
        yearly: await getSalesData(startOfYear, 'year'),
        monthly: await getSalesData(startOfMonth, 'month'),
        weekly: await getSalesData(startOfWeek, 'week')
      };

      return res.render("dashboard", {
        topProducts,
        topCategories,
        topPublications,
        salesData: JSON.stringify(salesData)
      });
    }
  } catch (error) {
    console.log("dashboard cannot load", error);
    res.redirect("/admin/pageerror");
  }
}

// Helper function to get sales data
async function getSalesData(startDate, period) {
  try {
    const match = { createdAt: { $gte: startDate } };
    let groupBy = {};
    let labels = [];

    if (period === 'year') {
      groupBy = {
        year: { $year: "$createdAt" }
      };
      const years = [2023, 2024, 2025];
      labels = years.map(year => year.toString());
    } else if (period === 'month') {
      groupBy = {
        month: { $month: "$createdAt" }
      };
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    } else if (period === 'week') {
      groupBy = {
        dayOfWeek: { $dayOfWeek: "$createdAt" }
      };
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    }

    const salesData = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    return {
      labels,
      data: labels.map(label => {
        const sale = salesData.find(s => {
          if (period === 'year') return s._id.year.toString() === label;
          if (period === 'month') return labels[s._id.month - 1] === label;
          if (period === 'week') return `Week ${Math.ceil(s._id.dayOfWeek / 7)}` === label;
        });
        return sale ? sale.totalSales : 0;
      })
    };
  } catch (error) {
    console.error('Error getting sales data:', error);
    return { labels: [], data: [] };
  }
}

//admin validation ->
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);
    const admindata = await User.findOne({ email: email });

    if (admindata) {
      if(!admindata.isAdmin)return res.status(400).json({success:true, message:"You are not an admin"})

        const isPasswordMatch = await bcrypt.compare(admindata.password, password)
      if (isPasswordMatch) {
        req.session.admin = admindata._id + "";
        return res.status(200).json({ success: true, message: "Admin login successful" });
      } 
      else 
      {
        return res.status(401).json({ success: false, message: "Incorrect password" });
      }
    } 
    else {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
  } 
  catch (error) {
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

// Handle return approval
const handleReturnApproval = async (req, res) => {
    try {
        const { orderId, itemId, action } = req.body;
        console.log('Processing return approval:', { orderId, itemId, action });
        
        const order = await Order.findById(orderId);
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        console.log('Found order:', {
            orderId: order._id,
            userId: order.userId,
            items: order.items.length
        });

        const item = order.items.id(itemId);
        if (!item) {
            console.log('Item not found in order:', itemId);
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }
        console.log('Found item:', {
            itemId: item._id,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price
        });

        if (action === 'approve') {
            // Update return status to Approved
            item.returnStatus = 'Approved';
            
            // Restore product quantity
            const product = await Product.findById(item.product);
            if (product) {
                console.log('Before quantity update:', {
                    productId: product._id,
                    currentQuantity: product.Quantity,
                    returnQuantity: item.quantity
                });
                
                product.Quantity += item.quantity;
                await product.save();
                
                console.log('After quantity update:', {
                    productId: product._id,
                    newQuantity: product.Quantity
                });
            } else {
                console.log('Product not found:', item.product);
            }

            // Calculate refund amount
            let refundAmount = item.price * item.quantity;
            
            console.log('Calculated refund amount:', refundAmount);

            try {
                const userwallet = await Wallet.findOne({ userId: order.userId });
                if(!userwallet){
                  let wallet = await Wallet.create({
                    userId: order.userId,
                    balance: 0,
                    transactions: []
                  });
                  wallet.balance += refundAmount;
                  wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    description: `Refund for returned item: ${item.productName}`,
                    orderId: order._id,
                    date: new Date()
                  });
                  await wallet.save();
                }
                else{
                  userwallet.balance += refundAmount;
                  userwallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    description: `Refund for returned item: ${item.productName}`,
                    orderId: order._id,
                    date: new Date()
                  });
                  await userwallet.save();
                }
               

            } catch (walletError) {
                console.error('Error updating wallet:', walletError);
                return res.status(500).json({ success: false, message: 'Error updating wallet: ' + walletError.message });
            }

            // Add refund information to order item
            item.refundInfo = {
                status: 'Processed',
                amount: refundAmount,
                date: new Date()
            };
        } else if (action === 'reject') {
            item.returnStatus = 'Rejected';
            item.rejectionReason = req.body.rejectionReason || 'Return request rejected by admin';
        }

        await order.save();
        console.log('Order updated successfully:', {
            orderId: order._id,
            itemId: item._id,
            newStatus: item.returnStatus
        });
        
        res.json({
            success: true,
            message: `Return request ${action}ed successfully`,
            returnStatus: item.returnStatus
        });
    } catch (error) {
        console.error('Error handling return approval:', error);
        res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
    }
}; 

module.exports = {
    loadLogin,
    loaddashboard,
    adminLogin,
    logout,
    pageError,
    handleReturnApproval
};