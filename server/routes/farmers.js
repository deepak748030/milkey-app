const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');

// GET /api/farmers - Get all farmers for current user
router.get('/', auth, async (req, res) => {
    try {
        const farmers = await Farmer.find({ owner: req.userId, isActive: true })
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
            code: req.params.code,
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

// POST /api/farmers
router.post('/', auth, async (req, res) => {
    try {
        const { code, name, mobile, address } = req.body;

        if (!code || !name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Code, name, and mobile are required'
            });
        }

        // Check if code already exists for this owner
        const existingFarmer = await Farmer.findOne({
            code,
            owner: req.userId
        });

        if (existingFarmer) {
            return res.status(400).json({
                success: false,
                message: 'Farmer with this code already exists'
            });
        }

        const farmer = await Farmer.create({
            code: code.trim(),
            name: name.trim(),
            mobile: mobile.trim(),
            address: address?.trim() || '',
            owner: req.userId
        });

        res.status(201).json({
            success: true,
            message: 'Farmer added successfully',
            response: farmer
        });
    } catch (error) {
        console.error('Create farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add farmer'
        });
    }
});

// PUT /api/farmers/:id
router.put('/:id', auth, async (req, res) => {
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

// DELETE /api/farmers/:id
router.delete('/:id', auth, async (req, res) => {
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
