const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [1, 'Amount must be at least 1']
    },
    paymentMethod: {
        type: String,
        enum: ['upi', 'bank'],
        required: [true, 'Payment method is required']
    },
    upiId: {
        type: String,
        default: ''
    },
    bankDetails: {
        accountNumber: {
            type: String,
            default: ''
        },
        ifscCode: {
            type: String,
            default: ''
        },
        accountHolderName: {
            type: String,
            default: ''
        },
        bankName: {
            type: String,
            default: ''
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending'
    },
    adminNote: {
        type: String,
        default: ''
    },
    processedAt: {
        type: Date
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
