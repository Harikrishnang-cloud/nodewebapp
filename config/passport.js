const passport = require('passport')
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config()

passport.use(
    new GoogleStrategy(
        {
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:"/auth/google/callback",
    scope:["profile","email"],
},

async (accessToken,refreshToken,profile,done)=>{
    try{
        console.log("AccessToken:",accessToken)
        console.log("profile:",profile)

        let user = await User.findOne({googleId:profile.id})
        if(user)
        {
            console.log("User found:",user)
            return done(null,user)
        }
        else
        {
             console.log(profile)
            user = new User({
                fullName:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id
            })
            await user.save()
            console.log("User saved:",user)
            return done(null,user)
        }
    }
    catch(err)
    {
        console.log("Error in google OAuth strategy",err)
        return done(err,null)
    }
}
))

//Eni serialize cheyyanam//
passport.serializeUser((user,done)=>{
    done(null,user.id)
})
//evide deseralize-user cheyyanam-------> session ill ninn user data fetch cheyth edukkan aanu
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport