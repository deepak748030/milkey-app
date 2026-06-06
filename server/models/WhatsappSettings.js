const mongoose = require('mongoose');

// Settings for the Zyptos WhatsApp welcome message that is sent to a user
// automatically when they register in the app.
const whatsappSettingsSchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: true
    },
    welcomeMessage: {
        type: String,
        default: 'Hi {{name}}, welcome to Milkey! Your referral code is {{referralCode}}.',
        maxlength: 4096
    },
    // Optional Zyptos WABA connection_id (leave 0 / null to let Zyptos pick the default)
    connectionId: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappSettings', whatsappSettingsSchema);
