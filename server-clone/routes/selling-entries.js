const express = require('express');
const router = express.Router();
const SellingEntry = require('../models/SellingEntry');
const Member = require('../models/Member');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

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
        const { limit = 10, page = 1, memberId, startDate, endDate, isPaid } = req.query;

        const query = { owner: req.userId };

        if (memberId) {
            query.member = memberId;
        }

        // Allow filtering by isPaid status; if not provided, return ALL entries (settled + unsettled)
        if (isPaid !== undefined && isPaid !== '') {
            query.isPaid = isPaid === 'true';
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const { parsePaging, pagingResult } = require('../lib/pagination');
        const { page: pg, limit: lim, skip } = parsePaging({ page, limit }, { page: 1, limit: 500, maxLimit: 1000 });
        const [entries, total] = await Promise.all([
          SellingEntry.find(query).populate('member','name mobile ratePerLiter').sort({ date: -1, createdAt: -1 }).skip(skip).limit(lim).lean(),
          SellingEntry.countDocuments(query),
        ]);
        const entriesWithCount = entries.map(e => ({ ...e, entryCount: e.entryCount || 1 }));

        res.json({ success: true, response: { data: entriesWithCount, count: entriesWithCount.length, total, page: pg, pages: Math.ceil(total / lim), ...pagingResult({ items: entriesWithCount, total, page: pg, limit: lim }) } });
    } catch (error) {
        console.error('Get selling entries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get entries'
        });
    }
});

