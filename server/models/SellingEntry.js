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
    // Stored as a date (normalized to start-of-day by the API)
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    morningQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Morning quantity cannot be negative']
    },
    eveningQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Evening quantity cannot be negative']
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

// Pre-validate to calculate amount (so required validation passes)
sellingEntrySchema.pre('validate', function (next) {
    const morning = Number(this.morningQuantity || 0);
    const evening = Number(this.eveningQuantity || 0);

    this.morningQuantity = morning;
    this.eveningQuantity = evening;
    this.amount = (morning + evening) * Number(this.rate || 0);

    next();
});

// Indexes for faster queries
sellingEntrySchema.index({ owner: 1, date: -1 });
sellingEntrySchema.index({ member: 1, date: -1 });
// Ensure only one entry per owner+member+date (API normalizes date to start-of-day)
sellingEntrySchema.index({ owner: 1, member: 1, date: 1 }, { unique: true });
sellingEntrySchema.index({ owner: 1, member: 1, isPaid: 1 });

module.exports = mongoose.model('SellingEntry', sellingEntrySchema);
