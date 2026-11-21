const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Member = require('../models/Member');
const SellingAdvance = require('../models/SellingAdvance');
const MemberPayment = require('../models/MemberPayment');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const remainingFor = (doc) => {
    if (doc.isDeleted || doc.type === 'adjusted' || doc.status === 'settled') return 0;
    return Math.max(0, round2(Number(doc.amount || 0) - Number(doc.settledAmount || 0)));
};

const summarize = (docs) => {
    let pendingGiven = 0;
    let adjusted = 0;
    let totalGiven = 0;
    for (const doc of docs) {
        if (doc.isDeleted) continue;
        const amount = Number(doc.amount || 0);
        if (doc.type === 'adjusted') {
            adjusted += amount;
        } else {
            totalGiven += amount;
            pendingGiven += remainingFor(doc);
        }
    }
    return {
        totalGiven: round2(totalGiven),
        adjusted: round2(adjusted),
        pendingGiven: round2(pendingGiven),
        advancePending: round2(Math.max(0, pendingGiven - adjusted)),
    };
};

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// GET /api/selling-advances - isolated list for the logged-in dairy owner.
router.get('/', auth, async (req, res) => {
    try {
        const { memberId, type, status = 'all', includeDeleted, limit = 10, page = 1, search, sortBy, order } = req.query;
        const query = { owner: req.userId };
        if (includeDeleted !== 'true') query.isDeleted = { $ne: true };
        if (memberId && mongoose.isValidObjectId(memberId)) query.member = memberId;
        if (type === 'given' || type === 'adjusted') query.type = type;
        if (status === 'open') {
            // Keep settled/adjusted history in storage, but show only advances
            // with an outstanding amount in the pending list, before paging.
            query.$and = [
                { status: { $ne: 'settled' }, type: { $ne: 'adjusted' } },
                { $expr: { $gt: [{ $ifNull: ['$amount', 0] }, { $ifNull: ['$settledAmount', 0] }] } },
            ];
        } else if (status && status !== 'all') query.status = status;
        if (search && String(search).trim()) {
            const escaped = String(search).trim().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
            if (escaped) {
                const matchingMembers = await Member.find({
                    owner: req.userId,
                    name: { $regex: escaped, $options: 'i' },
                }).select('_id').lean();
                query.$or = [
                    { note: { $regex: escaped, $options: 'i' } },
                    { member: { $in: matchingMembers.map((member) => member._id) } },
                ];
            }
        }

        const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);

        const sortDirection = order === 'asc' ? 1 : -1;
        const sortSpec = sortBy === 'amount' ? { amount: sortDirection, _id: -1 } : { date: -1, _id: -1 };
        const [data, total, allForSummary] = await Promise.all([
            SellingAdvance.find(query)
                .populate('member', 'name mobile address')
                .sort(sortSpec)
                .skip((parsedPage - 1) * parsedLimit)
                .limit(parsedLimit)
                .lean(),
            SellingAdvance.countDocuments(query),
            // Summary uses the same owner/member/type scope but ignores paging,
            // status filter, and soft-deleted rows are excluded by summarize().
            SellingAdvance.find({
                owner: req.userId,
                ...(memberId && mongoose.isValidObjectId(memberId) ? { member: memberId } : {}),
                ...(type === 'given' || type === 'adjusted' ? { type } : {}),
                ...(query.$or ? { $or: query.$or } : {}),
                isDeleted: { $ne: true },
            }).lean(),
        ]);

        return res.json({
            success: true,
            response: {
                data,
                total,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    pages: Math.max(1, Math.ceil(total / parsedLimit)),
                },
                summary: summarize(allForSummary),
            },
        });
    } catch (error) {
        console.error('[selling-advances] list error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load selling advances.' });
    }
});

