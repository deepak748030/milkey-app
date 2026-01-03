const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const Referral = require('../models/Referral');
const auth = require('../middleware/auth');
const {
    notifyCommissionEarned,
    notifySubscriptionPurchased,
    notifyReferralSignup
} = require('../lib/pushNotifications');

// GET /api/user-subscriptions/available - Get all available subscriptions for the user
router.get('/available', auth, async (req, res) => {
    try {
        const userId = req.userId;

        // Get user's registration date
        const User = require('../models/User');
        const user = await User.findById(userId).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is "new" (registered within last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isNewUser = new Date(user.createdAt) > thirtyDaysAgo;

        // Get all active subscriptions
        let query = { isActive: true };

        const rawSubscriptions = await Subscription.find(query)
            .sort({ isFree: -1, amount: 1 })
            .lean();

        // Ensure subscriptionType is correctly set
        const subscriptions = rawSubscriptions.map(sub => ({
            ...sub,
            subscriptionType: sub.isFree ? 'free' : (sub.applicableTabs?.length > 1 ? 'combined' : 'single')
        }));

        // Get user's existing subscriptions
        const userSubscriptions = await UserSubscription.find({
            user: userId,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: new Date() }
        }).populate('subscription').lean();

        // Get purchased subscription IDs
        const purchasedSubscriptionIds = userSubscriptions.map(us => us.subscription?._id?.toString());

        // Filter subscriptions based on user status
        const availableSubscriptions = subscriptions.filter(sub => {
            // If free subscription for new users only, check conditions
            if (sub.isFree && sub.forNewUsers) {
                // Only show if user is new AND hasn't purchased this already
                if (!isNewUser) return false;
                if (purchasedSubscriptionIds.includes(sub._id.toString())) return false;
            }

            return true;
        });

        // Mark which ones are already purchased
        const subscriptionsWithStatus = availableSubscriptions.map(sub => ({
            ...sub,
            isPurchased: purchasedSubscriptionIds.includes(sub._id.toString())
        }));

        res.json({
            success: true,
            response: {
                subscriptions: subscriptionsWithStatus,
                isNewUser,
                hasActiveSubscription: userSubscriptions.length > 0
            }
        });
    } catch (error) {
        console.error('Get available subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions'
        });
    }
});

// GET /api/user-subscriptions/my - Get user's active subscriptions
router.get('/my', auth, async (req, res) => {
    try {
        const userSubscriptions = await UserSubscription.find({
            user: req.userId,
            isActive: true,
            paymentStatus: 'completed'
        })
            .populate('subscription')
            .sort({ endDate: -1 })
            .lean();

        // Separate active and expired
        const now = new Date();
        const active = userSubscriptions.filter(us => new Date(us.endDate) >= now);
        const expired = userSubscriptions.filter(us => new Date(us.endDate) < now);

        res.json({
            success: true,
            response: {
                active,
                expired,
                all: userSubscriptions
            }
        });
    } catch (error) {
        console.error('Get my subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions'
        });
    }
});

// GET /api/user-subscriptions/check/:tab - Check if user has valid subscription for a tab
router.get('/check/:tab', auth, async (req, res) => {
    try {
        const { tab } = req.params;
        const validTabs = ['purchase', 'selling', 'register'];

        if (!validTabs.includes(tab)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tab'
            });
        }

        const now = new Date();

        // Check for any valid subscription that covers this tab
        const validSubscription = await UserSubscription.findOne({
            user: req.userId,
            applicableTabs: tab,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: now }
        }).populate('subscription').lean();

        // Get available subscriptions for this tab if no valid subscription
        let availableSubscriptions = [];
        if (!validSubscription) {
            // Get subscriptions that cover this tab (single or combined)
            const rawSubs = await Subscription.find({
                isActive: true,
                applicableTabs: tab
            }).sort({ isFree: -1, amount: 1 }).lean();

            // Ensure subscriptionType is correctly set
            const subs = rawSubs.map(sub => ({
                ...sub,
                subscriptionType: sub.isFree ? 'free' : (sub.applicableTabs?.length > 1 ? 'combined' : 'single')
            }));

            // Check if user is new for free subscriptions
            const User = require('../models/User');
            const user = await User.findById(req.userId).lean();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const isNewUser = new Date(user.createdAt) > thirtyDaysAgo;

            // Get already purchased subscriptions
            const purchasedSubs = await UserSubscription.find({
                user: req.userId,
                paymentStatus: 'completed'
            }).select('subscription').lean();
            const purchasedIds = purchasedSubs.map(ps => ps.subscription?.toString());

            availableSubscriptions = subs.filter(sub => {
                // Filter out free new user subs if not eligible
                if (sub.isFree && sub.forNewUsers) {
                    if (!isNewUser) return false;
                    if (purchasedIds.includes(sub._id.toString())) return false;
                }
                return true;
            });
        }

        res.json({
            success: true,
            response: {
                hasValidSubscription: !!validSubscription,
                subscription: validSubscription,
                availableSubscriptions,
                expiresAt: validSubscription?.endDate
            }
        });
    } catch (error) {
        console.error('Check subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check subscription'
        });
    }
});

