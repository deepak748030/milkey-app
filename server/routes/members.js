const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const auth = require('../middleware/auth');

// GET /api/members - Get all members for current user
router.get('/', auth, async (req, res) => {
    try {
        const { search } = req.query;
        const query = { owner: req.userId, isActive: true };

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const members = await Member.find(query)
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            response: {
                data: members,
                count: members.length
            }
        });
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get members'
        });
    }
});

// GET /api/members/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const member = await Member.findOne({
            _id: req.params.id,
            owner: req.userId
        }).lean();

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            response: member
        });
    } catch (error) {
        console.error('Get member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get member'
        });
    }
});

// POST /api/members
router.post('/', auth, async (req, res) => {
    try {
        const { name, mobile, address, ratePerLiter = 50 } = req.body;

        if (!name || !mobile) {
            return res.status(400).json({
                success: false,
                message: 'Name and mobile are required'
            });
        }

        const member = await Member.create({
            name: String(name).trim(),
            mobile: String(mobile).trim(),
            address: address?.trim() || '',
            ratePerLiter: parseFloat(ratePerLiter) || 50,
            owner: req.userId
        });

        res.status(201).json({
            success: true,
            message: 'Member added successfully',
            response: member
        });
    } catch (error) {
        console.error('Create member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add member'
        });
    }
});

// PUT /api/members/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, mobile, address, ratePerLiter } = req.body;

        const updateData = {};
        if (name) updateData.name = String(name).trim();
        if (mobile) updateData.mobile = String(mobile).trim();
        if (address !== undefined) updateData.address = address?.trim() || '';
        if (ratePerLiter !== undefined) updateData.ratePerLiter = parseFloat(ratePerLiter) || 50;

        const member = await Member.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            updateData,
            { new: true }
        );

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            message: 'Member updated successfully',
            response: member
        });
    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update member'
        });
    }
});

// DELETE /api/members/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const member = await Member.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: false },
            { new: true }
        );

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            message: 'Member deleted successfully'
        });
    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete member'
        });
    }
});

module.exports = router;
