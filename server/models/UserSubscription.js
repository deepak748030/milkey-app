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
    // Locked-in values at time of purchase (won't change if admin updates plan)
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    baseAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    // Multiplier used for purchase (1x, 2x, 3x, etc.)
    multiplier: {
        type: Number,
        default: 1,
        min: 1
    },
    // Locked-in duration info at time of purchase
    lockedDurationDays: {
        type: Number,
        min: 1
    },
    lockedDurationType: {
        type: String,
        enum: ['days', 'months', 'years']
    },
    lockedDurationValue: {
        type: Number,
        min: 1
    },
    // Locked subscription name at purchase time
    lockedSubscriptionName: {
        type: String,
        trim: true
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
userSubscriptionSchema.index({ user: 1, applicableTabs: 1, endDate: 1 });

// Virtual to check if subscription is expired
userSubscriptionSchema.virtual('isExpired').get(function () {
    return new Date() > this.endDate;
});

// Virtual to check if subscription is valid
userSubscriptionSchema.virtual('isValid').get(function () {
    return this.isActive && this.paymentStatus === 'completed' && new Date() <= this.endDate;
});

// Virtual to get effective duration display
userSubscriptionSchema.virtual('effectiveDuration').get(function () {
    const type = this.lockedDurationType || 'months';
    const value = (this.lockedDurationValue || 1) * (this.multiplier || 1);

    switch (type) {
        case 'days':
            return value === 1 ? '1 Day' : `${value} Days`;
        case 'months':
            return value === 1 ? '1 Month' : `${value} Months`;
        case 'years':
            return value === 1 ? '1 Year' : `${value} Years`;
        default:
            return `${value} Months`;
    }
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
