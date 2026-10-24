const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    type: {
        type: String,
        enum: [
            'commission_earned',
            'withdrawal_success',
            'withdrawal_status',
            'subscription_expiring',
            'subscription_expired',
            'subscription_purchased',
            'product_status',
            'referral_signup',
            'order_status',
            'feedback_response',
            'payment_received',
            'milk_collection',
            'general',
            'system',
            'admin_message',
            'admin_broadcast',
            'broadcast',
            'subscription_assigned'
        ],
        default: 'general'
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    read: {
        type: Boolean,
        default: false
    },
    pushSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
