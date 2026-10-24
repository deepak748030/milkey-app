const mongoose = require('mongoose');

const adPopupSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        required: true
    },
    // optional description / subtitle
    subtitle: {
        type: String,
        trim: true,
        default: ''
    },
    linkType: {
        type: String,
        enum: ['none', 'url', 'product', 'category'],
        default: 'none'
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

adPopupSchema.index({ isActive: 1, order: 1 });
adPopupSchema.index({ title: 'text' });

module.exports = mongoose.model('AdPopup', adPopupSchema);
