const mongoose = require('mongoose');

// One document per logical event (e.g. "payment_success:<userSubscriptionId>").
// The unique index on `key` guarantees the same event never sends a
// WhatsApp message twice, no matter how many times the event fires.
const whatsappMessageLogSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // e.g. 'user_welcome' | 'member_welcome' | 'payment_success' | 'payment_failed'
    type: {
        type: String,
        default: ''
    },
    to: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'skipped'],
        default: 'pending'
    },
    error: {
        type: String,
        default: ''
    },
    sentAt: {
        type: Date
    }
}, {
    timestamps: true
});

whatsappMessageLogSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('WhatsappMessageLog', whatsappMessageLogSchema);
