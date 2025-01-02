const mongoose = require("mongoose")
const user = require("../../models/userSchema")

//customer Search data

const searchCustomer = async(req,res)=>{
    let query = req.query.query.toLowerCase();
    try {
        console.log(query);
        
        let customers = await Customer.find({$or:[{fullName:{regex:query,$options:'i'}},
            {email:{regex:query,$options:'i'}},
            {phone:{regex:query,$options:'i'}}
        ]})
        res.json(customers)
        console.log(customers)
    } catch (error) {
        res.send(500).json({success:false, message:"search failed"})
    }
}

//customer-page data
const customerInfo = async (req, res) => {
    try {
        let search = ""; // For the search bar
        if (req.query.search) {
            search = req.query.search;
        }

        let page = parseInt(req.query.page) || 1; // Current page, default to 1
        const limit = 6; // Number of records per page

        // Fetch user data with search and pagination
        const userData = await user.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        // Get total count of documents matching the search
        const count = await user.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        });

        const totalPages = Math.ceil(count / limit); // Calculate total pages

        // Render the view with the required data
        res.render("customers", {
            data: userData,
            currentPage: page,
            totalPages,
            searchQuery: search,
        });
    } catch (error) {
        console.error("Error fetching customer data:", error);
        res.status(500).send("Internal Server Error");
    }
};


//Blocked Customer
const customerBlocked = async(req,res)=>{
    try {
      let id = req.query.id;
      console.log(typeof(id))
      let block = req.query.block 
      console.log(block)
      await user.updateOne({_id:id},{isBlocked:block})
      
      
      res.status(200).json({success:true, message:"user update successful"})
    } catch (error) {
      res.redirect("/pageerror")
    }
  }
  
module.exports = {
    customerInfo,
    customerBlocked,
    searchCustomer,
}