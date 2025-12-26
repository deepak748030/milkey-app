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

// GET /api/member-payments/member-summary/:memberId - Get pending summary for a member with date range
router.get('/member-summary/:memberId', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

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

        // Build date filter for entries
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.date = {};
            if (startDate) {
                dateFilter.date.$gte = new Date(startDate + 'T00:00:00.000Z');
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.date.$lte = end;
            }
        }

        // Get entries that are not yet paid AND not already included in a payment for this period
        // We check both isPaid flag and also check if entry was already settled in a payment
        const entryQuery = {
            member: member._id,
            owner: req.userId,
            isPaid: false,
            ...dateFilter
        };

        const unpaidEntries = await SellingEntry.find(entryQuery)
            .select('_id amount date morningQuantity eveningQuantity')
            .lean();

        const unpaidSellAmount = unpaidEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const unpaidQuantity = unpaidEntries.reduce((sum, e) => sum + Number(e.morningQuantity || 0) + Number(e.eveningQuantity || 0), 0);

        const currentBalance = Number(member.sellingPaymentBalance || 0);
        const netPayable = currentBalance + unpaidSellAmount;

        res.json({
            success: true,
            response: {
                member: {
                    id: member._id,
                    name: member.name,
                    mobile: member.mobile,
                    currentBalance
                },
                selling: {
                    totalLiters: unpaidQuantity,
                    totalAmount: unpaidSellAmount,
                    unpaidAmount: unpaidSellAmount,
                    entriesCount: unpaidEntries.length,
                    entries: unpaidEntries.map(e => ({
                        _id: e._id,
                        date: e.date,
                        amount: e.amount
                    }))
                },
                period: {
                    startDate: startDate || null,
                    endDate: endDate || null
                },
                netPayable,
                closingBalance: netPayable
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
        const { memberId, amount, milkAmount, paymentMethod, reference, notes, periodStart, periodEnd, entryIds } = req.body;

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

        // Build date filter for getting unpaid entries
        const dateFilter = {};
        if (periodStart || periodEnd) {
            dateFilter.date = {};
            if (periodStart) {
                dateFilter.date.$gte = new Date(periodStart + 'T00:00:00.000Z');
            }
            if (periodEnd) {
                const end = new Date(periodEnd);
                end.setHours(23, 59, 59, 999);
                dateFilter.date.$lte = end;
            }
        }

        // Get unpaid selling entries for the period
        const entryQuery = {
            member: member._id,
            owner: req.userId,
            isPaid: false,
            ...dateFilter
        };

        // If specific entry IDs provided, use those
        if (entryIds && Array.isArray(entryIds) && entryIds.length > 0) {
            entryQuery._id = { $in: entryIds };
        }

        const unpaidEntries = await SellingEntry.find(entryQuery).sort({ date: 1 });

        const computedUnpaidTotal = unpaidEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

        // Previous balance carried forward
        const previousBalance = Number(member.sellingPaymentBalance || 0);

        const paymentAmount = Number.parseFloat(amount);

        // Use manual milk amount if provided, otherwise use computed unpaid total
        let totalSellAmount = computedUnpaidTotal;
        if (milkAmount !== undefined && milkAmount !== null) {
            const manual = Number.parseFloat(milkAmount);
            if (!Number.isNaN(manual)) totalSellAmount = manual;
        }

        const netPayable = previousBalance + totalSellAmount;
        const closingBalance = netPayable - paymentAmount;

        // Create payment record with period info
        const payment = await MemberPayment.create({
            member: member._id,
            owner: req.userId,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            reference: reference?.trim() || '',
            notes: notes?.trim() || '',
            settledEntries: unpaidEntries.map(e => e._id),
            totalSellAmount,
            netPayable,
            previousBalance,
            closingBalance,
            periodStart: periodStart ? new Date(periodStart) : null,
            periodEnd: periodEnd ? new Date(periodEnd) : null
        });

        // Mark entries as paid
        if (unpaidEntries.length > 0) {
            await SellingEntry.updateMany(
                { _id: { $in: unpaidEntries.map(e => e._id) } },
                { isPaid: true }
            );
        }

        // Update member - set sellingPaymentBalance to closingBalance
        member.sellingPaymentBalance = closingBalance;
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