//user-auth
const user = require("../models/userSchema")
const userAuth = (req,res,next)=>{
    if(req.session.user){// user undo
        user.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){//block aayittilla engil proceed cheyyam
                next()
            }
            else{
                res.redirect("/login")
            }
        }).catch(error=>{
            console.log("Error in user auth middleware")
            res.status(500).send("Internal server error")
        })
    }
    else{
        res.redirect("/login")
    }
}

const adminAuth = (req,res,next)=>{
    if(req.session.admin){
        next()
    }
    else{
        res.redirect("/admin/login")
    }
}

module.exports = {
    userAuth,
    adminAuth
}