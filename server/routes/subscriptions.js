const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Subscription = require('../models/Subscription');
const Admin = require('../models/Admin');

// Admin auth middleware
const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin token.'
            });
        }

        const admin = await Admin.findById(decoded.adminId).select('-password').lean();
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Admin not found.'
            });
        }

        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated.'
            });
        }

        req.admin = admin;
        req.adminId = admin._id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

// GET /api/subscriptions - Get all subscriptions with pagination
router.get('/', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const status = req.query.status || 'all';
        const tab = req.query.tab || 'all';

        const query = {};

        // Status filter
        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        // Tab filter
        if (tab && tab !== 'all') {
            query.applicableTabs = tab;
        }

        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const [total, rawSubscriptions] = await Promise.all([
            Subscription.countDocuments(query),
            Subscription.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        // Ensure subscriptionType is correctly set for all subscriptions
        const subscriptions = rawSubscriptions.map(sub => ({
            ...sub,
            subscriptionType: sub.isFree ? 'free' : (sub.applicableTabs?.length > 1 ? 'combined' : 'single')
        }));

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                subscriptions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions'
        });
    }
});

// GET /api/subscriptions/:id - Get single subscription
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id).lean();

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        res.json({
            success: true,
            response: subscription
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
});

// POST /api/subscriptions - Create subscription
router.post('/', adminAuth, async (req, res) => {
    try {
        const { name, amount, durationMonths, applicableTabs, description, subscriptionType, isFree, forNewUsers } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            });
        }

        // For free subscriptions, amount should be 0
        const actualAmount = isFree ? 0 : Number(amount);
        if (!isFree && (amount === undefined || amount < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        if (!durationMonths || durationMonths < 1) {
            return res.status(400).json({
                success: false,
                message: 'Duration must be at least 1 month'
            });
        }

        if (!applicableTabs || !Array.isArray(applicableTabs) || applicableTabs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one applicable tab is required'
            });
        }

        const validTabs = ['purchase', 'selling', 'register'];
        const invalidTabs = applicableTabs.filter(tab => !validTabs.includes(tab));
        if (invalidTabs.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid tabs: ${invalidTabs.join(', ')}. Valid tabs are: ${validTabs.join(', ')}`
            });
        }

        // Determine subscription type
        let actualType = subscriptionType || 'single';
        if (isFree) {
            actualType = 'free';
        } else if (applicableTabs.length > 1) {
            actualType = 'combined';
        }

        const subscription = new Subscription({
            name: name.trim(),
            amount: actualAmount,
            durationMonths: Number(durationMonths),
            applicableTabs,
            subscriptionType: actualType,
            isFree: Boolean(isFree),
            forNewUsers: Boolean(forNewUsers),
            description: description?.trim() || ''
        });

        await subscription.save();

        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            response: subscription
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create subscription'
        });
    }
});

// PUT /api/subscriptions/:id - Update subscription
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { name, amount, durationMonths, applicableTabs, description, isActive, subscriptionType, isFree, forNewUsers } = req.body;
        const updates = {};

        if (name !== undefined) {
            if (name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Name cannot be empty'
                });
            }
            updates.name = name.trim();
        }

        if (isFree !== undefined) {
            updates.isFree = Boolean(isFree);
            if (isFree) {
                updates.amount = 0;
            }
        }

        if (amount !== undefined && !updates.isFree) {
            if (amount < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Amount cannot be negative'
                });
            }
            updates.amount = Number(amount);
        }

        if (durationMonths !== undefined) {
            if (durationMonths < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Duration must be at least 1 month'
                });
            }
            updates.durationMonths = Number(durationMonths);
        }

        if (applicableTabs !== undefined) {
            if (!Array.isArray(applicableTabs) || applicableTabs.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one applicable tab is required'
                });
            }
            const validTabs = ['purchase', 'selling', 'register'];
            const invalidTabs = applicableTabs.filter(tab => !validTabs.includes(tab));
            if (invalidTabs.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid tabs: ${invalidTabs.join(', ')}`
                });
            }
            updates.applicableTabs = applicableTabs;
        }

        if (description !== undefined) {
            updates.description = description.trim();
        }

        if (isActive !== undefined) {
            updates.isActive = Boolean(isActive);
        }

        if (forNewUsers !== undefined) {
            updates.forNewUsers = Boolean(forNewUsers);
        }

        // Update subscription type based on isFree and applicableTabs
        if (updates.isFree) {
            updates.subscriptionType = 'free';
        } else if (updates.applicableTabs && updates.applicableTabs.length > 1) {
            updates.subscriptionType = 'combined';
        } else if (subscriptionType !== undefined) {
            updates.subscriptionType = subscriptionType;
        }

        const subscription = await Subscription.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        ).lean();

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        res.json({
            success: true,
            message: 'Subscription updated successfully',
            response: subscription
        });
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update subscription'
        });
    }
});

// PUT /api/subscriptions/:id/toggle - Toggle subscription status
router.put('/:id/toggle', adminAuth, async (req, res) => {
    try {
        const subscription = await Subscription.findById(req.params.id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        subscription.isActive = !subscription.isActive;
        await subscription.save();

        res.json({
            success: true,
            message: subscription.isActive ? 'Subscription activated' : 'Subscription deactivated',
            response: subscription
        });
    } catch (error) {
        console.error('Toggle subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle subscription status'
        });
    }
});

// DELETE /api/subscriptions/:id - Delete subscription
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const subscription = await Subscription.findByIdAndDelete(req.params.id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        res.json({
            success: true,
            message: 'Subscription deleted successfully'
        });
    } catch (error) {
        console.error('Delete subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete subscription'
        });
    }
});

module.exports = router;
