const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const codeRegex = (code) => new RegExp(`^${escapeRegExp(normalizeCode(code))}$`, 'i');

// GET /api/farmers - Get all farmers for current user (optionally filter by type and search)
// FIX: numeric code sorting and includeInactive handling to prevent blank gaps
router.get('/', auth, async (req, res) => {
    try {
        const { type, search, includeInactive } = req.query;
        const query = { owner: req.userId };

        // Only filter active unless includeInactive is requested
        if (includeInactive !== 'true') {
            query.isActive = true;
        }

        if (type && ['farmer', 'member'].includes(type)) {
            query.type = type;
        }

        // Search by exact code only (no regex) - trimmed and uppercased
        if (search) {
            const trimmed = String(search).trim();
            if (trimmed) {
                query.code = normalizeCode(trimmed);
            }
        }

        // Use aggregation for numeric code sorting (same as purchase-farmers)
        const farmers = await Farmer.aggregate([
            { $match: query },
            {
                $addFields: {
                    _codeNum: {
                        $convert: {
                            input: { $trim: { input: '$code' } },
                            to: 'double',
                            onError: 999999999,
                            onNull: 999999999,
                        },
                    },
                },
            },
            { $sort: { isActive: -1, _codeNum: 1, code: 1 } },
            { $project: { _codeNum: 0 } },
        ]);

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
// FIX: allow reuse of soft-deleted codes by restoring inactive farmer (prevents gaps like 179 missing)
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
            if (existingFarmer.isActive === false) {
                // Restore soft-deleted farmer
                existingFarmer.name = String(name).trim();
                existingFarmer.mobile = String(mobile).trim();
                existingFarmer.address = address?.trim() || '';
                existingFarmer.isActive = true;
                await existingFarmer.save();
                return res.status(200).json({
                    success: true,
                    message: `${validType === 'member' ? 'Member' : 'Farmer'} restored successfully`,
                    response: existingFarmer
                });
            }
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
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Farmer with this code already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to add'
        });
    }
});

// PUT /api/farmers/:id (requires register subscription)
router.put('/:id', auth, requireSubscription('register'), async (req, res) => {
    try {
        const { code, name, mobile, address } = req.body;

        // Find the farmer first
        const existingFarmer = await Farmer.findOne({
            _id: req.params.id,
            owner: req.userId
        });

        if (!existingFarmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        // If code is being changed, check for duplicates
        if (code && normalizeCode(code) !== normalizeCode(existingFarmer.code)) {
            const duplicateCode = await Farmer.findOne({
                code: codeRegex(code),
                owner: req.userId,
                type: existingFarmer.type,
                _id: { $ne: req.params.id }
            });

            if (duplicateCode) {
                return res.status(400).json({
                    success: false,
                    message: `${existingFarmer.type === 'member' ? 'Member' : 'Farmer'} with this code already exists`
                });
            }
        }

        const updateData = { name, mobile, address };
        if (code) {
            updateData.code = normalizeCode(code);
        }

        const farmer = await Farmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            updateData,
            { new: true }
        );

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
