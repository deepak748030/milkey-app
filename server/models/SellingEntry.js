const mongoose = require('mongoose');

const sellingEntrySchema = new mongoose.Schema({
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
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    shift: {
        type: String,
        enum: ['morning', 'evening'],
        required: true
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.1, 'Quantity must be at least 0.1 liters']
    },
    rate: {
        type: Number,
        required: [true, 'Rate is required'],
        min: [0, 'Rate cannot be negative']
    },
    amount: {
        type: Number,
        required: true
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

// Pre-save to calculate amount
sellingEntrySchema.pre('save', function (next) {
    this.amount = this.quantity * this.rate;
    next();
});

// Indexes for faster queries
sellingEntrySchema.index({ owner: 1, date: -1 });
sellingEntrySchema.index({ member: 1, date: -1 });
sellingEntrySchema.index({ owner: 1, member: 1, isPaid: 1 });

module.exports = mongoose.model('SellingEntry', sellingEntrySchema);
