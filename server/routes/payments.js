const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const MilkCollection = require('../models/MilkCollection');
const Advance = require('../models/Advance');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');

// GET /api/payments - Get all payments
router.get('/', auth, async (req, res) => {
    try {
        const { farmerId, startDate, endDate, limit = 50, page = 1 } = req.query;

        const query = { owner: req.userId };
        if (farmerId) query.farmer = farmerId;

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const payments = await Payment.find(query)
            .populate('farmer', 'code name')
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const total = await Payment.countDocuments(query);

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
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payments'
        });
    }
});

// GET /api/payments/farmer-summary/:farmerCode - Get pending summary for a farmer
router.get('/farmer-summary/:farmerCode', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const farmer = await Farmer.findOne({
            code: req.params.farmerCode,
            owner: req.userId
        });

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        // Build date filter for milk collections
        const milkQuery = {
            farmer: farmer._id,
            owner: req.userId,
            isPaid: false
        };

        if (startDate || endDate) {
            milkQuery.date = {};
            if (startDate) milkQuery.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                milkQuery.date.$lte = end;
            }
        }

        // Get unpaid milk collections in date range
        const unpaidCollections = await MilkCollection.aggregate([
            { $match: milkQuery },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                    minDate: { $min: '$date' },
                    maxDate: { $max: '$date' }
                }
            }
        ]);

        // Get pending advances (all pending, not filtered by date)
        const pendingAdvances = await Advance.find({
            farmer: farmer._id,
            owner: req.userId,
            status: { $in: ['pending', 'partial'] }
        }).sort({ date: 1 });

        const advanceTotal = pendingAdvances.reduce((sum, a) => sum + (a.amount - a.settledAmount), 0);

        const milkData = unpaidCollections[0] || { totalQuantity: 0, totalAmount: 0, count: 0, minDate: null, maxDate: null };

        const netPayable = milkData.totalAmount - advanceTotal;

        res.json({
            success: true,
            response: {
                farmer: {
                    id: farmer._id,
                    code: farmer.code,
                    name: farmer.name,
                    mobile: farmer.mobile,
                    currentBalance: farmer.currentBalance || 0
                },
                milk: {
                    totalQuantity: milkData.totalQuantity,
                    totalAmount: milkData.totalAmount,
                    collections: milkData.count,
                    periodStart: milkData.minDate,
                    periodEnd: milkData.maxDate
                },
                advances: {
                    totalPending: advanceTotal,
                    count: pendingAdvances.length,
                    items: pendingAdvances.map(a => ({
                        _id: a._id,
                        amount: a.amount,
                        settledAmount: a.settledAmount,
                        remaining: a.amount - a.settledAmount,
                        date: a.date,
                        note: a.note,
                        status: a.status
                    }))
                },
                netPayable,
                closingBalance: netPayable
            }
        });
    } catch (error) {
        console.error('Get farmer summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get farmer summary'
        });
    }
});

// Helper function to check if two date ranges overlap
const rangesOverlap = (start1, end1, start2, end2) => {
    return start1 <= end2 && end1 >= start2;
};

