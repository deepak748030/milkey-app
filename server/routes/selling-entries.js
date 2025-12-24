const express = require('express');
const router = express.Router();
const SellingEntry = require('../models/SellingEntry');
const Member = require('../models/Member');
const auth = require('../middleware/auth');

// GET /api/selling-entries - Get all entries for current user
router.get('/', auth, async (req, res) => {
    try {
        const { limit = 50, page = 1, memberId, startDate, endDate } = req.query;

        const query = { owner: req.userId };

        if (memberId) {
            query.member = memberId;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const entries = await SellingEntry.find(query)
            .populate('member', 'name mobile ratePerLiter')
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await SellingEntry.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: entries,
                count: entries.length,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get selling entries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get entries'
        });
    }
});

// POST /api/selling-entries
router.post('/', auth, async (req, res) => {
    try {
        const { memberId, quantity, rate, shift, date, notes } = req.body;

        if (!memberId || !quantity || !rate || !shift) {
            return res.status(400).json({
                success: false,
                message: 'Member, quantity, rate, and shift are required'
            });
        }

        // Verify member exists and belongs to user
        const member = await Member.findOne({
            _id: memberId,
            owner: req.userId,
            isActive: true
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const entryDate = date ? new Date(date) : new Date();
        const qty = parseFloat(quantity);
        const entryRate = parseFloat(rate);
        const amount = qty * entryRate;

        const entry = await SellingEntry.create({
            member: memberId,
            owner: req.userId,
            date: entryDate,
            shift,
            quantity: qty,
            rate: entryRate,
            amount,
            notes: notes?.trim() || ''
        });

        // Update member totals
        await Member.findByIdAndUpdate(memberId, {
            $inc: {
                totalLiters: qty,
                totalAmount: amount,
                pendingAmount: amount
            }
        });

        // Populate member for response
        const populatedEntry = await SellingEntry.findById(entry._id)
            .populate('member', 'name mobile ratePerLiter')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Entry saved successfully',
            response: populatedEntry
        });
    } catch (error) {
        console.error('Create selling entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save entry'
        });
    }
});

// DELETE /api/selling-entries/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const entry = await SellingEntry.findOne({
            _id: req.params.id,
            owner: req.userId
        });

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Entry not found'
            });
        }

        // Reverse member totals
        await Member.findByIdAndUpdate(entry.member, {
            $inc: {
                totalLiters: -entry.quantity,
                totalAmount: -entry.amount,
                pendingAmount: -entry.amount
            }
        });

        await SellingEntry.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Entry deleted successfully'
        });
    } catch (error) {
        console.error('Delete selling entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete entry'
        });
    }
});

module.exports = router;
