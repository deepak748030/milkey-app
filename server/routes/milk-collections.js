const express = require('express');
const router = express.Router();
const MilkCollection = require('../models/MilkCollection');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');

// GET /api/milk-collections - Get all collections with filters
router.get('/', auth, async (req, res) => {
    try {
        const { farmerId, farmerCode, date, startDate, endDate, shift, isPaid, limit = 50, page = 1 } = req.query;

        const query = { owner: req.userId };

        if (farmerId) query.farmer = farmerId;
        if (shift) query.shift = shift;
        if (isPaid !== undefined) query.isPaid = isPaid === 'true';

        // Date filters
        if (date) {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            query.date = { $gte: dayStart, $lte: dayEnd };
        } else if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        // If farmerCode provided, find farmer first
        if (farmerCode) {
            const farmer = await Farmer.findOne({ code: farmerCode, owner: req.userId });
            if (farmer) {
                query.farmer = farmer._id;
            } else {
                return res.json({
                    success: true,
                    response: { data: [], count: 0, totals: { quantity: 0, amount: 0 } }
                });
            }
        }

        const collections = await MilkCollection.find(query)
            .populate('farmer', 'code name')
            .sort({ date: -1, shift: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        // Calculate totals
        const totals = await MilkCollection.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const total = await MilkCollection.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: collections,
                count: total,
                totals: {
                    quantity: totals[0]?.totalQuantity || 0,
                    amount: totals[0]?.totalAmount || 0
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get milk collections error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get milk collections'
        });
    }
});

// GET /api/milk-collections/today - Get today's summary
router.get('/today', auth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const summary = await MilkCollection.aggregate([
            {
                $match: {
                    owner: req.userId,
                    date: { $gte: today, $lt: tomorrow }
                }
            },
            {
                $group: {
                    _id: '$shift',
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const morningData = summary.find(s => s._id === 'morning') || { totalQuantity: 0, totalAmount: 0, count: 0 };
        const eveningData = summary.find(s => s._id === 'evening') || { totalQuantity: 0, totalAmount: 0, count: 0 };

        res.json({
            success: true,
            response: {
                morning: {
                    quantity: morningData.totalQuantity,
                    amount: morningData.totalAmount,
                    farmers: morningData.count
                },
                evening: {
                    quantity: eveningData.totalQuantity,
                    amount: eveningData.totalAmount,
                    farmers: eveningData.count
                },
                total: {
                    quantity: morningData.totalQuantity + eveningData.totalQuantity,
                    amount: morningData.totalAmount + eveningData.totalAmount,
                    farmers: morningData.count + eveningData.count
                }
            }
        });
    } catch (error) {
        console.error('Get today summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get today summary'
        });
    }
});

// POST /api/milk-collections - Add new collection
router.post('/', auth, async (req, res) => {
    try {
        const { farmerCode, date, shift, quantity, fat, snf, rate, notes } = req.body;

        if (!farmerCode || !quantity || !rate) {
            return res.status(400).json({
                success: false,
                message: 'Farmer code, quantity, and rate are required'
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

        const collection = await MilkCollection.create({
            farmer: farmer._id,
            owner: req.userId,
            date: date ? new Date(date) : new Date(),
            shift: shift || (new Date().getHours() < 12 ? 'morning' : 'evening'),
            quantity: parseFloat(quantity),
            fat: parseFloat(fat) || 0,
            snf: parseFloat(snf) || 0,
            rate: parseFloat(rate),
            amount: parseFloat(quantity) * parseFloat(rate),
            notes: notes?.trim() || ''
        });

        // Update farmer totals
        farmer.totalLiters += parseFloat(quantity);
        farmer.totalPurchase += collection.amount;
        farmer.pendingAmount += collection.amount;
        await farmer.save();

        const populatedCollection = await MilkCollection.findById(collection._id)
            .populate('farmer', 'code name')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Milk collection recorded',
            response: populatedCollection
        });
    } catch (error) {
        console.error('Create milk collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record milk collection'
        });
    }
});

// PUT /api/milk-collections/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { quantity, fat, snf, rate, notes } = req.body;

        const collection = await MilkCollection.findOne({
            _id: req.params.id,
            owner: req.userId
        });

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        const oldAmount = collection.amount;

        if (quantity !== undefined) collection.quantity = parseFloat(quantity);
        if (fat !== undefined) collection.fat = parseFloat(fat);
        if (snf !== undefined) collection.snf = parseFloat(snf);
        if (rate !== undefined) collection.rate = parseFloat(rate);
        if (notes !== undefined) collection.notes = notes.trim();

        collection.amount = collection.quantity * collection.rate;
        await collection.save();

        // Update farmer pending amount
        const amountDiff = collection.amount - oldAmount;
        if (amountDiff !== 0) {
            await Farmer.findByIdAndUpdate(collection.farmer, {
                $inc: { pendingAmount: amountDiff, totalPurchase: amountDiff }
            });
        }

        const populatedCollection = await MilkCollection.findById(collection._id)
            .populate('farmer', 'code name')
            .lean();

        res.json({
            success: true,
            message: 'Collection updated',
            response: populatedCollection
        });
    } catch (error) {
        console.error('Update milk collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update collection'
        });
    }
});

// DELETE /api/milk-collections/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const collection = await MilkCollection.findOne({
            _id: req.params.id,
            owner: req.userId
        });

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Update farmer totals
        await Farmer.findByIdAndUpdate(collection.farmer, {
            $inc: {
                totalLiters: -collection.quantity,
                totalPurchase: -collection.amount,
                pendingAmount: collection.isPaid ? 0 : -collection.amount
            }
        });

        await MilkCollection.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Collection deleted'
        });
    } catch (error) {
        console.error('Delete milk collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete collection'
        });
    }
});

module.exports = router;
