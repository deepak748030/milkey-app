const mongoose = require('mongoose');

const milkCollectionSchema = new mongoose.Schema({
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
    fat: {
        type: Number,
        min: 0,
        max: 15,
        default: 0
    },
    snf: {
        type: Number,
        min: 0,
        max: 15,
        default: 0
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
milkCollectionSchema.pre('save', function (next) {
    this.amount = this.quantity * this.rate;
    next();
});

// Indexes for faster queries
milkCollectionSchema.index({ owner: 1, date: -1 });
milkCollectionSchema.index({ farmer: 1, date: -1 });
milkCollectionSchema.index({ owner: 1, farmer: 1, isPaid: 1 });

module.exports = mongoose.model('MilkCollection', milkCollectionSchema);
