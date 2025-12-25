const express = require('express');
const router = express.Router();
const MemberPayment = require('../models/MemberPayment');
const SellingEntry = require('../models/SellingEntry');
const Member = require('../models/Member');
const auth = require('../middleware/auth');

// GET /api/member-payments - Get all member payments
router.get('/', auth, async (req, res) => {
    try {
        const { memberId, startDate, endDate, limit = 50, page = 1 } = req.query;

        const query = { owner: req.userId };
        if (memberId) query.member = memberId;

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const payments = await MemberPayment.find(query)
            .populate('member', 'name mobile')
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const total = await MemberPayment.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: payments,
                count: total,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get member payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get member payments'
        });
    }
});

// GET /api/member-payments/member-summary/:memberId - Get pending summary for a member
router.get('/member-summary/:memberId', auth, async (req, res) => {
    try {
        const member = await Member.findOne({
            _id: req.params.memberId,
            owner: req.userId
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Return current balance from member's pendingAmount
        res.json({
            success: true,
            response: {
                member: {
                    id: member._id,
                    name: member.name,
                    mobile: member.mobile,
                    currentBalance: member.pendingAmount || 0
                },
                selling: {
                    totalLiters: member.totalLiters || 0,
                    totalAmount: member.totalAmount || 0
                },
                netPayable: member.pendingAmount || 0,
                closingBalance: member.pendingAmount || 0
            }
        });
    } catch (error) {
        console.error('Get member summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get member summary'
        });
    }
});

// POST /api/member-payments - Create payment (settle member dues)
router.post('/', auth, async (req, res) => {
    try {
        const { memberId, amount, paymentMethod, reference, notes } = req.body;

        if (!memberId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Member ID and amount are required'
            });
        }

        const member = await Member.findOne({
            _id: memberId,
            owner: req.userId
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Get unpaid selling entries
        const unpaidEntries = await SellingEntry.find({
            member: member._id,
            owner: req.userId,
            isPaid: false
        }).sort({ date: 1 });

        const totalSellAmount = unpaidEntries.reduce((sum, e) => sum + e.amount, 0);

        // Get previous balance from member's pendingAmount
        const previousBalance = member.pendingAmount || 0;

        const paymentAmount = parseFloat(amount);

        // Closing balance = previous balance - paid amount
        const closingBalance = previousBalance - paymentAmount;

        // Create payment record
        const payment = await MemberPayment.create({
            member: member._id,
            owner: req.userId,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            reference: reference?.trim() || '',
            notes: notes?.trim() || '',
            settledEntries: unpaidEntries.map(e => e._id),
            totalSellAmount,
            netPayable: previousBalance,
            previousBalance,
            closingBalance
        });

        // Mark entries as paid
        await SellingEntry.updateMany(
            { _id: { $in: unpaidEntries.map(e => e._id) } },
            { isPaid: true }
        );

        // Update member - set pendingAmount to closingBalance
        member.pendingAmount = closingBalance;
        await member.save();

        const populatedPayment = await MemberPayment.findById(payment._id)
            .populate('member', 'name mobile')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            response: populatedPayment
        });
    } catch (error) {
        console.error('Create member payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment'
        });
    }
});

// GET /api/member-payments/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const payment = await MemberPayment.findOne({
            _id: req.params.id,
            owner: req.userId
        })
            .populate('member', 'name mobile')
            .populate('settledEntries')
            .lean();

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.json({
            success: true,
            response: payment
        });
    } catch (error) {
        console.error('Get member payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment'
        });
    }
});

module.exports = router;
