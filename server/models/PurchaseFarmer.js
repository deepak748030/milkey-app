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
        required: [true, 'Mobile number is required'],
        trim: true
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
