const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const codeRegex = (code) => new RegExp(`^${escapeRegExp(normalizeCode(code))}$`, 'i');

// GET /api/farmers - Get all farmers for current user (optionally filter by type)
router.get('/', auth, async (req, res) => {
    try {
        const { type } = req.query;
        const query = { owner: req.userId, isActive: true };

        if (type && ['farmer', 'member'].includes(type)) {
            query.type = type;
        }

        const farmers = await Farmer.find(query)
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
        console.error('Get farmers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get farmers'
        });
    }
});

// GET /api/farmers/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const farmer = await Farmer.findOne({
            _id: req.params.id,
            owner: req.userId
        }).lean();

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            response: farmer
        });
    } catch (error) {
        console.error('Get farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get farmer'
        });
    }
});

// GET /api/farmers/code/:code
router.get('/code/:code', auth, async (req, res) => {
    try {
        const farmer = await Farmer.findOne({
            code: codeRegex(req.params.code),
            owner: req.userId,
            isActive: true
        }).lean();

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            response: farmer
        });
    } catch (error) {
        console.error('Get farmer by code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get farmer'
        });
    }
});

// POST /api/farmers (requires register subscription)
router.post('/', auth, requireSubscription('register'), async (req, res) => {
    try {
        const { code, name, mobile, address, type = 'farmer' } = req.body;

        const normalizedCode = normalizeCode(code);
        const validType = ['farmer', 'member'].includes(type) ? type : 'farmer';

        if (!normalizedCode || !name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Code, name, and mobile are required'
            });
        }

        // Check if code already exists for this owner and type (case-insensitive)
        const existingFarmer = await Farmer.findOne({
            code: codeRegex(normalizedCode),
            owner: req.userId,
            type: validType
        });

        if (existingFarmer) {
            return res.status(400).json({
                success: false,
                message: `${validType === 'member' ? 'Member' : 'Farmer'} with this code already exists`
            });
        }

        const farmer = await Farmer.create({
            code: normalizedCode,
            name: String(name).trim(),
            mobile: String(mobile).trim(),
            address: address?.trim() || '',
            owner: req.userId,
            type: validType
        });

        res.status(201).json({
            success: true,
            message: `${validType === 'member' ? 'Member' : 'Farmer'} added successfully`,
            response: farmer
        });
    } catch (error) {
        console.error('Create farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add'
        });
    }
});

// PUT /api/farmers/:id (requires register subscription)
router.put('/:id', auth, requireSubscription('register'), async (req, res) => {
    try {
        const { name, mobile, address } = req.body;

        const farmer = await Farmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { name, mobile, address },
            { new: true }
        );

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Farmer updated successfully',
            response: farmer
        });
    } catch (error) {
        console.error('Update farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update farmer'
        });
    }
});

// DELETE /api/farmers/:id (requires register subscription)
router.delete('/:id', auth, requireSubscription('register'), async (req, res) => {
    try {
        const farmer = await Farmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: false },
            { new: true }
        );

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Farmer deleted successfully'
        });
    } catch (error) {
        console.error('Delete farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete farmer'
        });
    }
});

module.exports = router;
