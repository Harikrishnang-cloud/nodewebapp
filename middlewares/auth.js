//user-auth
const user = require("../models/userSchema")
const userAuth = (req,res,next)=>{
    // Check if it's an AJAX request
    const isAjax = req.xhr || req.headers.accept.indexOf('json') > -1;

    if(req.session.user){// user undo
        user.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){//block aayittilla engil proceed cheyyam
                next()
            }
            else{
                if (isAjax) {
                    res.status(401).json({ success: false, message: 'Please login to continue' });
                } else {
                    res.redirect("/login")
                }
            }
        }).catch(error=>{
            console.log("Error in user auth middleware")
            if (isAjax) {
                res.status(500).json({ success: false, message: 'Internal server error' });
            } else {
                res.status(500).send("Internal server error")
            }
        })
    }
    else{
        if (isAjax) {
            res.status(401).json({ success: false, message: 'Please login to continue' });
        } else {
            res.redirect("/login")
        }
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