const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/referrals - Get user's referral data
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('referralCode referralEarnings totalReferralEarnings')
            .lean();

        const referrals = await Referral.find({ referrer: req.userId })
            .populate('referred', 'name createdAt')
            .sort({ createdAt: -1 })
            .lean();

        // Calculate earnings from referrals
        const referralEarningsFromSubs = referrals.reduce((sum, r) => sum + (r.totalEarnings || 0), 0);

        const stats = {
            totalReferrals: referrals.length,
            activeUsers: referrals.filter(r => r.status === 'active').length,
            totalEarnings: user.totalReferralEarnings || referralEarningsFromSubs,
            currentBalance: user.referralEarnings || 0,
            pendingEarnings: referrals
                .filter(r => r.status === 'pending')
                .reduce((sum, r) => sum + (r.totalEarnings || 0), 0),
            commissionRate: referrals.length > 0 ? referrals[0].commissionRate : 5
        };

        const referralList = referrals.map(r => ({
            id: r._id,
            name: r.referred?.name || 'Unknown',
            date: r.createdAt,
            earnings: r.totalEarnings || 0,
            status: r.status,
            commissionRate: r.commissionRate
        }));

        res.json({
            success: true,
            response: {
                code: user.referralCode,
                stats,
                referrals: referralList
            }
        });
    } catch (error) {
        console.error('Get referrals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get referral data'
        });
    }
});

// POST /api/referrals/validate - Validate a referral code
router.post('/validate', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Referral code is required'
            });
        }

        const user = await User.findOne({
            referralCode: code.toUpperCase()
        }).select('name');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Invalid referral code'
            });
        }

        res.json({
            success: true,
            response: {
                valid: true,
                referrerName: user.name
            }
        });
    } catch (error) {
        console.error('Validate referral error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate referral code'
        });
    }
});

// PUT /api/referrals/:id/earnings - Update referral earnings
router.put('/:id/earnings', auth, async (req, res) => {
    try {
        const { amount } = req.body;

        const referral = await Referral.findOne({
            _id: req.params.id,
            referrer: req.userId
        });

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        referral.totalEarnings += parseFloat(amount) || 0;
        await referral.save();

        res.json({
            success: true,
            message: 'Earnings updated',
            response: referral
        });
    } catch (error) {
        console.error('Update earnings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update earnings'
        });
    }
});

// GET /api/referrals/admin/all - Admin: Get all referrals
router.get('/admin/all', async (req, res) => {
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

        // Check for admin token
        const adminId = decoded.adminId || decoded.userId;
        const admin = await Admin.findById(adminId).lean();

        if (!admin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const referrals = await Referral.find({})
            .populate('referrer', 'name email phone')
            .populate('referred', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            response: referrals
        });
    } catch (error) {
        console.error('Admin get all referrals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get referrals'
        });
    }
});

// PUT /api/referrals/admin/:id/commission - Admin: Update referral commission rate
router.put('/admin/:id/commission', async (req, res) => {
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

        // Check for admin token
        const adminId = decoded.adminId || decoded.userId;
        const admin = await Admin.findById(adminId).lean();

        if (!admin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const { commissionRate } = req.body;

        if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
            return res.status(400).json({
                success: false,
                message: 'Commission rate must be between 0 and 100'
            });
        }

        const referral = await Referral.findById(req.params.id);

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Referral not found'
            });
        }

        referral.commissionRate = commissionRate;
        await referral.save();

        res.json({
            success: true,
            message: 'Commission rate updated successfully',
            response: referral
        });
    } catch (error) {
        console.error('Update commission rate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update commission rate'
        });
    }
});

// PUT /api/referrals/admin/default-commission - Admin: Update default commission for all referrals
router.put('/admin/default-commission', async (req, res) => {
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

        // Check for admin token
        const adminId = decoded.adminId || decoded.userId;
        const admin = await Admin.findById(adminId).lean();

        if (!admin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const { commissionRate } = req.body;

        if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
            return res.status(400).json({
                success: false,
                message: 'Commission rate must be between 0 and 100'
            });
        }

        // Persist default commission rate (used for NEW referrals)
        const ReferralConfig = require('../models/ReferralConfig');
        const cfg = await ReferralConfig.findOneAndUpdate(
            {},
            { $set: { defaultCommissionRate: commissionRate } },
            { new: true, upsert: true }
        );

        // Update all existing referrals with new commission rate
        const result = await Referral.updateMany({}, { $set: { commissionRate: commissionRate } });

        res.json({
            success: true,
            message: `Default commission rate updated to ${commissionRate}% for ${result.modifiedCount} referrals`,
            response: {
                modifiedCount: result.modifiedCount,
                commissionRate: cfg.defaultCommissionRate
            }
        });
    } catch (error) {
        console.error('Update default commission rate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update default commission rate'
        });
    }
});

module.exports = router;
