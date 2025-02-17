const { json } = require("server/reply");
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
    res.redirect("/pageError");
  }
};

//addCategory contro..
const addCategory = async (req, res) => {
  const { name, description, isListed } = req.body;
  console.log("cat. add aayi :",name, description,isListed);

  try {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
      return res.status(400).json({ error: "Category Already exists" });
      }
      const newCategory = await Category.create({name,description,isListed});
      if(newCategory){
          console.log("entered",newCategory);
          return res.status(200).json({success:true, category:newCategory});
      }
  } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
  }
};        

//editCategory
const editCategory = async(req,res)=>{
  try {
    const id = req.params.id;
    const category = await Category.findOne({_id:id})
    res.render("editCategory",{category:category})
  } 
  catch (error) { 
    console.log(error)
    res.redirect("/pageError")
  }
}        


// Update category
const updateCategory = async (req, res) => {
  console.log('Update Category Controller Hit'); 
  try {
    const id = req.params.id; 
    const { name, description, offer } = req.body;
    console.log('Request Params:', req.params); 
    console.log("id",req.params.id)
    console.log('Request Body:', req.body); 

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }
    if (!name || !description ) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    // Update the category in the database
    const updatedCategory = await Category.findByIdAndUpdate(id,{ name, description, offer },{ new: true })

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

//Update Category-Status
const updateCategoryStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const isListed  = JSON.parse(req.body.isListed);
    console.log(id, typeof isListed);
    
    const update = await Category.updateOne({ _id: id }, { $set: { isListed: !isListed } });
    console.log(update);
    
    if (update.modifiedCount > 0) {
      return res.status(200).json({ success: true, message: 'Category status updated successfully' });
    } else {
      return res.status(400).json({ success: false, message: 'Failed to update category status' });
    }
  } catch (error) {
    console.error('Error updating category status:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Check if category name exists
const checkCategoryName = async (req, res) => {
    try {
        const name = req.query.name;
        console.log("change name ill vannu",name);
        
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        res.json({ exists: !!existingCategory });
    } catch (error) {
        console.error('Error checking category name:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
  categoryInfo,
  addCategory,
  editCategory,
  updateCategory,
  updateCategoryStatus,
  checkCategoryName
};