// POST /api/selling-advances - creates ONLY a new SellingAdvance document.
router.post('/', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const { memberId, amount, date, note, type = 'given' } = req.body || {};
        if (!mongoose.isValidObjectId(memberId)) {
            return res.status(400).json({ success: false, message: 'Valid customer is required.' });
        }
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
        }
        if (!['given', 'adjusted'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid advance type.' });
        }

        const member = await Member.findOne({
            _id: memberId,
            owner: req.userId,
            isActive: true,
        }).select('_id name mobile').lean();
        if (!member) {
            return res.status(404).json({ success: false, message: 'Selling customer not found.' });
        }

        const parsedDate = date ? new Date(date) : new Date();
        const doc = await SellingAdvance.create({
            member: member._id,
            owner: req.userId,
            amount: round2(parsedAmount),
            date: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
            note: String(note || '').trim(),
            type,
            status: type === 'adjusted' ? 'settled' : 'pending',
            settledAmount: type === 'adjusted' ? round2(parsedAmount) : 0,
        });

        const populated = await SellingAdvance.findById(doc._id)
            .populate('member', 'name mobile address')
            .lean();

        return res.status(201).json({
            success: true,
            message: type === 'adjusted' ? 'Advance adjustment saved.' : 'Advance added successfully.',
            response: populated,
        });
    } catch (error) {
        console.error('[selling-advances] create error:', error);
        return res.status(500).json({ success: false, message: 'Failed to save selling advance.' });
    }
});

// PUT /api/selling-advances/:id/settle - settles a given advance in the isolated ledger.
router.put('/:id/settle', auth, requireSubscription('selling'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid advance id.' });
        }
        const doc = await SellingAdvance.findOne({
            _id: req.params.id,
            owner: req.userId,
            isDeleted: { $ne: true },
        });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Selling advance not found.' });
        }
        if (doc.type !== 'given') {
            return res.status(400).json({ success: false, message: 'Only given advances can be settled.' });
        }

        const remaining = remainingFor(doc.toObject ? doc.toObject() : doc);
        if (remaining <= 0) {
            return res.status(400).json({ success: false, message: 'This advance is already settled.' });
        }

        const requested = req.body?.settledAmount === undefined || req.body?.settledAmount === null || req.body?.settledAmount === ''
            ? remaining
            : Number(req.body.settledAmount);
        if (!Number.isFinite(requested) || requested <= 0) {
            return res.status(400).json({ success: false, message: 'Settlement amount must be greater than zero.' });
        }
        const settleAmount = Math.min(remaining, round2(requested));

        doc.settledAmount = round2(Number(doc.settledAmount || 0) + settleAmount);
        doc.status = doc.settledAmount >= Number(doc.amount || 0) ? 'settled' : 'partial';
        await doc.save();

        const populated = await SellingAdvance.findById(doc._id)
            .populate('member', 'name mobile address')
            .lean();
        return res.json({
            success: true,
            message: 'Selling advance settled.',
            response: populated,
        });
    } catch (error) {
        console.error('[selling-advances] settle error:', error);
        return res.status(500).json({ success: false, message: 'Failed to settle selling advance.' });
    }
});

// DELETE /api/selling-advances/:id - soft delete, never edits old selling data.
router.delete('/:id', auth, requireSubscription('selling'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid advance id.' });
        }
        const doc = await SellingAdvance.findOne({
            _id: req.params.id,
            owner: req.userId,
            isDeleted: { $ne: true },
        });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Selling advance not found.' });
        }
        // An applied advance is part of a saved payment's audit trail.
        if (await MemberPayment.exists({ owner: req.userId, 'settledSellingAdvances.advance': doc._id })) {
            return res.status(409).json({ success: false, message: 'This advance is linked to a payment and cannot be deleted.' });
        }
        doc.isDeleted = true;
        doc.deletedAt = new Date();
        await doc.save();
        return res.json({ success: true, message: 'Selling advance deleted.', response: { deleted: true } });
    } catch (error) {
        console.error('[selling-advances] delete error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete selling advance.' });
    }
});

module.exports = router;
