const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Subscription name is required'],
        trim: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    durationMonths: {
        type: Number,
        required: [true, 'Duration in months is required'],
        min: [1, 'Duration must be at least 1 month']
    },
    applicableTabs: [{
        type: String,
        enum: ['purchase', 'selling', 'register'],
        required: true
    }],
    subscriptionType: {
        type: String,
        enum: ['single', 'combined', 'free'],
        default: 'single'
    },
    isFree: {
        type: Boolean,
        default: false
    },
    forNewUsers: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for faster queries
subscriptionSchema.index({ isActive: 1 });
subscriptionSchema.index({ subscriptionType: 1 });
subscriptionSchema.index({ isFree: 1 });
subscriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