// POST /api/user-subscriptions/create-pending - Create a pending subscription before payment
router.post('/create-pending', auth, async (req, res) => {
    try {
        const { subscriptionId, transactionId, multiplier = 1 } = req.body;

        // Validate multiplier
        const validMultiplier = Math.max(1, Math.min(12, parseInt(multiplier) || 1));

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'Subscription ID is required'
            });
        }

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID (Order ID) is required'
            });
        }

        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription || !subscription.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found or inactive'
            });
        }

        // Free subscriptions don't need pending records
        if (subscription.isFree) {
            return res.status(400).json({
                success: false,
                message: 'Free subscriptions do not require pending creation'
            });
        }

        // Check for any active subscription covering same tabs
        const now = new Date();
        const overlappingTabs = subscription.applicableTabs || [];

        // Find the latest ending subscription for these tabs (for queueing renewals)
        const latestActiveSubscription = await UserSubscription.findOne({
            user: req.userId,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: now },
            applicableTabs: { $in: overlappingTabs }
        }).sort({ endDate: -1 }).lean();

        // Calculate start and end dates
        let startDate;
        if (latestActiveSubscription) {
            startDate = new Date(latestActiveSubscription.endDate);
        } else {
            startDate = new Date();
        }

        // Calculate end date based on duration with multiplier
        const endDate = new Date(startDate);
        const baseDurationValue = subscription.durationValue || 1;
        const effectiveDuration = baseDurationValue * validMultiplier;

        if (subscription.durationType === 'days') {
            const baseDays = subscription.durationDays || 30;
            endDate.setDate(endDate.getDate() + (baseDays * validMultiplier));
        } else if (subscription.durationType === 'years') {
            endDate.setFullYear(endDate.getFullYear() + effectiveDuration);
        } else {
            const months = (subscription.durationValue || subscription.durationMonths || 1) * validMultiplier;
            endDate.setMonth(endDate.getMonth() + months);
        }

        // Calculate locked-in amount
        const baseAmount = subscription.amount || 0;
        const totalAmount = baseAmount * validMultiplier;

        // Create pending user subscription
        const userSubscription = new UserSubscription({
            user: req.userId,
            subscription: subscriptionId,
            applicableTabs: subscription.applicableTabs,
            startDate,
            endDate,
            amount: totalAmount,
            baseAmount: baseAmount,
            multiplier: validMultiplier,
            lockedDurationDays: subscription.durationDays,
            lockedDurationType: subscription.durationType || 'months',
            lockedDurationValue: subscription.durationValue || 1,
            lockedSubscriptionName: subscription.name,
            isFree: false,
            paymentStatus: 'pending', // KEY: Mark as pending
            paymentMethod: 'upi',
            transactionId: transactionId, // Store the order ID for webhook lookup
            isActive: false // Not active until payment confirmed
        });

        await userSubscription.save();

        console.log(`[create-pending] Created pending subscription ${userSubscription._id} for user ${req.userId} with transactionId ${transactionId}`);

        res.status(201).json({
            success: true,
            message: 'Pending subscription created',
            response: {
                pendingSubscriptionId: userSubscription._id,
                transactionId: transactionId
            }
        });
    } catch (error) {
        console.error('Create pending subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create pending subscription'
        });
    }
});

