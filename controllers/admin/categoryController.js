const Category = require("../../models/categorySchema");
const mongoose = require("mongoose")

//Category page + pagination
const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};

//addCategory contro..
const addCategory = async (req, res) => {
  const { name, description, offer, offerPrice, isListed } = req.body;
  console.log(name, description,offer,offerPrice,isListed);

  try {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
      return res.status(400).json({ error: "Category Already exists" });
      }
      const newCategory = await Category.create({name,description,});
      if(newCategory)
          {
          console.log("entered",newCategory);
          return res.json({success:true, category:newCategory});
      }
  
  } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
  }
  };        

//editCategory
const editCategory = async(req,res)=>{
  try {
    const id = req.params.id;
    console.log(id)
    const category = await Category.findOne({_id:id})
    console.log(category);
    res.render("editCategory",{category:category})
  } 
  catch (error) { 
    res.redirect("/pageerror")
  }
}        


// Update category
const updateCategory = async (req, res) => {
  console.log('Update Category Controller Hit'); 
  try {
    const id = req.params.id; 
    const { name, description, offer, offerPrice } = req.body;
    console.log('Request Params:', req.params); 
    console.log("id",req.params.id)
    console.log('Request Body:', req.body); 

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    // Validate inputs
    if (!name || !description || offer === undefined || offerPrice === undefined) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    // Update the category in the database
    const updatedCategory = await Category.findByIdAndUpdate(id,{ name, description, offer, offerPrice },{ new: true })

    if (!updatedCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    console.log('Updated Category:', updatedCategory); 
    res.json({ success: true, category: updatedCategory });
  } catch (error) {
    console.error('Error updating category:', error.stack);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


module.exports = {
  categoryInfo,
  addCategory,
  editCategory,
  updateCategory
};
