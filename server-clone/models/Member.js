const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    ratePerLiter: {
        type: Number,
        required: [true, 'Rate per liter is required'],
        min: [0, 'Rate cannot be negative'],
        default: 50
    },
    // Daily auto entry (bulk/quick session entry) settings
    dailyAutoEntry: {
        type: Boolean,
        default: false
    },
    defaultMorningQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Default morning quantity cannot be negative']
    },
    defaultEveningQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Default evening quantity cannot be negative']
    },
    defaultNotes: {
        type: String,
        trim: true,
        default: ''
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    totalLiters: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    pendingAmount: {
        type: Number,
        default: 0
    },
    // Separate balance for selling payments
    sellingPaymentBalance: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
memberSchema.index({ owner: 1, isActive: 1 });
memberSchema.index({ owner: 1, name: 1 });

module.exports = mongoose.model('Member', memberSchema);
