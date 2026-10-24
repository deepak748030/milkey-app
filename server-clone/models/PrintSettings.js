const mongoose = require('mongoose');

const printSettingsSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    dairyName: {
        type: String,
        default: '',
        trim: true,
        maxlength: [200, 'Dairy name cannot exceed 200 characters']
    },
    ownerName: {
        type: String,
        default: '',
        trim: true,
        maxlength: [100, 'Owner name cannot exceed 100 characters']
    },
    mobileNumber: {
        type: String,
        default: '',
        trim: true
    },
    address: {
        type: String,
        default: '',
        trim: true,
        maxlength: [500, 'Address cannot exceed 500 characters']
    },
    showMobileOnReceipt: {
        type: Boolean,
        default: true
    },
    extraInfo: {
        type: String,
        default: '',
        trim: true,
        maxlength: [500, 'Extra info cannot exceed 500 characters']
    },
    // Separate dairy name shown on digital (WhatsApp/SMS) slips. Falls
    // back to dairyName if empty.
    digitalSlipName: {
        type: String,
        default: '',
        trim: true,
        maxlength: [200, 'Digital slip name cannot exceed 200 characters']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PrintSettings', printSettingsSchema);
