const mongoose = require('mongoose');

const socialLinkSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true,
        trim: true
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

socialLinkSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('SocialLink', socialLinkSchema);
