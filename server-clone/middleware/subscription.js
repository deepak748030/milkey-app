const UserSubscription = require('../models/UserSubscription');
const cache = require('../lib/cache');

const SUB_TTL = 30; // seconds
const subKey = (userId, tab) => `sub:${userId}:${tab}`;
const subAnyKey = (userId, tabs) => `sub:${userId}:any:${[...tabs].sort().join(',')}`;

/**
 * Middleware to check if user has a valid subscription for a specific tab
 * @param {string} tab - The tab to check subscription for ('purchase', 'selling', 'register')
 * @returns {Function} Express middleware function
 */
const requireSubscription = (tab) => {
    return async (req, res, next) => {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Cache subscription lookups briefly — they fire on every
            // protected write/read, but rarely change.
            const cacheKey = subKey(req.userId, tab);
            let validSubscription = await cache.get(cacheKey);
            let validUntil = validSubscription?.endDate ? new Date(validSubscription.endDate) : null;

            if (!validSubscription || (validUntil && validUntil <= new Date())) {
                const now = new Date();
                validSubscription = await UserSubscription.findOne({
                    user: req.userId,
                    isActive: true,
                    paymentStatus: 'completed',
                    endDate: { $gt: now },
                    applicableTabs: tab
                }).lean();

                if (validSubscription) {
                    cache.set(cacheKey, validSubscription, SUB_TTL);
                }
            }

            if (!validSubscription) {
                return res.status(403).json({
                    success: false,
                    message: `Active subscription required for ${tab} features. Please subscribe to continue.`,
                    code: 'SUBSCRIPTION_REQUIRED',
                    requiredTab: tab
                });
            }

            // Attach subscription info to request for potential use
            req.subscription = validSubscription;
            next();
        } catch (error) {
            console.error('Subscription check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify subscription'
            });
        }
    };
};

/**
 * Middleware to check if user has subscription for any of the specified tabs
 * @param {string[]} tabs - Array of tabs to check subscription for
 * @returns {Function} Express middleware function
 */
const requireAnySubscription = (tabs) => {
    return async (req, res, next) => {
        try {
            if (!req.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const cacheKey = subAnyKey(req.userId, tabs);
            let validSubscription = await cache.get(cacheKey);
            let validUntil = validSubscription?.endDate ? new Date(validSubscription.endDate) : null;

            if (!validSubscription || (validUntil && validUntil <= new Date())) {
                const now = new Date();
                validSubscription = await UserSubscription.findOne({
                    user: req.userId,
                    isActive: true,
                    paymentStatus: 'completed',
                    endDate: { $gt: now },
                    applicableTabs: { $in: tabs }
                }).lean();

                if (validSubscription) {
                    cache.set(cacheKey, validSubscription, SUB_TTL);
                }
            }

            if (!validSubscription) {
                return res.status(403).json({
                    success: false,
                    message: `Active subscription required. Please subscribe to continue.`,
                    code: 'SUBSCRIPTION_REQUIRED',
                    requiredTabs: tabs
                });
            }

            req.subscription = validSubscription;
            next();
        } catch (error) {
            console.error('Subscription check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify subscription'
            });
        }
    };
};

module.exports = { requireSubscription, requireAnySubscription };
