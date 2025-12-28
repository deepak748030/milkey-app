const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farmer',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    date: {
        type: Date,
        default: Date.now
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'upi', 'bank', 'cheque'],
        default: 'cash'
    },
    reference: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    // Period for which payment is made
    periodStart: {
        type: Date
    },
    periodEnd: {
        type: Date
    },
    // Collections that were settled with this payment
    settledCollections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MilkCollection'
    }],
    // Advances that were deducted
    settledAdvances: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Advance'
    }],
    // Summary
    totalMilkAmount: {
        type: Number,
        default: 0
    },
    totalAdvanceDeduction: {
        type: Number,
        default: 0
    },
    netPayable: {
        type: Number,
        default: 0
    },
    // Closing balance after this payment (can be positive or negative)
    closingBalance: {
        type: Number,
        default: 0
    },
    // Previous balance carried forward
    previousBalance: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

paymentSchema.index({ owner: 1, date: -1 });
paymentSchema.index({ farmer: 1, date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
