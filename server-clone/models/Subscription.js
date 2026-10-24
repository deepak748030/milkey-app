const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Subscription name is required'],
        trim: true
    },
    amount: {
        type: Number,
        default: 0,
        min: [0, 'Amount cannot be negative']
    },
    durationDays: {
        type: Number,
        required: [true, 'Duration in days is required'],
        min: [1, 'Duration must be at least 1 day']
    },
    durationType: {
        type: String,
        enum: ['days', 'months', 'years'],
        default: 'months'
    },
    durationValue: {
        type: Number,
        default: 1
    },
    // Keep for backward compatibility
    durationMonths: {
        type: Number,
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save hook to calculate subscriptionType
subscriptionSchema.pre('save', function (next) {
    if (this.isFree) {
        this.subscriptionType = 'free';
        this.amount = 0;
    } else if (this.applicableTabs && this.applicableTabs.length > 1) {
        this.subscriptionType = 'combined';
    } else {
        this.subscriptionType = 'single';
    }
    next();
});

// Indexes for faster queries
subscriptionSchema.index({ isActive: 1 });
subscriptionSchema.index({ subscriptionType: 1 });
subscriptionSchema.index({ isFree: 1 });
subscriptionSchema.index({ forNewUsers: 1 });
subscriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
