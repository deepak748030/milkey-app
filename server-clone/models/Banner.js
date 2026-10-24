const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    subtitle: {
        type: String,
        trim: true,
        default: ''
    },
    image: {
        type: String,
        required: true
    },
    badge: {
        type: String,
        trim: true,
        default: ''
    },
    gradient: {
        type: [String],
        default: ['#22C55E', '#16A34A']
    },
    linkType: {
        type: String,
        enum: ['category', 'product', 'url', 'none'],
        default: 'category'
    },
    linkValue: {
        type: String,
        default: ''
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

// Index for efficient queries
bannerSchema.index({ isActive: 1, order: 1 });
bannerSchema.index({ title: 'text' });

module.exports = mongoose.model('Banner', bannerSchema);
