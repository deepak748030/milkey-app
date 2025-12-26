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
        min: [1, 'Amount must be at least 1']
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
    // Selling entries that were settled with this payment
    settledEntries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SellingEntry'
    }],
    // Summary
    totalSellAmount: {
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

memberPaymentSchema.index({ owner: 1, date: -1 });
memberPaymentSchema.index({ member: 1, date: -1 });

module.exports = mongoose.model('MemberPayment', memberPaymentSchema);