// POST /api/user-subscriptions/activate-pending - Activate a pending subscription after payment
router.post('/activate-pending', auth, async (req, res) => {
    try {
        const { transactionId, referralCode } = req.body;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID is required'
            });
        }

        // Find pending subscription
        const userSubscription = await UserSubscription.findOne({
            user: req.userId,
            transactionId: transactionId,
            paymentStatus: 'pending'
        }).populate('subscription');

        if (!userSubscription) {
            return res.status(404).json({
                success: false,
                message: 'Pending subscription not found'
            });
        }

        // Activate the subscription
        userSubscription.paymentStatus = 'completed';
        userSubscription.isActive = true;
        await userSubscription.save();

        console.log(`[activate-pending] Activated subscription ${userSubscription._id} for user ${req.userId}`);

        // Process referral commission (same logic as in /purchase)
        const subscription = userSubscription.subscription;
        const totalAmount = userSubscription.amount;

        if (totalAmount > 0) {
            try {
                const ReferralConfig = require('../models/ReferralConfig');
                const cfg = await ReferralConfig.findOneAndUpdate(
                    {},
                    { $setOnInsert: { defaultCommissionRate: 5 } },
                    { new: true, upsert: true }
                );
                const defaultCommissionRate = typeof cfg?.defaultCommissionRate === 'number' ? cfg.defaultCommissionRate : 5;

                const buyer = await User.findById(req.userId);
                if (buyer) {
                    let referrerId = buyer.referredBy;

                    if (!referrerId && referralCode) {
                        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() })
                            .select('_id referralCode')
                            .lean();

                        if (referrer && referrer._id.toString() !== buyer._id.toString()) {
                            buyer.referredBy = referrer._id;
                            await buyer.save();
                            referrerId = referrer._id;
                        }
                    }

                    if (referrerId) {
                        let referral = await Referral.findOne({
                            referrer: referrerId,
                            referred: req.userId
                        });

                        if (!referral) {
                            const referrer = await User.findById(referrerId).select('referralCode').lean();
                            if (referrer) {
                                referral = await Referral.create({
                                    referrer: referrerId,
                                    referred: req.userId,
                                    code: referrer.referralCode,
                                    status: 'active',
                                    commissionRate: defaultCommissionRate,
                                    totalEarnings: 0
                                });
                            }
                        }

                        if (referral) {
                            const commissionRate = Number.isFinite(referral.commissionRate)
                                ? referral.commissionRate
                                : defaultCommissionRate;

                            const commissionAmount = Number(
                                ((totalAmount * commissionRate) / 100).toFixed(2)
                            );

                            if (commissionAmount > 0) {
                                await Promise.all([
                                    Referral.findByIdAndUpdate(referral._id, {
                                        $inc: { totalEarnings: commissionAmount },
                                        $set: { status: 'active', commissionRate }
                                    }),
                                    User.findByIdAndUpdate(referrerId, {
                                        $inc: {
                                            referralEarnings: commissionAmount,
                                            totalReferralEarnings: commissionAmount
                                        }
                                    })
                                ]);

                                const buyerData = await User.findById(req.userId).select('name').lean();
                                notifyCommissionEarned(
                                    referrerId.toString(),
                                    commissionAmount,
                                    buyerData?.name || 'A user'
                                ).catch(err => console.error('Error sending commission notification:', err));
                            }
                        }
                    }
                }
            } catch (refError) {
                console.error('Error processing referral commission:', refError);
            }
        }

        // Send push notification
        notifySubscriptionPurchased(
            req.userId,
            subscription.name || 'Subscription',
            userSubscription.endDate
        ).catch(err => console.error('Error sending subscription notification:', err));

        res.json({
            success: true,
            message: 'Subscription activated successfully!',
            response: userSubscription
        });
    } catch (error) {
        console.error('Activate pending subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to activate subscription'
        });
    }
});

