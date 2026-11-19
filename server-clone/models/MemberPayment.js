const mongoose = require('mongoose');

const memberPaymentSchema = new mongoose.Schema({
    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
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
    // Selling entries that were settled with this payment
    settledEntries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SellingEntry'
    }],
    // Period for which payment is made
    periodStart: {
        type: Date
    },
    periodEnd: {
        type: Date
    },
    // Summary
    totalSellAmount: {
        type: Number,
        default: 0
    },
    // Total quantity in liters for the period (saved at time of payment)
    totalQuantity: {
        type: Number,
        default: 0
    },
    // Milk rate per liter at time of payment (saved permanently so rate changes don't affect old records)
    milkRate: {
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
    // Snapshot and audit trail for advances applied by new selling settlements.
    advanceApplied: { type: Number, default: 0, min: 0 },
    // Old payments applied advance as a deduction. New payments record 'add'.
    advanceEffect: { type: String, enum: ['add', 'subtract'], default: 'subtract' },
    settledSellingAdvances: [{
        advance: { type: mongoose.Schema.Types.ObjectId, ref: 'SellingAdvance' },
        amount: { type: Number, min: 0 }
    }],
    // Previous balance carried forward
    previousBalance: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

memberPaymentSchema.index({ owner: 1, date: -1 });
memberPaymentSchema.index({ member: 1, date: -1 });

module.exports = mongoose.model('MemberPayment', memberPaymentSchema);
