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

        // Get unpaid milk collections
        const unpaidCollections = await MilkCollection.aggregate([
            {
                $match: {
                    farmer: farmer._id,
                    owner: req.userId,
                    isPaid: false
                }
            },
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

        // Get pending advances
        const pendingAdvances = await Advance.aggregate([
            {
                $match: {
                    farmer: farmer._id,
                    owner: req.userId,
                    status: { $in: ['pending', 'partial'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAdvance: { $sum: { $subtract: ['$amount', '$settledAmount'] } },
                    count: { $sum: 1 }
                }
            }
        ]);

        const milkData = unpaidCollections[0] || { totalQuantity: 0, totalAmount: 0, count: 0, minDate: null, maxDate: null };
        const advanceData = pendingAdvances[0] || { totalAdvance: 0, count: 0 };

        const netPayable = milkData.totalAmount - advanceData.totalAdvance;

        res.json({
            success: true,
            response: {
                farmer: {
                    id: farmer._id,
                    code: farmer.code,
                    name: farmer.name,
                    mobile: farmer.mobile
                },
                milk: {
                    totalQuantity: milkData.totalQuantity,
                    totalAmount: milkData.totalAmount,
                    collections: milkData.count,
                    periodStart: milkData.minDate,
                    periodEnd: milkData.maxDate
                },
                advances: {
                    totalPending: advanceData.totalAdvance,
                    count: advanceData.count
                },
                netPayable: Math.max(0, netPayable),
                advanceBalance: netPayable < 0 ? Math.abs(netPayable) : 0
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

// POST /api/payments - Create payment (settle farmer dues)
router.post('/', auth, async (req, res) => {
    try {
        const { farmerCode, amount, paymentMethod, reference, notes } = req.body;

        if (!farmerCode || !amount) {
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

        // Calculate totals
        const totalMilkAmount = unpaidCollections.reduce((sum, c) => sum + c.amount, 0);
        const totalAdvanceAmount = pendingAdvances.reduce((sum, a) => sum + (a.amount - a.settledAmount), 0);
        const netPayable = totalMilkAmount - totalAdvanceAmount;

        const paymentAmount = parseFloat(amount);

        // Create payment record
        const payment = await Payment.create({
            farmer: farmer._id,
            owner: req.userId,
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            reference: reference?.trim() || '',
            notes: notes?.trim() || '',
            periodStart: unpaidCollections[0]?.date,
            periodEnd: unpaidCollections[unpaidCollections.length - 1]?.date,
            settledCollections: unpaidCollections.map(c => c._id),
            settledAdvances: pendingAdvances.map(a => a._id),
            totalMilkAmount,
            totalAdvanceDeduction: totalAdvanceAmount,
            netPayable
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

        // Update farmer pending amount
        farmer.pendingAmount = 0;
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

module.exports = router;
