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
const customerInfo = async(req,res)=>{
    try {
        let search = "";//oru search bar vakkunnund.
        if(req.query.search){
            search = req.query.search;
        }
        console.log("A");
        
        let page = 1;//pagination ne vendi. initially 1 akki set cheyyam
        if(req.query.page){
            page = req.query.page
        }
        const limit=5
        const userData = await user.find({
            isAdmin:false,
            $or:[

                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()//chain of promise ne combine cheyyan vendi

        const count = await user.find({
            isAdmin:false,
            $or:[

                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        }).countDocuments()
        res.render("customers",{data:userData})

    } catch (error) {
        
    }
}

//Blocked Customer
const customerBlocked = async(req,res)=>{

    // console.log("hi") 
    try {
      let id = req.query.id;
      console.log(typeof(id))
      let block = req.query.block
      await user.updateOne({_id:id},{isBlocked:block})
      
      res.status(200).json({message:"user update successful"})
    } catch (error) {
      res.redirect("/pageerror")
    }
  }
  
module.exports = {
    customerInfo,
    customerBlocked,
    searchCustomer,
}