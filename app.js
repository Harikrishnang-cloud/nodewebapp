const express = require('express')
const app = express()
const path = require('path')
const dotenv = require('dotenv').config()
const session = require('express-session')
const passport = require("./config/passport")
const db = require("./config/db")
const userRouter = require("./routes/userRouter")
const adminRouter = require('./routes/adminRouter')
const authRoutes = require('./routes/authRoutes')
const { checkBlockedStatus } = require('./middlewares/authMiddleware')
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
app.use(session({
    secret: 'your_session_secret',
    resave: false,
    saveUninitialized: false
}));
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

//oru user undo enn check cheyyan
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Check if user is blocked before all routes except login/signup
app.use((req, res, next) => {
    // Skip check for login, signup, and auth routes
    if (req.path === '/login' || 
        req.path === '/signup' || 
        req.path.startsWith('/auth/') || 
        req.path === '/logout') {
        return next();
    }
    checkBlockedStatus(req, res, next);
});

app.use("/",userRouter);//request handling

// <---------- Admin parts ---------->
app.use('/admin',adminRouter)
app.use('/uploads', express.static(path.join(__dirname, 'controllers/public/uploads')));
app.use('/auth', authRoutes);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 


app.listen(process.env.PORT,()=>{
    console.log(`server is running on the port ${4002}`)
})
module.exports = app;