const mongoose = require('mongoose');

const advanceSchema = new mongoose.Schema({
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
        min: [1, 'Amount must be at least 1']
    },
    date: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'settled', 'partial'],
        default: 'pending'
    },
    settledAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

advanceSchema.index({ farmer: 1 });
advanceSchema.index({ owner: 1 });
advanceSchema.index({ date: -1 });

module.exports = mongoose.model('Advance', advanceSchema);
