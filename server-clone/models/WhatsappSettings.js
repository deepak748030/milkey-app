const mongoose = require('mongoose');

// Settings for the Zyptos WhatsApp messages that are sent automatically
// on app events (new user, new member, payment success / failure).
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
    // Sent to a newly added selling member/customer (by the owner)
    memberWelcomeMessage: {
        type: String,
        default: 'Hi {{name}}, you have been added as a member on Milkey. We are glad to have you!',
        maxlength: 4096
    },
    // Sent to the user when a payment/subscription transaction is successful
    paymentSuccessMessage: {
        type: String,
        default: 'Hi {{name}}, your payment of ₹{{amount}} for {{plan}} was successful. Transaction ID: {{transactionId}}. Thank you!',
        maxlength: 4096
    },
    // Sent to the user when a payment/subscription transaction fails
    paymentFailedMessage: {
        type: String,
        default: 'Hi {{name}}, your payment of ₹{{amount}} for {{plan}} could not be completed. Transaction ID: {{transactionId}}. Please try again.',
        maxlength: 4096
    },
    // Optional Zyptos WABA connection_id (leave 0 / null to let Zyptos pick the default)
    connectionId: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('WhatsappSettings', whatsappSettingsSchema);
