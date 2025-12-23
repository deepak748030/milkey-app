const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Farmer code is required'],
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Farmer name is required'],
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
    totalPurchase: {
        type: Number,
        default: 0
    },
    totalLiters: {
        type: Number,
        default: 0
    },
    pendingAmount: {
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

// Compound index for unique code per owner
farmerSchema.index({ code: 1, owner: 1 }, { unique: true });
farmerSchema.index({ owner: 1 });

module.exports = mongoose.model('Farmer', farmerSchema);