// POST /api/selling-entries (requires selling subscription)
router.post('/', auth, requireSubscription('selling'), async (req, res) => {
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
                notes: notes?.trim() || '',
                entryCount: 1
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
            entry.entryCount = (entry.entryCount || 1) + 1;
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

// GET /api/selling-entries/bulk-list?date=YYYY-MM-DD&session=morning|evening
// Returns all Daily Auto Entry members with their default quantity/rate prefilled
// and flags entries that already exist for the given date + session (duplicates).
router.get('/bulk-list', auth, async (req, res) => {
    try {
        const { date, session } = req.query;

        const normalizedSession = String(session || '').toLowerCase();
        if (!['morning', 'evening'].includes(normalizedSession)) {
            return res.status(400).json({
                success: false,
                message: 'Session must be morning or evening'
            });
        }

        const entryDate = normalizeToUtcStartOfDay(date);

        // All active members with Daily Auto Entry enabled
        const members = await Member.find({
            owner: req.userId,
            isActive: true,
            dailyAutoEntry: true
        })
            .sort({ name: 1 })
            .lean();

        // Existing entries for this date (to detect already-entered sessions)
        const existingEntries = await SellingEntry.find({
            owner: req.userId,
            date: entryDate
        })
            .select('member morningQuantity eveningQuantity rate notes')
            .lean();

        const existingByMember = new Map(
            existingEntries.map(e => [String(e.member), e])
        );

        const list = members.map(m => {
            const existing = existingByMember.get(String(m._id));
            const sessionQty = normalizedSession === 'morning'
                ? Number(existing?.morningQuantity || 0)
                : Number(existing?.eveningQuantity || 0);
            const alreadyEntered = !!existing && sessionQty > 0;

            return {
                memberId: m._id,
                name: m.name,
                mobile: m.mobile,
                ratePerLiter: m.ratePerLiter,
                defaultQuantity: normalizedSession === 'morning'
                    ? Number(m.defaultMorningQuantity || 0)
                    : Number(m.defaultEveningQuantity || 0),
                defaultNotes: m.defaultNotes || '',
                alreadyEntered,
                existingEntryId: existing?._id || null,
                existingQuantity: alreadyEntered ? sessionQty : 0,
                existingRate: existing?.rate ?? null
            };
        });

        res.json({
            success: true,
            response: {
                date: entryDate,
                session: normalizedSession,
                data: list,
                count: list.length
            }
        });
    } catch (error) {
        console.error('Get bulk list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bulk entry list'
        });
    }
});

// POST /api/selling-entries/bulk (requires selling subscription)
// Save one whole session's entries in a single call.
// Body: {
//   date: 'YYYY-MM-DD',
//   session: 'morning' | 'evening',
//   entries: [{ memberId, quantity, rate?, notes? }]
// }
// Members whose entry for the same date + session already exists are SKIPPED
// (no duplicate entries are created).
router.post('/bulk', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const { date, session, entries } = req.body || {};

        const normalizedSession = String(session || '').toLowerCase();
        if (!['morning', 'evening'].includes(normalizedSession)) {
            return res.status(400).json({
                success: false,
                message: 'Session must be morning or evening'
            });
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Entries are required'
            });
        }

        const entryDate = normalizeToUtcStartOfDay(date);
        const isMorning = normalizedSession === 'morning';

        const saved = [];
        const skipped = [];

        for (const item of entries) {
            try {
                const memberId = item?.memberId;
                if (!memberId) {
                    skipped.push({ memberId: null, name: item?.name || '', reason: 'member_required' });
                    continue;
                }

                const quantityRaw = parseFloat(item?.quantity);
                const quantity = Number.isNaN(quantityRaw) ? 0 : Math.max(0, quantityRaw);
                if (quantity <= 0) {
                    skipped.push({ memberId, name: item?.name || '', reason: 'zero_quantity' });
                    continue;
                }

                const member = await Member.findOne({
                    _id: memberId,
                    owner: req.userId,
                    isActive: true
                });

                if (!member) {
                    skipped.push({ memberId, name: item?.name || '', reason: 'member_not_found' });
                    continue;
                }

                const rateRaw = parseFloat(item?.rate);
                const entryRate = Number.isNaN(rateRaw) || rateRaw <= 0
                    ? Number(member.ratePerLiter) || 0
                    : rateRaw;

                // One entry per owner+member+date: create or merge into existing
                let entry = await SellingEntry.findOne({
                    owner: req.userId,
                    member: memberId,
                    date: entryDate
                });

                if (entry) {
                    const existingSessionQty = isMorning
                        ? Number(entry.morningQuantity || 0)
                        : Number(entry.eveningQuantity || 0);

                    // Duplicate protection: same date + session already entered
                    if (existingSessionQty > 0) {
                        skipped.push({
                            memberId,
                            name: member.name,
                            reason: 'already_exists'
                        });
                        continue;
                    }

                    const oldTotalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
                    const oldAmount = Number(entry.amount || 0);

                    if (isMorning) {
                        entry.morningQuantity = quantity;
                    } else {
                        entry.eveningQuantity = quantity;
                    }
                    entry.rate = entryRate;
                    entry.entryCount = (entry.entryCount || 1) + 1;
                    if (item?.notes !== undefined) entry.notes = String(item.notes || '').trim();

                    await entry.save();

                    const newTotalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
                    const newAmount = Number(entry.amount || 0);
                    const deltaLiters = newTotalQty - oldTotalQty;
                    const deltaAmount = newAmount - oldAmount;

                    const inc = { totalLiters: deltaLiters, totalAmount: deltaAmount };
                    if (!entry.isPaid) {
                        inc.pendingAmount = deltaAmount;
                    }
                    await Member.findByIdAndUpdate(memberId, { $inc: inc });

                    saved.push({
                        memberId,
                        name: member.name,
                        entryId: entry._id,
                        quantity,
                        rate: entryRate,
                        amount: Number(entry.amount || 0),
                        updated: true
                    });
                } else {
                    const created = await SellingEntry.create({
                        member: memberId,
                        owner: req.userId,
                        date: entryDate,
                        morningQuantity: isMorning ? quantity : 0,
                        eveningQuantity: isMorning ? 0 : quantity,
                        rate: entryRate,
                        notes: String(item?.notes || '').trim() || member.defaultNotes || '',
                        entryCount: 1
                    });

                    const deltaLiters = quantity;
                    const deltaAmount = Number(created.amount || 0);

                    await Member.findByIdAndUpdate(memberId, {
                        $inc: {
                            totalLiters: deltaLiters,
                            totalAmount: deltaAmount,
                            pendingAmount: deltaAmount
                        }
                    });

                    saved.push({
                        memberId,
                        name: member.name,
                        entryId: created._id,
                        quantity,
                        rate: entryRate,
                        amount: Number(created.amount || 0),
                        updated: false
                    });
                }
            } catch (itemError) {
                console.error('Bulk entry item error:', itemError);
                skipped.push({
                    memberId: item?.memberId || null,
                    name: item?.name || '',
                    reason: 'error'
                });
            }
        }

        res.status(201).json({
            success: true,
            message: `${saved.length} entries saved${skipped.length ? `, ${skipped.length} skipped` : ''}`,
            response: {
                date: entryDate,
                session: normalizedSession,
                saved,
                skipped,
                savedCount: saved.length,
                skippedCount: skipped.length
            }
        });
    } catch (error) {
        console.error('Bulk create selling entries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save bulk entries'
        });
    }
});