// GET /api/user-subscriptions/check-pending - Check and sync any pending subscriptions
router.get('/check-pending', auth, async (req, res) => {
    try {
        // Find all pending subscriptions for this user
        const pendingSubscriptions = await UserSubscription.find({
            user: req.userId,
            paymentStatus: 'pending'
        }).populate('subscription').lean();

        if (pendingSubscriptions.length === 0) {
            return res.json({
                success: true,
                response: {
                    hasPending: false,
                    pendingCount: 0,
                    synced: []
                }
            });
        }

        const synced = [];

        // For each pending subscription, check with ZapUPI if payment was successful
        for (const pending of pendingSubscriptions) {
            try {
                // Call ZapUPI to verify payment status
                const axios = require('axios');
                const verifyUrl = `https://api.zapupi.com/order/status?merchantId=MILKEY_DAIRY&orderId=${pending.transactionId}`;

                const verifyResponse = await axios.get(verifyUrl);
                const paymentStatus = verifyResponse.data?.status;

                if (paymentStatus === 'Success' || paymentStatus === 'COMPLETED') {
                    // Activate this subscription
                    await UserSubscription.findByIdAndUpdate(pending._id, {
                        paymentStatus: 'completed',
                        isActive: true
                    });

                    synced.push({
                        id: pending._id,
                        name: pending.subscription?.name,
                        status: 'activated'
                    });

                    console.log(`[check-pending] Auto-activated subscription ${pending._id} via status check`);
                } else if (paymentStatus === 'Failed' || paymentStatus === 'FAILED') {
                    // Mark as failed
                    await UserSubscription.findByIdAndUpdate(pending._id, {
                        paymentStatus: 'failed'
                    });

                    synced.push({
                        id: pending._id,
                        name: pending.subscription?.name,
                        status: 'failed'
                    });
                }
                // If still pending on ZapUPI side, leave as is
            } catch (verifyError) {
                console.error(`[check-pending] Error verifying ${pending.transactionId}:`, verifyError.message);
            }
        }

        res.json({
            success: true,
            response: {
                hasPending: pendingSubscriptions.length > 0,
                pendingCount: pendingSubscriptions.length,
                synced
            }
        });
    } catch (error) {
        console.error('Check pending subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check pending subscriptions'
        });
    }
});

