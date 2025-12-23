const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/referrals - Get user's referral data
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('referralCode').lean();

        const referrals = await Referral.find({ referrer: req.userId })
            .populate('referred', 'name createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const stats = {
            totalReferrals: referrals.length,
            activeUsers: referrals.filter(r => r.status === 'active').length,
            totalEarnings: referrals.reduce((sum, r) => sum + r.totalEarnings, 0),
            pendingEarnings: referrals
                .filter(r => r.status === 'pending')
                .reduce((sum, r) => sum + r.totalEarnings, 0),
            commissionRate: 5
        };

        const referralList = referrals.map(r => ({
            id: r._id,
            name: r.referred?.name || 'Unknown',
            date: r.createdAt,
            earnings: r.totalEarnings,
            status: r.status
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

module.exports = router;
