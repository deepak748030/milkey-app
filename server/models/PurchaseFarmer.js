const mongoose = require('mongoose');

const purchaseFarmerSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Code is required'],
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    mobile: {
        type: String,
        trim: true,
        default: ''
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Cow/Buffalo settings
    cowEnabled: {
        type: Boolean,
        default: true
    },
    buffaloEnabled: {
        type: Boolean,
        default: true
    },
    defaultMilk: {
        type: String,
        enum: ['cow', 'buffalo'],
        default: 'buffalo'
    },
    // Price basis: 'rate' = fixed rate, 'fat' = fat-based, 'fat_snf' = fat+SNF based
    priceBasis: {
        type: String,
        enum: ['rate', 'fat', 'fat_snf'],
        default: 'rate'
    },
    // Rates for rate-based pricing
    cowRate: {
        type: Number,
        default: 0
    },
    buffaloRate: {
        type: Number,
        default: 0
    },
    // Fat values for fat-based pricing
    cowFat: {
        type: Number,
        default: 0
    },
    buffaloFat: {
        type: Number,
        default: 0
    },
    // SNF values for fat+snf pricing
    cowSnf: {
        type: Number,
        default: 0
    },
    buffaloSnf: {
        type: Number,
        default: 0
    },
    totalQuantity: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    lastPurchaseDate: {
        type: Date,
        default: null
    },
    // Alert method for notifications
    alertMethod: {
        type: String,
        enum: ['sms', 'whatsapp', 'email', 'none'],
        default: 'none'
    },
    // Print entry slip preference
    printEntrySlip: {
        type: String,
        enum: ['default', 'yes', 'no'],
        default: 'default'
    },
    // Whether the Rate Chart icon should be shown in Purchase for this customer
    showRateChart: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index for unique code per owner
purchaseFarmerSchema.index({ code: 1, owner: 1 }, { unique: true });
purchaseFarmerSchema.index({ owner: 1 });

module.exports = mongoose.model('PurchaseFarmer', purchaseFarmerSchema);
