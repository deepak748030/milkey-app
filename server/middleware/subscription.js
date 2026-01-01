const UserSubscription = require('../models/UserSubscription');

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

            // Check for valid subscription for the specified tab
            const now = new Date();
            const validSubscription = await UserSubscription.findOne({
                user: req.userId,
                isActive: true,
                paymentStatus: 'completed',
                endDate: { $gt: now },
                applicableTabs: tab
            });

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

            // Check for valid subscription for any of the specified tabs
            const now = new Date();
            const validSubscription = await UserSubscription.findOne({
                user: req.userId,
                isActive: true,
                paymentStatus: 'completed',
                endDate: { $gt: now },
                applicableTabs: { $in: tabs }
            });

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
