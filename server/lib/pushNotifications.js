const { Expo } = require('expo-server-sdk');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification to a single user
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} message - Notification message/body
 * @param {string} type - Notification type
 * @param {object} data - Additional data to include
 * @param {boolean} saveToDB - Whether to save to database (default: true)
 */
async function sendPushNotification(userId, title, message, type = 'general', data = {}, saveToDB = true) {
    try {
        console.log(`[Push] Starting notification for user ${userId}, title: ${title}, saveToDB: ${saveToDB}`);

        // Get user's push token
        const user = await User.findById(userId).select('expoPushToken name').lean();

        if (!user) {
            console.log(`[Push] User ${userId} not found for push notification`);
            return { success: false, error: 'User not found' };
        }

        // Save notification to database FIRST
        let notification = null;
        if (saveToDB) {
            try {
                notification = await Notification.create({
                    user: userId,
                    title,
                    message,
                    type,
                    data,
                    read: false,
                    pushSent: false
                });
                console.log(`[Push] Notification saved to DB with ID: ${notification._id}`);
            } catch (dbError) {
                console.error(`[Push] Failed to save notification to DB:`, dbError);
            }
        }

        // Check if user has a valid Expo push token
        const pushToken = user.expoPushToken;

        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            console.log(`Invalid or missing push token for user ${userId}`);
            return {
                success: true,
                notification,
                pushSent: false,
                reason: 'Invalid or missing push token'
            };
        }

        // Create the push message
        const pushMessage = {
            to: pushToken,
            sound: 'default',
            title,
            body: message,
            data: {
                ...data,
                type,
                notificationId: notification?._id?.toString()
            },
            priority: 'high',
            channelId: 'default'
        };

        // Send the push notification
        const chunks = expo.chunkPushNotifications([pushMessage]);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }

        // Update notification as push sent
        if (notification && tickets.length > 0 && tickets[0].status === 'ok') {
            await Notification.findByIdAndUpdate(notification._id, { pushSent: true });
        }

        console.log(`Push notification sent to user ${userId}: ${title}`);

        return {
            success: true,
            notification,
            pushSent: tickets.length > 0 && tickets[0].status === 'ok',
            tickets
        };
    } catch (error) {
        console.error('Error in sendPushNotification:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send push notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {object} data - Additional data
 */
async function sendBulkPushNotifications(userIds, title, message, type = 'general', data = {}) {
    const results = await Promise.allSettled(
        userIds.map(userId => sendPushNotification(userId, title, message, type, data))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`Bulk push sent: ${successful} successful, ${failed} failed`);

    return { successful, failed, total: results.length };
}

/**
 * Send commission earned notification
 */
async function notifyCommissionEarned(userId, amount, referredUserName) {
    return sendPushNotification(
        userId,
        '💰 Commission Earned!',
        `You earned ₹${amount} commission from ${referredUserName}'s subscription purchase.`,
        'commission_earned',
        { amount, referredUserName }
    );
}

/**
 * Send withdrawal status notification
 */
async function notifyWithdrawalStatus(userId, amount, status, adminNote = '') {
    const statusConfig = {
        pending: {
            emoji: '⏳',
            title: 'Withdrawal Request Submitted',
            message: `Your withdrawal request for ₹${amount} has been submitted and is pending approval.`
        },
        approved: {
            emoji: '✅',
            title: 'Withdrawal Approved',
            message: `Your withdrawal of ₹${amount} has been approved and will be processed shortly.`
        },
        rejected: {
            emoji: '❌',
            title: 'Withdrawal Rejected',
            message: `Your withdrawal request for ₹${amount} was rejected.${adminNote ? ' Reason: ' + adminNote : ''} The amount has been refunded to your balance.`
        },
        cancelled: {
            emoji: '🚫',
            title: 'Withdrawal Cancelled',
            message: `Your withdrawal request for ₹${amount} was cancelled. The amount has been refunded to your balance.`
        }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return sendPushNotification(
        userId,
        `${config.emoji} ${config.title}`,
        config.message,
        'withdrawal_status',
        { amount, status, adminNote }
    );
}

/**
 * Send withdrawal success notification (legacy - kept for compatibility)
 */
async function notifyWithdrawalSuccess(userId, amount) {
    return notifyWithdrawalStatus(userId, amount, 'approved');
}

/**
 * Send subscription expiring notification
 */
async function notifySubscriptionExpiring(userId, subscriptionName, daysLeft) {
    return sendPushNotification(
        userId,
        '⏰ Subscription Expiring Soon',
        `Your ${subscriptionName} subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}. Renew now to avoid interruption.`,
        'subscription_expiring',
        { subscriptionName, daysLeft }
    );
}

/**
 * Send subscription expired notification
 */
async function notifySubscriptionExpired(userId, subscriptionName) {
    return sendPushNotification(
        userId,
        '❌ Subscription Expired',
        `Your ${subscriptionName} subscription has expired. Renew to continue using premium features.`,
        'subscription_expired',
        { subscriptionName }
    );
}

/**
 * Send subscription purchased notification
 */
async function notifySubscriptionPurchased(userId, subscriptionName, endDate) {
    return sendPushNotification(
        userId,
        '🎉 Subscription Activated!',
        `Your ${subscriptionName} subscription is now active until ${new Date(endDate).toLocaleDateString()}.`,
        'subscription_purchased',
        { subscriptionName, endDate }
    );
}

/**
 * Send product status change notification
 */
async function notifyProductStatusChange(userId, productName, status) {
    const statusMessages = {
        approved: `Your product "${productName}" has been approved and is now live.`,
        rejected: `Your product "${productName}" has been rejected. Please check the details.`,
        active: `Your product "${productName}" is now active.`,
        inactive: `Your product "${productName}" has been deactivated.`
    };

    const statusEmojis = {
        approved: '✅',
        rejected: '❌',
        active: '🟢',
        inactive: '🔴'
    };

    return sendPushNotification(
        userId,
        `${statusEmojis[status] || '📦'} Product Status Update`,
        statusMessages[status] || `Your product "${productName}" status changed to ${status}.`,
        'product_status',
        { productName, status }
    );
}

/**
 * Send referral signup notification
 */
async function notifyReferralSignup(userId, referredUserName) {
    return sendPushNotification(
        userId,
        '👋 New Referral Signup!',
        `${referredUserName} signed up using your referral code. You'll earn commission when they purchase a subscription.`,
        'referral_signup',
        { referredUserName }
    );
}

/**
 * Send order status update notification
 */
async function notifyOrderStatusUpdate(userId, orderId, status, totalAmount) {
    const statusMessages = {
        pending: `Your order #${orderId.slice(-6)} is pending confirmation.`,
        confirmed: `Your order #${orderId.slice(-6)} has been confirmed!`,
        processing: `Your order #${orderId.slice(-6)} is being processed.`,
        delivered: `Your order #${orderId.slice(-6)} has been delivered. Enjoy!`,
        cancelled: `Your order #${orderId.slice(-6)} has been cancelled.`
    };

    const statusEmojis = {
        pending: '⏳',
        confirmed: '✅',
        processing: '📦',
        delivered: '🎉',
        cancelled: '❌'
    };

    return sendPushNotification(
        userId,
        `${statusEmojis[status] || '📦'} Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        statusMessages[status] || `Your order status changed to ${status}.`,
        'order_status',
        { orderId, status, totalAmount }
    );
}

/**
 * Send feedback response notification
 */
async function notifyFeedbackResponse(userId, feedbackId, status, adminResponse) {
    const statusMessages = {
        in_review: 'Your feedback is now being reviewed by our team.',
        resolved: adminResponse
            ? `Your feedback has been resolved: "${adminResponse.substring(0, 100)}${adminResponse.length > 100 ? '...' : ''}"`
            : 'Your feedback has been resolved. Thank you for your input!',
        closed: 'Your feedback ticket has been closed.'
    };

    return sendPushNotification(
        userId,
        '💬 Feedback Update',
        statusMessages[status] || `Your feedback status changed to ${status}.`,
        'feedback_response',
        { feedbackId, status, adminResponse }
    );
}

/**
 * Send payment received notification
 */
async function notifyPaymentReceived(userId, amount, paymentType) {
    return sendPushNotification(
        userId,
        '💵 Payment Received',
        `You received a payment of ₹${amount} for ${paymentType}.`,
        'payment_received',
        { amount, paymentType }
    );
}

/**
 * Send milk collection notification
 */
async function notifyMilkCollection(userId, quantity, amount, shift) {
    return sendPushNotification(
        userId,
        '🥛 Milk Collection Recorded',
        `${quantity}L collected in ${shift} shift. Amount: ₹${amount.toFixed(2)}`,
        'milk_collection',
        { quantity, amount, shift }
    );
}

/**
 * Check and send expiring subscription notifications (run as cron job)
 */
async function checkExpiringSubscriptions() {
    const UserSubscription = require('../models/UserSubscription');
    const now = new Date();

    // Check for subscriptions expiring in 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    try {
        // Find subscriptions expiring in 3 days (haven't been notified yet)
        const expiring3Days = await UserSubscription.find({
            isActive: true,
            paymentStatus: 'completed',
            endDate: {
                $gte: new Date(threeDaysFromNow.setHours(0, 0, 0, 0)),
                $lt: new Date(threeDaysFromNow.setHours(23, 59, 59, 999))
            }
        }).populate('subscription user').lean();

        for (const sub of expiring3Days) {
            await notifySubscriptionExpiring(
                sub.user._id,
                sub.subscription?.name || 'Subscription',
                3
            );
        }

        // Find subscriptions expiring tomorrow
        const expiring1Day = await UserSubscription.find({
            isActive: true,
            paymentStatus: 'completed',
            endDate: {
                $gte: new Date(oneDayFromNow.setHours(0, 0, 0, 0)),
                $lt: new Date(oneDayFromNow.setHours(23, 59, 59, 999))
            }
        }).populate('subscription user').lean();

        for (const sub of expiring1Day) {
            await notifySubscriptionExpiring(
                sub.user._id,
                sub.subscription?.name || 'Subscription',
                1
            );
        }

        console.log(`Checked expiring subscriptions: ${expiring3Days.length} in 3 days, ${expiring1Day.length} tomorrow`);
    } catch (error) {
        console.error('Error checking expiring subscriptions:', error);
    }
}

module.exports = {
    sendPushNotification,
    sendBulkPushNotifications,
    notifyCommissionEarned,
    notifyWithdrawalStatus,
    notifyWithdrawalSuccess,
    notifySubscriptionExpiring,
    notifySubscriptionExpired,
    notifySubscriptionPurchased,
    notifyProductStatusChange,
    notifyReferralSignup,
    notifyOrderStatusUpdate,
    notifyFeedbackResponse,
    notifyPaymentReceived,
    notifyMilkCollection,
    checkExpiringSubscriptions,
    expo
};
