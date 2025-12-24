const express = require('express');
const router = express.Router();
const PurchaseFarmer = require('../models/PurchaseFarmer');
const auth = require('../middleware/auth');

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const codeRegex = (code) => new RegExp(`^${escapeRegExp(normalizeCode(code))}$`, 'i');

// GET /api/purchase-farmers - Get all purchase farmers for current user
router.get('/', auth, async (req, res) => {
    try {
        const { search } = req.query;
        const query = { owner: req.userId, isActive: true };

        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const farmers = await PurchaseFarmer.find(query)
            .sort({ code: 1 })
            .lean();

        res.json({
            success: true,
            response: {
                data: farmers,
                count: farmers.length
            }
        });
    } catch (error) {
        console.error('Get purchase farmers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get purchase farmers'
        });
    }
});

// GET /api/purchase-farmers/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const farmer = await PurchaseFarmer.findOne({
            _id: req.params.id,
            owner: req.userId
        }).lean();

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Purchase farmer not found'
            });
        }

        res.json({
            success: true,
            response: farmer
        });
    } catch (error) {
        console.error('Get purchase farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get purchase farmer'
        });
    }
});

// GET /api/purchase-farmers/code/:code
router.get('/code/:code', auth, async (req, res) => {
    try {
        const farmer = await PurchaseFarmer.findOne({
            code: codeRegex(req.params.code),
            owner: req.userId,
            isActive: true
        }).lean();

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Purchase farmer not found'
            });
        }

        res.json({
            success: true,
            response: farmer
        });
    } catch (error) {
        console.error('Get purchase farmer by code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get purchase farmer'
        });
    }
});

// POST /api/purchase-farmers
router.post('/', auth, async (req, res) => {
    try {
        const { code, name, mobile, address } = req.body;

        const normalizedCode = normalizeCode(code);

        if (!normalizedCode || !name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Code, name, and mobile are required'
            });
        }

        // Check if code already exists for this owner (case-insensitive)
        const existingFarmer = await PurchaseFarmer.findOne({
            code: codeRegex(normalizedCode),
            owner: req.userId
        });

        if (existingFarmer) {
            return res.status(400).json({
                success: false,
                message: 'Purchase farmer with this code already exists'
            });
        }

        const farmer = await PurchaseFarmer.create({
            code: normalizedCode,
            name: String(name).trim(),
            mobile: String(mobile).trim(),
            address: address?.trim() || '',
            owner: req.userId
        });

        res.status(201).json({
            success: true,
            message: 'Purchase farmer added successfully',
            response: farmer
        });
    } catch (error) {
        console.error('Create purchase farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add purchase farmer'
        });
    }
});

// PUT /api/purchase-farmers/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, mobile, address } = req.body;

        const farmer = await PurchaseFarmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { name, mobile, address },
            { new: true }
        );

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Purchase farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Purchase farmer updated successfully',
            response: farmer
        });
    } catch (error) {
        console.error('Update purchase farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update purchase farmer'
        });
    }
});

// PUT /api/purchase-farmers/:id/stats - Update farmer stats after milk collection
router.put('/:id/stats', auth, async (req, res) => {
    try {
        const { quantity, amount } = req.body;

        const farmer = await PurchaseFarmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            {
                $inc: { totalQuantity: quantity || 0, totalAmount: amount || 0 },
                lastPurchaseDate: new Date()
            },
            { new: true }
        );

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Purchase farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Purchase farmer stats updated',
            response: farmer
        });
    } catch (error) {
        console.error('Update purchase farmer stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update purchase farmer stats'
        });
    }
});

// DELETE /api/purchase-farmers/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const farmer = await PurchaseFarmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: false },
            { new: true }
        );

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Purchase farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Purchase farmer deleted successfully'
        });
    } catch (error) {
        console.error('Delete purchase farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete purchase farmer'
        });
    }
});

module.exports = router;
