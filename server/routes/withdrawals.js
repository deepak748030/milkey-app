const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { notifyWithdrawalStatus } = require('../lib/pushNotifications');

// Auth middleware for user
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

// Admin auth middleware
const adminAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminId = decoded.adminId || decoded.userId;
        const admin = await Admin.findById(adminId).lean();
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
        }
        req.adminId = adminId;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

// GET /api/withdrawals - Get user's withdrawals
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const withdrawals = await Withdrawal.find({ user: req.userId })
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            response: {
                balance: user.referralEarnings || 0,
                totalWithdrawn: withdrawals
                    .filter(w => w.status === 'approved')
                    .reduce((sum, w) => sum + w.amount, 0),
                pendingWithdrawals: withdrawals
                    .filter(w => w.status === 'pending')
                    .reduce((sum, w) => sum + w.amount, 0),
                withdrawals
            }
        });
    } catch (error) {
        console.error('[Withdrawals] Error fetching:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/withdrawals - Create withdrawal request
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { amount, paymentMethod, upiId, bankDetails } = req.body;

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Validate amount
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        if (amount > (user.referralEarnings || 0)) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available: ₹${user.referralEarnings || 0}`
            });
        }

        // Validate payment method
        if (paymentMethod === 'upi' && !upiId) {
            return res.status(400).json({ success: false, message: 'UPI ID is required' });
        }

        if (paymentMethod === 'bank') {
            if (!bankDetails?.accountNumber || !bankDetails?.ifscCode || !bankDetails?.accountHolderName) {
                return res.status(400).json({
                    success: false,
                    message: 'Bank account number, IFSC code, and account holder name are required'
                });
            }
        }

        // Deduct balance immediately
        user.referralEarnings = (user.referralEarnings || 0) - amount;
        await user.save();

        // Create withdrawal request
        const withdrawal = await Withdrawal.create({
            user: req.userId,
            amount,
            paymentMethod,
            upiId: paymentMethod === 'upi' ? upiId : '',
            bankDetails: paymentMethod === 'bank' ? bankDetails : {}
        });

        console.log('[Withdrawals] Created withdrawal request:', withdrawal._id, 'Amount:', amount);

        // Send push notification for pending withdrawal
        try {
            await notifyWithdrawalStatus(req.userId, amount, 'pending');
            console.log('[Withdrawals] Sent pending notification to user:', req.userId);
        } catch (notifError) {
            console.error('[Withdrawals] Notification error:', notifError);
        }

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            response: withdrawal
        });
    } catch (error) {
        console.error('[Withdrawals] Error creating:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/withdrawals/admin/all - Admin: Get all withdrawals
router.get('/admin/all', adminAuthMiddleware, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const [withdrawals, total] = await Promise.all([
            Withdrawal.find(query)
                .populate('user', 'name email phone avatar')
                .populate('processedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Withdrawal.countDocuments(query)
        ]);

        const stats = await Withdrawal.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    total: { $sum: '$amount' }
                }
            }
        ]);

        res.json({
            success: true,
            response: {
                withdrawals,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                stats: {
                    pending: stats.find(s => s._id === 'pending') || { count: 0, total: 0 },
                    approved: stats.find(s => s._id === 'approved') || { count: 0, total: 0 },
                    rejected: stats.find(s => s._id === 'rejected') || { count: 0, total: 0 }
                }
            }
        });
    } catch (error) {
        console.error('[Withdrawals] Admin error fetching:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/withdrawals/admin/:id - Admin: Update withdrawal status
router.put('/admin/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { status, adminNote } = req.body;
        const { id } = req.params;

        const withdrawal = await Withdrawal.findById(id);
        if (!withdrawal) {
            return res.status(404).json({ success: false, message: 'Withdrawal not found' });
        }

        const previousStatus = withdrawal.status;

        // If rejecting/cancelling, refund the amount
        if ((status === 'rejected' || status === 'cancelled') && previousStatus === 'pending') {
            await User.findByIdAndUpdate(withdrawal.user, {
                $inc: { referralEarnings: withdrawal.amount }
            });
            console.log('[Withdrawals] Refunded amount:', withdrawal.amount, 'to user:', withdrawal.user);
        }

        withdrawal.status = status;
        withdrawal.adminNote = adminNote || '';
        withdrawal.processedAt = new Date();
        withdrawal.processedBy = req.adminId;
        await withdrawal.save();

        // Send push notification for status change
        try {
            await notifyWithdrawalStatus(withdrawal.user, withdrawal.amount, status, adminNote);
            console.log('[Withdrawals] Sent status notification:', status, 'to user:', withdrawal.user);
        } catch (notifError) {
            console.error('[Withdrawals] Notification error:', notifError);
        }

        const updated = await Withdrawal.findById(id)
            .populate('user', 'name email phone avatar')
            .populate('processedBy', 'name')
            .lean();

        res.json({
            success: true,
            message: `Withdrawal ${status} successfully`,
            response: updated
        });
    } catch (error) {
        console.error('[Withdrawals] Admin error updating:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
