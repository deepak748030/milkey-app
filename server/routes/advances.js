const express = require('express');
const router = express.Router();
const Advance = require('../models/Advance');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');

// GET /api/advances - Get all advances
router.get('/', auth, async (req, res) => {
    try {
        const { farmerId, status, limit = 50, page = 1 } = req.query;

        const query = { owner: req.userId };
        if (farmerId) query.farmer = farmerId;
        if (status) query.status = status;

        const advances = await Advance.find(query)
            .populate('farmer', 'code name')
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const total = await Advance.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: advances,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get advances error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get advances'
        });
    }
});

// POST /api/advances
router.post('/', auth, async (req, res) => {
    try {
        const { farmerCode, amount, date, note } = req.body;

        if (!farmerCode || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Farmer code and amount are required'
            });
        }

        // Find farmer by code
        const farmer = await Farmer.findOne({
            code: farmerCode,
            owner: req.userId,
            isActive: true
        });

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        const advance = await Advance.create({
            farmer: farmer._id,
            owner: req.userId,
            amount: parseFloat(amount),
            date: date ? new Date(date) : new Date(),
            note: note?.trim() || ''
        });

        // Update farmer pending amount
        farmer.pendingAmount += parseFloat(amount);
        await farmer.save();

        const populatedAdvance = await Advance.findById(advance._id)
            .populate('farmer', 'code name')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Advance added successfully',
            response: populatedAdvance
        });
    } catch (error) {
        console.error('Create advance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add advance'
        });
    }
});

// PUT /api/advances/:id/settle
router.put('/:id/settle', auth, async (req, res) => {
    try {
        const { settledAmount } = req.body;

        const advance = await Advance.findOne({
            _id: req.params.id,
            owner: req.userId
        }).populate('farmer');

        if (!advance) {
            return res.status(404).json({
                success: false,
                message: 'Advance not found'
            });
        }

        const amountToSettle = parseFloat(settledAmount) || advance.amount;
        advance.settledAmount += amountToSettle;

        if (advance.settledAmount >= advance.amount) {
            advance.status = 'settled';
            advance.settledAmount = advance.amount;
        } else {
            advance.status = 'partial';
        }

        await advance.save();

        // Update farmer pending amount
        if (advance.farmer) {
            const farmer = await Farmer.findById(advance.farmer._id);
            farmer.pendingAmount = Math.max(0, farmer.pendingAmount - amountToSettle);
            await farmer.save();
        }

        res.json({
            success: true,
            message: 'Advance settled',
            response: advance
        });
    } catch (error) {
        console.error('Settle advance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to settle advance'
        });
    }
});

// DELETE /api/advances/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const advance = await Advance.findOne({
            _id: req.params.id,
            owner: req.userId
        });

        if (!advance) {
            return res.status(404).json({
                success: false,
                message: 'Advance not found'
            });
        }

        // Update farmer pending amount
        if (advance.status === 'pending') {
            const farmer = await Farmer.findById(advance.farmer);
            if (farmer) {
                farmer.pendingAmount = Math.max(0, farmer.pendingAmount - advance.amount);
                await farmer.save();
            }
        }

        await Advance.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Advance deleted successfully'
        });
    } catch (error) {
        console.error('Delete advance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete advance'
        });
    }
});

module.exports = router;
