const userModel = require('../models/userSchema')
const createUser = (bodyData)=>{
    
    
    return new Promise(async(resolve,reject)=>{
        if(!bodyData){
            reject(false)
        }
        const userCreated = await userModel.create({
            fullName : bodyData.fullName,
            email : bodyData.email,
            phone : bodyData.phone,
            password : bodyData.password
        })
        console.log("usercreated",userCreated);
        
        if(userCreated._id){
            resolve(true)
        }
        else{
            reject(false)
        }
    })
}

module.exports ={ 
    createUser
}