// DELETE /api/selling-entries/:id (requires selling subscription)
router.delete('/:id', auth, requireSubscription('selling'), async (req, res) => {
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

// PUT /api/selling-entries/:id — update morning/evening/rate/notes (requires selling subscription)
router.put('/:id', auth, requireSubscription('selling'), async (req, res) => {
    try {
        const { morningQuantity, eveningQuantity, rate, notes } = req.body || {};

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

        // Capture old totals so we can compute the delta to apply to the member
        const oldTotalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
        const oldAmount = Number(entry.amount || 0);

        if (morningQuantity !== undefined && morningQuantity !== null && morningQuantity !== '') {
            const mv = parseFloat(morningQuantity);
            if (Number.isNaN(mv) || mv < 0) {
                return res.status(400).json({ success: false, message: 'Invalid morning quantity' });
            }
            entry.morningQuantity = mv;
        }

        if (eveningQuantity !== undefined && eveningQuantity !== null && eveningQuantity !== '') {
            const ev = parseFloat(eveningQuantity);
            if (Number.isNaN(ev) || ev < 0) {
                return res.status(400).json({ success: false, message: 'Invalid evening quantity' });
            }
            entry.eveningQuantity = ev;
        }

        if (rate !== undefined && rate !== null && rate !== '') {
            const rv = parseFloat(rate);
            if (Number.isNaN(rv) || rv < 0) {
                return res.status(400).json({ success: false, message: 'Invalid rate' });
            }
            entry.rate = rv;
        }

        if (notes !== undefined) {
            entry.notes = String(notes || '').trim();
        }

        // Must have at least one non-zero quantity
        if (Number(entry.morningQuantity || 0) <= 0 && Number(entry.eveningQuantity || 0) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Morning or evening quantity is required'
            });
        }

        // pre('validate') recalculates amount from morning+evening+rate
        await entry.save();

        const newTotalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
        const newAmount = Number(entry.amount || 0);
        const deltaLiters = newTotalQty - oldTotalQty;
        const deltaAmount = newAmount - oldAmount;

        // Mirror the pattern used by DELETE / POST: adjust member totals by the delta.
        // pendingAmount is adjusted for unpaid entries; for already-paid entries we
        // do NOT touch pendingAmount because it wasn't in the pending bucket.
        const inc = { totalLiters: deltaLiters, totalAmount: deltaAmount };
        if (!entry.isPaid) {
            inc.pendingAmount = deltaAmount;
        }
        await Member.findByIdAndUpdate(entry.member, { $inc: inc });

        const populated = await SellingEntry.findById(entry._id)
            .populate('member', 'name mobile ratePerLiter')
            .lean();

        res.json({
            success: true,
            message: 'Entry updated successfully',
            response: populated
        });
    } catch (error) {
        console.error('Update selling entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update entry'
        });
    }
});

module.exports = router;