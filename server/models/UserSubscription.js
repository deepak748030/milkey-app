const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        required: true
    },
    applicableTabs: [{
        type: String,
        enum: ['purchase', 'selling', 'register']
    }],
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    isFree: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'upi', 'bank', 'free'],
        default: 'cash'
    },
    transactionId: {
        type: String,
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
userSubscriptionSchema.index({ user: 1, isActive: 1 });
userSubscriptionSchema.index({ user: 1, endDate: 1 });
userSubscriptionSchema.index({ subscription: 1 });

// Virtual to check if subscription is expired
userSubscriptionSchema.virtual('isExpired').get(function () {
    return new Date() > this.endDate;
});

// Virtual to check if subscription is valid
userSubscriptionSchema.virtual('isValid').get(function () {
    return this.isActive && this.paymentStatus === 'completed' && new Date() <= this.endDate;
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
