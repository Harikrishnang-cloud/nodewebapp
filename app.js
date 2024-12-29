const express = require('express')
const app = express()
const path = require('path')
const dotenv = require('dotenv').config()
const session = require('express-session')
const passport = require("./config/passport")
const db = require("./config/db")
const userRouter = require("./routes/userRouter")
const adminRouter = require('./routes/adminRouter')
db()
//Middlewares
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    // cookie:{
    //     secure:false,
    //     httpOnly:true,
        
    // } 
}))
//passport ne oru middleware akki set cheyyanam
app.use(passport.initialize())
app.use(passport.session())
app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})
//View Engine
app.set('view engine',"ejs");
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
app.use(express.static(path.join(__dirname,"public")))
app.use("/",userRouter);//request handling

//oru user undo enn check cheyyan
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

// <---------- Admin parts ---------->
app.use('/admin',adminRouter)
// app.use('/uploads',express.static('public/uploads'))

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); // For form submissions
app.use(express.json()); // For JSON payloads




app.listen(process.env.PORT,()=>{
    console.log(`server is running on the port ${4002}`)
})
module.exports = app;