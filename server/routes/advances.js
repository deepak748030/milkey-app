const express = require('express');
const router = express.Router();
const Advance = require('../models/Advance');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

// GET /api/advances - Get all advances with pending first, then settled
router.get('/', auth, async (req, res) => {
    try {
        const { farmerId, status, limit = 50, page = 1, search, sortOrder = 'pendingFirst' } = req.query;

        const baseQuery = { owner: req.userId };
        if (farmerId) baseQuery.farmer = farmerId;

        // If specific status requested, use simple query
        if (status && status !== 'all') {
            baseQuery.status = status;
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let advances = [];
        let total = 0;
        let pendingCount = 0;
        let settledCount = 0;

        if (sortOrder === 'pendingFirst' && (!status || status === 'all')) {
            // Custom sorting: pending first, then settled
            // Get counts for both statuses
            const pendingQuery = { ...baseQuery, status: 'pending' };
            const settledQuery = { ...baseQuery, status: { $in: ['settled', 'partial'] } };

            // Apply search filter if provided
            let farmerIds = null;
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                const matchingFarmers = await Farmer.find({
                    owner: req.userId,
                    $or: [
                        { code: searchRegex },
                        { name: searchRegex }
                    ]
                }).select('_id').lean();
                farmerIds = matchingFarmers.map(f => f._id);
                pendingQuery.farmer = { $in: farmerIds };
                settledQuery.farmer = { $in: farmerIds };
            }

            pendingCount = await Advance.countDocuments(pendingQuery);
            settledCount = await Advance.countDocuments(settledQuery);
            total = pendingCount + settledCount;

            // Determine which records to fetch based on skip
            if (skip < pendingCount) {
                // Still in pending advances range
                const pendingLimit = Math.min(limitNum, pendingCount - skip);
                const pendingAdvances = await Advance.find(pendingQuery)
                    .populate('farmer', 'code name')
                    .sort({ date: -1 })
                    .skip(skip)
                    .limit(pendingLimit)
                    .lean();

                advances = [...pendingAdvances];

                // If we need more records from settled
                const remainingLimit = limitNum - pendingAdvances.length;
                if (remainingLimit > 0) {
                    const settledAdvances = await Advance.find(settledQuery)
                        .populate('farmer', 'code name')
                        .sort({ date: -1 })
                        .skip(0)
                        .limit(remainingLimit)
                        .lean();
                    advances = [...advances, ...settledAdvances];
                }
            } else {
                // All pending already shown, now showing settled
                const settledSkip = skip - pendingCount;
                const settledAdvances = await Advance.find(settledQuery)
                    .populate('farmer', 'code name')
                    .sort({ date: -1 })
                    .skip(settledSkip)
                    .limit(limitNum)
                    .lean();
                advances = settledAdvances;
            }
        } else {
            // Standard query with optional search
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                const matchingFarmers = await Farmer.find({
                    owner: req.userId,
                    $or: [
                        { code: searchRegex },
                        { name: searchRegex }
                    ]
                }).select('_id').lean();
                baseQuery.farmer = { $in: matchingFarmers.map(f => f._id) };
            }

            advances = await Advance.find(baseQuery)
                .populate('farmer', 'code name')
                .sort({ date: -1 })
                .limit(limitNum)
                .skip(skip)
                .lean();

            total = await Advance.countDocuments(baseQuery);
            pendingCount = await Advance.countDocuments({ ...baseQuery, status: 'pending' });
            settledCount = total - pendingCount;
        }

        // Calculate total pending amount (only from pending advances)
        let totalPendingAmount = 0;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const matchingFarmers = await Farmer.find({
                owner: req.userId,
                $or: [{ code: searchRegex }, { name: searchRegex }]
            }).select('_id').lean();
            const pendingAmountResult = await Advance.aggregate([
                {
                    $match: {
                        owner: req.userId,
                        status: 'pending',
                        farmer: { $in: matchingFarmers.map(f => f._id) }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            totalPendingAmount = pendingAmountResult[0]?.total || 0;
        } else {
            const pendingAmountResult = await Advance.aggregate([
                { $match: { owner: req.userId, status: 'pending' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            totalPendingAmount = pendingAmountResult[0]?.total || 0;
        }

        res.json({
            success: true,
            response: {
                data: advances,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                    pendingCount,
                    settledCount
                },
                totalPendingAmount
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

// POST /api/advances (requires register subscription)
router.post('/', auth, requireSubscription('register'), async (req, res) => {
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

// PUT /api/advances/:id/settle (requires register subscription)
router.put('/:id/settle', auth, requireSubscription('register'), async (req, res) => {
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

// DELETE /api/advances/:id (requires register subscription)
router.delete('/:id', auth, requireSubscription('register'), async (req, res) => {
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
