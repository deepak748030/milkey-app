const mongoose = require('mongoose');

const milkCollectionSchema = new mongoose.Schema({
    purchaseFarmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseFarmer',
        required: false,
        default: null
    },
    milkType: {
        type: String,
        enum: ['cow', 'buffalo'],
        default: 'buffalo'
    },
    farmerCode: {
        type: String,
        trim: true,
        default: ''
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
    // Bonus snapshot at entry time (only when Rate Setting > Bonus is ON).
    // baseAmount = quantity * rate (milk value), bonusAmount = extra given.
    baseAmount: {
        type: Number,
        default: 0
    },
    bonusAmount: {
        type: Number,
        default: 0
    },
    bonusType: {
        type: String,
        enum: ['perLitre', 'percent', ''],
        default: ''
    },
    bonusRate: {
        type: Number,
        default: 0
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
    // Milk value. Bonus (Rate Setting > Bonus ON) is added on top when present,
    // otherwise amount stays exactly quantity * rate as before.
    const base = parseFloat((this.quantity * this.rate).toFixed(2));
    this.baseAmount = base;
    const bonus = Number.isFinite(this.bonusAmount) && this.bonusAmount > 0 ? this.bonusAmount : 0;
    this.amount = parseFloat((base + bonus).toFixed(2));
    next();
});

// Indexes for faster queries
milkCollectionSchema.index({ owner: 1, date: -1 });
milkCollectionSchema.index({ purchaseFarmer: 1, date: -1 });
milkCollectionSchema.index({ owner: 1, purchaseFarmer: 1, isPaid: 1 });

module.exports = mongoose.model('MilkCollection', milkCollectionSchema);
