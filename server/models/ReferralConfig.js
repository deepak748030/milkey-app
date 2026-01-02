const mongoose = require('mongoose');

const referralConfigSchema = new mongoose.Schema(
    {
        defaultCommissionRate: {
            type: Number,
            default: 5,
            min: 0,
            max: 100
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ReferralConfig', referralConfigSchema);
