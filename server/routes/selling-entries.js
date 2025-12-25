const express = require('express');
const router = express.Router();
const SellingEntry = require('../models/SellingEntry');
const Member = require('../models/Member');
const auth = require('../middleware/auth');

const normalizeToUtcStartOfDay = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

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
        const {
            memberId,
            date,
            rate,
            notes,
            // Backward compatible payload (optional)
            shift,
            quantity,
            // New payload
            morningQuantity,
            eveningQuantity
        } = req.body;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: 'Member is required'
            });
        }

        if (rate === undefined || rate === null || rate === '') {
            return res.status(400).json({
                success: false,
                message: 'Rate is required'
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

        const entryDate = normalizeToUtcStartOfDay(date);
        const entryRate = parseFloat(rate);

        if (Number.isNaN(entryRate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid rate'
            });
        }

        const hasShiftPayload = !!shift && quantity !== undefined && quantity !== null && quantity !== '';

        const incomingMorningRaw = hasShiftPayload
            ? (shift === 'morning' ? parseFloat(quantity) : 0)
            : parseFloat(morningQuantity || 0);

        const incomingEveningRaw = hasShiftPayload
            ? (shift === 'evening' ? parseFloat(quantity) : 0)
            : parseFloat(eveningQuantity || 0);

        const incomingMorning = Number.isNaN(incomingMorningRaw) ? 0 : Math.max(0, incomingMorningRaw);
        const incomingEvening = Number.isNaN(incomingEveningRaw) ? 0 : Math.max(0, incomingEveningRaw);

        if (incomingMorning <= 0 && incomingEvening <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Morning or evening quantity is required'
            });
        }

        // One entry per owner+member+date: create or add into existing
        let entry = await SellingEntry.findOne({
            owner: req.userId,
            member: memberId,
            date: entryDate
        });

        let deltaLiters = 0;
        let deltaAmount = 0;

        if (!entry) {
            const created = await SellingEntry.create({
                member: memberId,
                owner: req.userId,
                date: entryDate,
                morningQuantity: incomingMorning,
                eveningQuantity: incomingEvening,
                rate: entryRate,
                notes: notes?.trim() || ''
            });

            entry = created;
            deltaLiters = incomingMorning + incomingEvening;
            deltaAmount = Number(created.amount || 0);
        } else {
            const oldTotalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
            const oldAmount = Number(entry.amount || 0);

            entry.morningQuantity = Number(entry.morningQuantity || 0) + incomingMorning;
            entry.eveningQuantity = Number(entry.eveningQuantity || 0) + incomingEvening;
            entry.rate = entryRate;
            if (notes !== undefined) entry.notes = notes?.trim() || '';

            await entry.save();

            const newTotalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
            const newAmount = Number(entry.amount || 0);

            deltaLiters = newTotalQty - oldTotalQty;
            deltaAmount = newAmount - oldAmount;
        }

        // Update member totals by delta
        await Member.findByIdAndUpdate(memberId, {
            $inc: {
                totalLiters: deltaLiters,
                totalAmount: deltaAmount,
                pendingAmount: deltaAmount
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
        const totalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
        await Member.findByIdAndUpdate(entry.member, {
            $inc: {
                totalLiters: -totalQty,
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