// POST /api/user-subscriptions/purchase - Purchase a subscription
router.post('/purchase', auth, async (req, res) => {
    try {
        const { subscriptionId, paymentMethod, transactionId, referralCode, multiplier = 1 } = req.body;

        // Validate multiplier
        const validMultiplier = Math.max(1, Math.min(12, parseInt(multiplier) || 1));

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'Subscription ID is required'
            });
        }

        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription || !subscription.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found or inactive'
            });
        }

        // Free subscriptions cannot have multiplier > 1
        if (subscription.isFree && validMultiplier > 1) {
            return res.status(400).json({
                success: false,
                message: 'Free subscriptions cannot be extended with multiplier'
            });
        }

        // Check if user already has this exact subscription active or queued
        const existingSubscription = await UserSubscription.findOne({
            user: req.userId,
            subscription: subscriptionId,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: new Date() }
        });

        if (existingSubscription) {
            return res.status(400).json({
                success: false,
                message: 'You already have this subscription active',
                errorCode: 'ALREADY_SUBSCRIBED'
            });
        }

        // For free subscriptions targeting new users, verify eligibility
        if (subscription.isFree && subscription.forNewUsers) {
            const User = require('../models/User');
            const user = await User.findById(req.userId).lean();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const isNewUser = new Date(user.createdAt) > thirtyDaysAgo;

            if (!isNewUser) {
                return res.status(400).json({
                    success: false,
                    message: 'This subscription is only available for new users'
                });
            }

            // Check if already claimed
            const alreadyClaimed = await UserSubscription.findOne({
                user: req.userId,
                subscription: subscriptionId
            });

            if (alreadyClaimed) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already claimed this free subscription'
                });
            }
        }

        // Check for any active subscription covering same tabs
        // User cannot buy another plan for tabs they already have active
        const now = new Date();
        const overlappingTabs = subscription.applicableTabs || [];

        // Find active subscriptions covering any of the same tabs
        const activeOverlappingSubscriptions = await UserSubscription.find({
            user: req.userId,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: now },
            startDate: { $lte: now }, // Currently active, not queued
            applicableTabs: { $in: overlappingTabs }
        }).populate('subscription').lean();

        // Check if any of these are different subscriptions (not renewals of the same plan)
        const differentActivePlans = activeOverlappingSubscriptions.filter(
            sub => sub.subscription._id.toString() !== subscriptionId
        );

        if (differentActivePlans.length > 0) {
            const activeTabs = [...new Set(differentActivePlans.flatMap(s => s.applicableTabs || []))];
            const conflictingTabs = overlappingTabs.filter(tab => activeTabs.includes(tab));
            return res.status(400).json({
                success: false,
                message: `You already have an active subscription for: ${conflictingTabs.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}. Please wait for it to expire before buying a different plan for these tabs.`,
                errorCode: 'TABS_ALREADY_COVERED',
                conflictingTabs
            });
        }

        // Find the latest ending subscription that covers any of the same tabs (for queueing renewals)
        const latestActiveSubscription = await UserSubscription.findOne({
            user: req.userId,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: now },
            applicableTabs: { $in: overlappingTabs }
        }).sort({ endDate: -1 }).lean();

        // Calculate start and end dates
        let startDate;
        let isQueued = false;

        if (latestActiveSubscription) {
            // Queue this subscription to start after the current one ends
            startDate = new Date(latestActiveSubscription.endDate);
            isQueued = true;
        } else {
            startDate = new Date();
        }

        // Calculate end date based on duration with multiplier
        const endDate = new Date(startDate);
        const baseDurationValue = subscription.durationValue || 1;
        const effectiveDuration = baseDurationValue * validMultiplier;

        if (subscription.durationType === 'days') {
            const baseDays = subscription.durationDays || 30;
            endDate.setDate(endDate.getDate() + (baseDays * validMultiplier));
        } else if (subscription.durationType === 'years') {
            endDate.setFullYear(endDate.getFullYear() + effectiveDuration);
        } else {
            // Default to months
            const months = (subscription.durationValue || subscription.durationMonths || 1) * validMultiplier;
            endDate.setMonth(endDate.getMonth() + months);
        }

        // Calculate locked-in amount (base price * multiplier)
        const baseAmount = subscription.amount || 0;
        const totalAmount = baseAmount * validMultiplier;

        // Create user subscription with locked-in values
        const userSubscription = new UserSubscription({
            user: req.userId,
            subscription: subscriptionId,
            applicableTabs: subscription.applicableTabs,
            startDate,
            endDate,
            // Locked-in pricing at time of purchase
            amount: totalAmount,
            baseAmount: baseAmount,
            multiplier: validMultiplier,
            // Locked-in duration info
            lockedDurationDays: subscription.durationDays,
            lockedDurationType: subscription.durationType || 'months',
            lockedDurationValue: subscription.durationValue || 1,
            lockedSubscriptionName: subscription.name,
            isFree: subscription.isFree,
            paymentStatus: subscription.isFree ? 'completed' : 'completed', // For now, mark as completed
            paymentMethod: subscription.isFree ? 'free' : (paymentMethod || 'cash'),
            transactionId: transactionId || ''
        });

        await userSubscription.save();

        // Process referral commission if applicable (paid subscriptions only)
        // Use totalAmount (with multiplier) for commission calculation
        if (!subscription.isFree && totalAmount > 0) {
            try {
                const ReferralConfig = require('../models/ReferralConfig');
                const cfg = await ReferralConfig.findOneAndUpdate(
                    {},
                    { $setOnInsert: { defaultCommissionRate: 5 } },
                    { new: true, upsert: true }
                );
                const defaultCommissionRate = typeof cfg?.defaultCommissionRate === 'number' ? cfg.defaultCommissionRate : 5;

                const buyer = await User.findById(req.userId);
                if (!buyer) throw new Error('Buyer not found');

                // Prefer stored referredBy (from registration), but also allow referralCode at purchase time
                let referrerId = buyer.referredBy;

                if (!referrerId && referralCode) {
                    const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() })
                        .select('_id referralCode')
                        .lean();

                    if (referrer && referrer._id.toString() !== buyer._id.toString()) {
                        buyer.referredBy = referrer._id;
                        await buyer.save();
                        referrerId = referrer._id;
                    }
                }

                if (referrerId) {
                    // Ensure referral record exists
                    let referral = await Referral.findOne({
                        referrer: referrerId,
                        referred: req.userId
                    });

                    if (!referral) {
                        const referrer = await User.findById(referrerId).select('referralCode').lean();
                        if (!referrer) throw new Error('Referrer not found');

                        referral = await Referral.create({
                            referrer: referrerId,
                            referred: req.userId,
                            code: referrer.referralCode,
                            status: 'active',
                            commissionRate: defaultCommissionRate,
                            totalEarnings: 0
                        });
                    }

                    const commissionRate = Number.isFinite(referral.commissionRate)
                        ? referral.commissionRate
                        : defaultCommissionRate;

                    // Use totalAmount (includes multiplier) for commission
                    const commissionAmount = Number(
                        ((totalAmount * commissionRate) / 100).toFixed(2)
                    );

                    if (commissionAmount > 0) {
                        await Promise.all([
                            Referral.findByIdAndUpdate(referral._id, {
                                $inc: { totalEarnings: commissionAmount },
                                $set: { status: 'active', commissionRate }
                            }),
                            User.findByIdAndUpdate(referrerId, {
                                $inc: {
                                    referralEarnings: commissionAmount,
                                    totalReferralEarnings: commissionAmount
                                }
                            })
                        ]);

                        // Send push notification to referrer about commission earned
                        const buyer = await User.findById(req.userId).select('name').lean();
                        notifyCommissionEarned(
                            referrerId.toString(),
                            commissionAmount,
                            buyer?.name || 'A user'
                        ).catch(err => console.error('Error sending commission notification:', err));
                    }
                }
            } catch (refError) {
                console.error('Error processing referral commission:', refError);
                // Don't fail the subscription purchase due to referral error
            }
        }

        // Populate subscription details for response
        await userSubscription.populate('subscription');

        // Send push notification about subscription purchase
        notifySubscriptionPurchased(
            req.userId,
            subscription.name || 'Subscription',
            userSubscription.endDate
        ).catch(err => console.error('Error sending subscription notification:', err));

        // Build response message
        let message = subscription.isFree ? 'Free subscription activated!' : 'Subscription purchased successfully!';
        if (isQueued) {
            message = `Subscription queued! It will start on ${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} after your current subscription ends.`;
        }

        res.status(201).json({
            success: true,
            message,
            response: userSubscription,
            isQueued,
            startsAt: startDate
        });
    } catch (error) {
        console.error('Purchase subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to purchase subscription'
        });
    }
});

