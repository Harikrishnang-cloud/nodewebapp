const publication = require('../../models/publicationSchema')


// Publication Details with Pagination
const publicationInfo = async (req, res) => {
    try {
        const limit = 6; 
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit; 
        const totalPublications = await publication.countDocuments(); 
        const publications = await publication.find().skip(skip).limit(limit); 

        const totalPages = Math.ceil(totalPublications / limit); 

        res.render("publication", {
            publications,
            currentPage: page,
            totalPages,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
//add Publication
const addPublication = async(req,res)=>{
    try {
        let publications = new publication(req.body)
        await publications.save();
        res.status(201).json({publication:publications,message:"Publication added Scucessfully"})
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

// Check if publication name exists
const checkPublicationName = async (req, res) => {
    try {
        const name = req.query.name;
        const existingPublication = await publication.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        res.json({ exists: !!existingPublication });
    } catch (error) {
        console.error('Error checking publication name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    publicationInfo,
    addPublication,
    updatePublication,
    editPublication,
    postEditPublication,
    checkPublicationName
}