// POST /api/payments - Create payment (settle farmer dues)
router.post('/', auth, async (req, res) => {
    try {
        const { farmerCode, amount, paymentMethod, reference, notes, totalMilkAmount: providedMilkAmount, periodStart: clientPeriodStart, periodEnd: clientPeriodEnd } = req.body;

        if (!farmerCode || amount === undefined || amount === null) {
            return res.status(400).json({
                success: false,
                message: 'Farmer code and amount are required'
            });
        }

        const farmer = await Farmer.findOne({
            code: farmerCode,
            owner: req.userId
        });

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        // Use client-provided period dates if available, otherwise use collection dates
        // Parse dates with time component to avoid timezone issues
        let periodStart = null;
        let periodEnd = null;

        if (clientPeriodStart) {
            periodStart = new Date(clientPeriodStart + 'T12:00:00');
        }

        if (clientPeriodEnd) {
            periodEnd = new Date(clientPeriodEnd + 'T12:00:00');
        }

        // **VALIDATION: Check for overlapping payment periods for the same farmer**
        if (periodStart && periodEnd) {
            const existingPayments = await Payment.find({
                farmer: farmer._id,
                owner: req.userId,
                periodStart: { $ne: null },
                periodEnd: { $ne: null }
            }).lean();

            const overlappingPayments = existingPayments.filter(p => {
                const existingStart = new Date(p.periodStart);
                const existingEnd = new Date(p.periodEnd);
                return rangesOverlap(periodStart, periodEnd, existingStart, existingEnd);
            });

            if (overlappingPayments.length > 0) {
                const conflictPeriods = overlappingPayments.map(p => {
                    const s = new Date(p.periodStart);
                    const e = new Date(p.periodEnd);
                    return `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
                }).join(', ');

                console.log(`Payment period conflict for farmer ${farmerCode}: Requested ${clientPeriodStart} to ${clientPeriodEnd} overlaps with ${conflictPeriods}`);

                return res.status(400).json({
                    success: false,
                    message: `Payment period overlaps with existing settlement(s): ${conflictPeriods}. Please select a different date range.`
                });
            }
        }

        // Get unpaid collections
        const unpaidCollections = await MilkCollection.find({
            farmer: farmer._id,
            owner: req.userId,
            isPaid: false
        }).sort({ date: 1 });

        // Get pending advances
        const pendingAdvances = await Advance.find({
            farmer: farmer._id,
            owner: req.userId,
            status: { $in: ['pending', 'partial'] }
        }).sort({ date: 1 });

        // Use provided milk amount from frontend if available, otherwise calculate from DB
        const totalMilkAmount = providedMilkAmount !== undefined ? parseFloat(providedMilkAmount) : unpaidCollections.reduce((sum, c) => sum + c.amount, 0);
        const totalAdvanceAmount = pendingAdvances.reduce((sum, a) => sum + (a.amount - a.settledAmount), 0);

        // Get previous balance from farmer (can be + or -)
        const previousBalance = farmer.currentBalance || 0;

        // Net payable = milk amount - advances + previous balance
        const netPayable = totalMilkAmount - totalAdvanceAmount + previousBalance;

        const paymentAmount = parseFloat(amount) || 0;

        // Closing balance = net payable - paid amount (can be + or -)
        const closingBalance = netPayable - paymentAmount;

        // If period dates not provided from client, use collection dates
        if (!periodStart && unpaidCollections.length > 0) {
            periodStart = unpaidCollections[0].date;
        }
        if (!periodEnd && unpaidCollections.length > 0) {
            periodEnd = unpaidCollections[unpaidCollections.length - 1].date;
        }

        // Create payment record
        const payment = await Payment.create({
            farmer: farmer._id,
            owner: req.userId,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            reference: reference?.trim() || '',
            notes: notes?.trim() || '',
            periodStart,
            periodEnd,
            settledCollections: unpaidCollections.map(c => c._id),
            settledAdvances: pendingAdvances.map(a => a._id),
            totalMilkAmount,
            totalAdvanceDeduction: totalAdvanceAmount,
            netPayable,
            previousBalance,
            closingBalance
        });

        // Mark collections as paid
        await MilkCollection.updateMany(
            { _id: { $in: unpaidCollections.map(c => c._id) } },
            { isPaid: true }
        );

        // Settle advances
        for (const advance of pendingAdvances) {
            advance.status = 'settled';
            advance.settledAmount = advance.amount;
            await advance.save();
        }

        // Update farmer - set pending to 0 and save closing balance as current balance for next time
        farmer.pendingAmount = 0;
        farmer.currentBalance = closingBalance;
        await farmer.save();

        const populatedPayment = await Payment.findById(payment._id)
            .populate('farmer', 'code name')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            response: populatedPayment
        });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment'
        });
    }
});

// GET /api/payments/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findOne({
            _id: req.params.id,
            owner: req.userId
        })
            .populate('farmer', 'code name mobile')
            .populate('settledCollections')
            .populate('settledAdvances')
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
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment'
        });
    }
});

// PUT /api/payments/:id - Update payment
router.put('/:id', auth, async (req, res) => {
    try {
        const { amount, paymentMethod, reference, notes, totalMilkAmount, periodStart, periodEnd } = req.body;

        const payment = await Payment.findOne({
            _id: req.params.id,
            owner: req.userId
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Get farmer for balance update
        const farmer = await Farmer.findById(payment.farmer);
        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Associated farmer not found'
            });
        }

        // **VALIDATION: Check for overlapping payment periods when updating dates**
        if (periodStart || periodEnd) {
            const newPeriodStart = periodStart ? new Date(periodStart + 'T12:00:00') : payment.periodStart;
            const newPeriodEnd = periodEnd ? new Date(periodEnd + 'T12:00:00') : payment.periodEnd;

            if (newPeriodStart && newPeriodEnd) {
                // Find other payments for this farmer (excluding the current one being updated)
                const existingPayments = await Payment.find({
                    farmer: payment.farmer,
                    owner: req.userId,
                    _id: { $ne: payment._id }, // Exclude current payment
                    periodStart: { $ne: null },
                    periodEnd: { $ne: null }
                }).lean();

                const overlappingPayments = existingPayments.filter(p => {
                    const existingStart = new Date(p.periodStart);
                    const existingEnd = new Date(p.periodEnd);
                    return rangesOverlap(newPeriodStart, newPeriodEnd, existingStart, existingEnd);
                });

                if (overlappingPayments.length > 0) {
                    const conflictPeriods = overlappingPayments.map(p => {
                        const s = new Date(p.periodStart);
                        const e = new Date(p.periodEnd);
                        return `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
                    }).join(', ');

                    console.log(`Payment update period conflict for farmer: Requested period overlaps with ${conflictPeriods}`);

                    return res.status(400).json({
                        success: false,
                        message: `Payment period overlaps with existing settlement(s): ${conflictPeriods}. Please select a different date range.`
                    });
                }
            }
        }

        // Calculate the difference in payment amount
        const oldPaymentAmount = payment.amount;
        const newPaymentAmount = amount !== undefined ? parseFloat(amount) : oldPaymentAmount;
        const paymentDifference = newPaymentAmount - oldPaymentAmount;

        // Recalculate closing balance if amount or milk amount changes
        const newMilkAmount = totalMilkAmount !== undefined ? parseFloat(totalMilkAmount) : payment.totalMilkAmount;
        const netPayable = newMilkAmount - payment.totalAdvanceDeduction + payment.previousBalance;
        const newClosingBalance = netPayable - newPaymentAmount;

        // Update payment fields
        payment.amount = newPaymentAmount;
        payment.totalMilkAmount = newMilkAmount;
        payment.netPayable = netPayable;
        payment.closingBalance = newClosingBalance;

        if (paymentMethod) payment.paymentMethod = paymentMethod;
        if (reference !== undefined) payment.reference = reference.trim();
        if (notes !== undefined) payment.notes = notes.trim();

        if (periodStart) {
            payment.periodStart = new Date(periodStart + 'T12:00:00');
        }
        if (periodEnd) {
            payment.periodEnd = new Date(periodEnd + 'T12:00:00');
        }

        await payment.save();

        // Update farmer's current balance based on payment difference
        farmer.currentBalance = farmer.currentBalance - paymentDifference;
        await farmer.save();

        const populatedPayment = await Payment.findById(payment._id)
            .populate('farmer', 'code name')
            .lean();

        res.json({
            success: true,
            message: 'Payment updated successfully',
            response: populatedPayment
        });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment'
        });
    }
});

module.exports = router;
