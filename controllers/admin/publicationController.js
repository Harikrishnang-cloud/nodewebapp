const publication = require('../../models/publicationSchema')



//publication-Details
const publicationInfo = async (req,res)=>{
    try {
        
        const publications = await publication.find();
        res.render("publication",{publications})
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
//add Publication
const addPublication = async(req,res)=>{
    try {
        let publications = new publication(req.body)
        await publications.save();
        res.status(201).json(publication,{message:"Publication added Scucessfully"})
    } catch (err) {
        res.status(400).json({error:err.message})
    }
}
//update Publication
const updatePublication = async(req,res)=>{
    console.log("hi");
    
    try {
       
        await publication.findByIdAndUpdate(req.params.id, req.body, { new: true })
        res.status(202).json({ 
            publication: updatePublication,message: "Publication updated successfully" 
        });
        res.redirect("/admin/publication");
    } catch (err) {
        res.status(400).json({error:err.message})
    }
}

//edit-Publication page
const editPublication = async(req,res)=>{
    try {
      publication.findByIdAndUpdate(req.params.id,
            { 
                name: req.body.name,
                isListed: req.body.isListed === "true" 
            },{ new: true }).then((data)=>
                {
                res.render("editPublication",{publication:data})//promise
            })
          
    } catch (err) {
        res.status(400).json({error:err.message})
    }
}
//POST Edit Publication page
const postEditPublication = async(req,res)=>{
    try {
        let data = req.body;
        console.log(data);
        
        let pub = await publication.findById(req.params.id);
        pub.name = data.name;
        pub.isListed = data.isListed
        await pub.save();
        res.redirect("/admin/publication")
        
    } catch (error) {
        console.log(error.message);
        
        res.status(400).json({error:err.message})
    }
}


//blockUnBlock publications
// const blockUnBlock = async (req, res) => {
//     try {
//         const id = req.params.id;
//         const publication = await Publication.findById(id); 
//         if (!publication) {
//             return res.status(404).json({ message: "Publication not found" });
//         }

//         publication.status = publication.status === "Unblock" ? "Block" : "Unblock";
//         await publication.save();

//         res.status(200).json({
//             message: `Publication status updated to ${publication.status}`,
//             status: publication.status,
//         });
//     } catch (error) {
//         console.error("Error toggling publication status:", error);
//         res.status(500).json({ message: "Internal Server Error" });
//     }
// };




module.exports = {
    publicationInfo,
    addPublication,
    updatePublication,
    editPublication,
    postEditPublication,
    
}