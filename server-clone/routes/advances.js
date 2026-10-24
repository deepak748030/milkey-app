const express = require('express');
const router = express.Router();
const Advance = require('../models/Advance');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

// GET /api/advances - Get all advances (only pending - crossed/settled hidden as per UI request)
router.get('/', auth, async (req, res) => {
    try {
        const { farmerId, status, limit = 10, page = 1, search, sortOrder = 'pendingFirst', sortBy, order, includeDeleted } = req.query;

        const baseQuery = { owner: req.userId };
        if (includeDeleted !== 'true') baseQuery.isDeleted = { $ne: true };
        if (farmerId) baseQuery.farmer = farmerId;

        // If specific status requested, use it; otherwise default to pending+partial (only settled hidden)
        if (status && status !== 'all') {
            baseQuery.status = status;
        } else {
            // Default: pending + partial visible — only 'settled' is hidden (crossed)
            baseQuery.status = { $in: ['pending', 'partial'] };
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let advances = [];
        let total = 0;
        let pendingCount = 0;
        let settledCount = 0;

        // Determine sort: by amount if requested, else by date
        let sortField = { date: -1 };
        if (sortBy === 'amount') {
            sortField = { amount: order === 'asc' ? 1 : -1, date: -1 };
        }

        // Apply search filter if provided - search by code directly (no regex)
        let searchFarmerIds = null;
        if (search) {
            const matchingFarmers = await Farmer.find({
                owner: req.userId,
                code: search.trim()
            }).select('_id').lean();
            searchFarmerIds = matchingFarmers.map(f => f._id);
            baseQuery.farmer = { $in: searchFarmerIds };
        }

        // Only pending advances should be shown (crossed data hidden)
        advances = await Advance.find(baseQuery)
            .populate('farmer', 'code name')
            .sort(sortField)
            .limit(limitNum)
            .skip(skip)
            .lean();

        total = await Advance.countDocuments(baseQuery);
        // pendingCount = pending + partial (visible), settledCount = hidden
        pendingCount = total;
        const settledBase = { owner: req.userId, status: 'settled', isDeleted: { $ne: true } };
        if (search && searchFarmerIds) settledBase.farmer = { $in: searchFarmerIds };
        if (farmerId) settledBase.farmer = farmerId;
        settledCount = await Advance.countDocuments(settledBase);

        // Calculate total pending amount: for pending sum amount, for partial sum remaining (amount - settledAmount)
        let totalPendingAmount = 0;
        if (search && searchFarmerIds) {
            const agg = await Advance.aggregate([
                {
                    $match: {
                        owner: req.userId,
                        status: { $in: ['pending', 'partial'] },
                        isDeleted: { $ne: true },
                        farmer: { $in: searchFarmerIds }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'partial'] },
                                    { $subtract: ['$amount', { $ifNull: ['$settledAmount', 0] }] },
                                    '$amount'
                                ]
                            }
                        }
                    }
                }
            ]);
            totalPendingAmount = agg[0]?.total || 0;
        } else {
            const agg = await Advance.aggregate([
                { $match: { owner: req.userId, status: { $in: ['pending', 'partial'] }, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'partial'] },
                                    { $subtract: ['$amount', { $ifNull: ['$settledAmount', 0] }] },
                                    '$amount'
                                ]
                            }
                        }
                    }
                }
            ]);
            totalPendingAmount = agg[0]?.total || 0;
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

        // Soft delete - keep in DB for settlement history (payment settlement history me save rahe)
        advance.isDeleted = true;
        advance.deletedAt = new Date();
        // keep original status/amount but exclude from pending lists
        await advance.save();

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
