const mongoose = require("mongoose")
const user = require("../../models/userSchema")

//customer-page data
const customerInfo = async (req, res) => {
    try {
        let search = ""; 
        if (req.query.search) {
            search = req.query.search;
        }

        let page = parseInt(req.query.page) || 1; 
        const limit = 10; 

        // Create search query
        const searchQuery = {
            isAdmin: false
        };

        if (search) {
            searchQuery.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } }
            ];
        }

        // Fetch user data with search and pagination
        const userData = await user.find(searchQuery)
            .sort({ createdAt: -1 }) 
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        // Get total count of documents matching the search
        const count = await user.countDocuments(searchQuery);

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        res.render("customers", {
            data: userData,
            currentPage: page,
            totalPages: totalPages,
            search: search,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        });

    } catch (error) {
        console.error("Error in customerInfo:", error);
        res.redirect("/admin/pageerror");
    }
};

//Blocked Customer
const customerBlocked = async(req,res)=>{
    try {
        let id = req.query.id;
        let block = req.query.block;
        await user.updateOne({_id:id}, {isBlocked:block});
        res.status(200).json({success:true, message:"user update successful"});
    } catch (error) {
        console.error("Error in customerBlocked:", error);
        res.status(500).json({success:false, message:"Failed to update user status"});
    }
};

//customer Search data
const searchCustomer = async(req,res)=>{
    try {
        const query = req.query.query.toLowerCase();
        
        const customers = await user.find({
            isAdmin: false,
            $or: [
                { fullName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } }
            ]
        }).limit(50);

        res.json({ success: true, customers });
    } catch (error) {
        console.error("Error in searchCustomer:", error);
        res.status(500).json({ success: false, message: "Search failed" });
    }
};

module.exports = {
    customerInfo,
    customerBlocked,
    searchCustomer,
};