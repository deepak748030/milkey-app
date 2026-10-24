const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referred: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    code: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'expired'],
        default: 'pending'
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    commissionRate: {
        type: Number,
        default: 5 // 5% commission
    }
}, {
    timestamps: true
});

referralSchema.index({ referrer: 1 });
referralSchema.index({ referred: 1 });

module.exports = mongoose.model('Referral', referralSchema);