// GET /api/user-subscriptions/status - Get overall subscription status
router.get('/status', auth, async (req, res) => {
    try {
        const now = new Date();

        const activeSubscriptions = await UserSubscription.find({
            user: req.userId,
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: now }
        }).populate('subscription').lean();

        // Get all tabs covered
        const coveredTabs = new Set();
        activeSubscriptions.forEach(sub => {
            sub.applicableTabs?.forEach(tab => coveredTabs.add(tab));
        });

        res.json({
            success: true,
            response: {
                hasAnySubscription: activeSubscriptions.length > 0,
                activeCount: activeSubscriptions.length,
                coveredTabs: Array.from(coveredTabs),
                hasPurchase: coveredTabs.has('purchase'),
                hasSelling: coveredTabs.has('selling'),
                hasRegister: coveredTabs.has('register'),
                subscriptions: activeSubscriptions
            }
        });
    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription status'
        });
    }
});

// GET /api/user-subscriptions/all-active - Admin: Get all active subscriptions
router.get('/all-active', async (req, res) => {
    try {
        // Verify admin token
        const jwt = require('jsonwebtoken');
        const Admin = require('../models/Admin');

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }

        // Check for admin token (has adminId) or owner role
        const adminId = decoded.adminId || decoded.userId;
        const admin = await Admin.findById(adminId).lean();

        if (!admin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const now = new Date();

        const subscriptions = await UserSubscription.find({
            isActive: true,
            paymentStatus: 'completed',
            endDate: { $gte: now }
        })
            .populate('subscription')
            .populate({
                path: 'user',
                select: 'name email phone referralCode referredBy',
                populate: {
                    path: 'referredBy',
                    select: 'name email'
                }
            })
            .sort({ endDate: -1 })
            .lean();

        // Calculate stats
        const uniqueUsers = new Set(subscriptions.map(s => s.user?._id?.toString()));
        const totalRevenue = subscriptions
            .filter(s => !s.isFree)
            .reduce((sum, s) => sum + (s.amount || 0), 0);

        // Get total commission paid
        const referrals = await Referral.find({}).lean();
        const totalCommissionPaid = referrals.reduce((sum, r) => sum + (r.totalEarnings || 0), 0);

        res.json({
            success: true,
            response: {
                subscriptions,
                stats: {
                    totalActiveUsers: uniqueUsers.size,
                    totalRevenue,
                    totalCommissionPaid
                }
            }
        });
    } catch (error) {
        console.error('Get all active subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscriptions'
        });
    }
});

module.exports = router;
