const mongoose = require('mongoose')
const publicationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    isListed: {
        type: Boolean,
        default: true,
        required: true,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ["Unblock", "Block"],
        default: "Unblock",
    },
}, { timestamps: true });

module.exports = mongoose.model("Publication", publicationSchema);
