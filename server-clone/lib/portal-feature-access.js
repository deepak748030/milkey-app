const UserSubscription = require('../models/UserSubscription');

// Only pre-feature accounts retain previously free portal access. Never infer
// permission from the live plan definition: subscriptions have locked tabs.
async function portalEligibleOwnerIds(users, now = new Date()) {
    const allowed = new Set();
    const versioned = [];
    for (const user of users) {
        if (user.subscriptionFeatureVersion == null) allowed.add(String(user._id));
        else versioned.push(user._id);
    }
    if (versioned.length) {
        const subscriptions = await UserSubscription.find({
            user: { $in: versioned }, applicableTabs: 'user_login',
            isActive: true, paymentStatus: 'completed', endDate: { $gt: now },
            $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }],
        }).select('user').lean();
        for (const sub of subscriptions) allowed.add(String(sub.user));
    }
    return allowed;
}

module.exports = { portalEligibleOwnerIds };
