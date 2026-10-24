const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/users/profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password -otp')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            response: user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
});

// GET /api/users/stats
router.get('/stats', auth, async (req, res) => {
    try {
        const Farmer = require('../models/Farmer');
        const Order = require('../models/Order');
        const Advance = require('../models/Advance');

        const [farmersCount, ordersTotal, pendingAdvances] = await Promise.all([
            Farmer.countDocuments({ owner: req.userId, isActive: true }),
            Order.aggregate([
                { $match: { user: req.userId, status: 'delivered' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Advance.aggregate([
                { $match: { owner: req.userId, status: 'pending' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.json({
            success: true,
            response: {
                farmers: farmersCount,
                totalSales: ordersTotal[0]?.total || 0,
                pendingAdvances: pendingAdvances[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stats'
        });
    }
});

module.exports = router;
