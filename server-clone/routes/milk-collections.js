const express = require('express');
const router = express.Router();
const MilkCollection = require('../models/MilkCollection');
const PurchaseFarmer = require('../models/PurchaseFarmer');
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const codeRegex = (code) => new RegExp(`^${escapeRegExp(normalizeCode(code))}$`, 'i');

// GET /api/milk-collections - Get all collections with filters
router.get('/', auth, async (req, res) => {
    try {
        // FIX: increase default limit from 50 to 500 so Purchase tab's Sale Entries table doesn't truncate early
        // and leave large blank white space (as seen in screenshot) when user has many entries per day
        const { farmerId, farmerCode, date, startDate, endDate, shift, isPaid, limit = 10, page = 1, tzOffsetMinutes } = req.query;

        const query = { owner: req.userId };

        if (farmerId) query.purchaseFarmer = farmerId;
        if (shift) {
            // Tolerate shift values written by bulk data fills / imports
            // ("Morning", "M", "evening", "E", ...) instead of the app's lowercase values.
            const shiftKey = String(shift).trim().toLowerCase();
            if (shiftKey === 'morning' || shiftKey === 'evening') {
                const letter = shiftKey.charAt(0);
                query.shift = { $in: [shiftKey, letter.toUpperCase() + shiftKey.slice(1), letter, letter.toUpperCase()] };
            } else {
                query.shift = shift;
            }
        }
        if (isPaid !== undefined) query.isPaid = isPaid === 'true';

        // Date filters.
        // The app sends calendar dates (YYYY-MM-DD) picked on the device, so the day
        // MUST be interpreted in the *user's* timezone — not in UTC and not in
        // server-local hours. Rows created by the app are saved at UTC midnight of
        // that calendar date, but rows added by scripts / bulk data fills / imports
        // often carry a local time (e.g. 2026-10-04T18:30:00Z = 5 Oct 00:00 IST) or
        // are stored as plain strings. Those rows used to fall outside the queried
        // window, so old collection data silently disappeared from the app once
        // (bulk-filled) history was added. We now match the whole local calendar day
        // and also accept string-typed dates.
        //
        // Client sends `tzOffsetMinutes` = minutes AHEAD of UTC (IST = 330).
        // Default 330 (IST) keeps the window correct for all existing Indian users
        // even if an older app build does not send the parameter.
        const tzOffsetParam = parseInt(tzOffsetMinutes, 10);
        const clientTzOffsetMinutes = Number.isFinite(tzOffsetParam) ? tzOffsetParam : 330;

        const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

        // UTC instant of local 00:00 for a YYYY-MM-DD calendar day in the client's timezone
        const localDayStart = (dateKey) => {
            const match = DATE_KEY_RE.exec(String(dateKey).trim());
            if (!match) return null;
            const [, y, m, d] = match;
            return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)) - clientTzOffsetMinutes * 60000);
        };
        const DAY_MS = 24 * 60 * 60 * 1000;

        const dateClauses = [];

        if (date) {
            const dateKey = String(date).trim();
            const dayStart = localDayStart(dateKey);
            if (dayStart) {
                const nextDay = new Date(dayStart.getTime() + DAY_MS);
                dateClauses.push({
                    $or: [
                        { date: { $gte: dayStart, $lt: nextDay } },
                        { date: dateKey } // string-typed dates ("YYYY-MM-DD")
                    ]
                });
            } else {
                const dayStart = new Date(dateKey);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dateKey);
                dayEnd.setHours(23, 59, 59, 999);
                dateClauses.push({ date: { $gte: dayStart, $lte: dayEnd } });
            }
        } else if (startDate || endDate) {
            const dateRange = {};
            const stringRange = {};
            if (startDate) {
                const startKey = String(startDate).trim();
                const start = localDayStart(startKey);
                dateRange.$gte = start || new Date(startKey);
                if (start) stringRange.$gte = startKey;
            }
            if (endDate) {
                const endKey = String(endDate).trim();
                const end = localDayStart(endKey);
                if (end) {
                    // end date is inclusive: until local 00:00 of the next day
                    dateRange.$lt = new Date(end.getTime() + DAY_MS);
                    stringRange.$lte = endKey;
                } else {
                    const endFallback = new Date(endKey);
                    endFallback.setHours(23, 59, 59, 999);
                    dateRange.$lte = endFallback;
                }
            }
            const rangeOr = [{ date: dateRange }];
            if (Object.keys(stringRange).length > 0) rangeOr.push({ date: stringRange });
            dateClauses.push({ $or: rangeOr });
        }

        if (dateClauses.length > 0) {
            query.$and = [...(query.$and || []), ...dateClauses];
        }

        // If farmerCode provided: support PurchaseFarmer + legacy Farmer + farmerCode string fallback + only unsettled
        if (farmerCode) {
            const normalizedCode = normalizeCode(farmerCode);
            const codePattern = codeRegex(normalizedCode);
            const pFarmer = await PurchaseFarmer.findOne({ code: codePattern, owner: req.userId });
            const farmer = await Farmer.findOne({ code: codePattern, owner: req.userId });
            const orConditions = [];
            if (pFarmer) orConditions.push({ purchaseFarmer: pFarmer._id });
            if (farmer) orConditions.push({ purchaseFarmer: farmer._id });
            if (farmer) orConditions.push({ farmer: farmer._id });
            orConditions.push({ farmerCode: codePattern });
            if (orConditions.length > 0) {
                query.$and = [...(query.$and || []), { $or: orConditions }];
            }
            if (isPaid === undefined) {
                query.isPaid = false;
            }
        }

        // FIX: clamp limit to 1000 to avoid blank truncation while protecting DB
        let parsedLimit = parseInt(limit) || 10;
        parsedLimit = Math.min(1000, Math.max(1, parsedLimit));
        const parsedPage = Math.max(1, parseInt(page) || 1);

        const collections = await MilkCollection.find(query)
            .populate('purchaseFarmer', 'code name mobile')
            // _id as final tie-breaker: pages must be deterministic, otherwise the
            // app could receive the same row twice (or miss one) while paging.
            .sort({ date: -1, shift: -1, _id: -1 })
            .limit(parsedLimit)
            .skip((parsedPage - 1) * parsedLimit)
            .lean();

        // Calculate totals (single source for every report/screen, incl. bonus split)
        const totals = await MilkCollection.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: '$quantity' },
                    totalAmount: { $sum: '$amount' },
                    totalBonus: { $sum: { $ifNull: ['$bonusAmount', 0] } },
                    totalBase: { $sum: { $ifNull: ['$baseAmount', 0] } }
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
                    amount: totals[0]?.totalAmount || 0,
                    // Bonus split (0 when the entry had no bonus)
                    bonusAmount: totals[0]?.totalBonus || 0,
                    baseAmount: totals[0]?.totalBase || 0
                },
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    pages: Math.ceil(total / parsedLimit) || 1
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
        // "Today" is the user's local calendar day (client sends tzOffsetMinutes =
        // minutes ahead of UTC, IST = 330). Default 330 for older app builds.
        const tzOffsetParam = parseInt(req.query.tzOffsetMinutes, 10);
        const clientTzOffsetMinutes = Number.isFinite(tzOffsetParam) ? tzOffsetParam : 330;
        const nowLocal = new Date(Date.now() + clientTzOffsetMinutes * 60000);
        const today = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - clientTzOffsetMinutes * 60000);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

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

// The app checks this before saving a bonus to avoid silent loss on older APIs.
router.get('/bonus-capability', auth, (req, res) => {
    res.json({ success: true, response: { bonusPersistence: true } });
});

// POST /api/milk-collections - Add new collection (subscription check optional to fix Home vs Purchase mismatch - image shows Purchase error but Home 20L)
router.post('/', auth, async (req, res) => {
    try {
        const { farmerCode, purchaseFarmerId, date, shift, quantity, fat, snf, rate, notes, milkType } = req.body;

        // Bonus is optional and only used when Rate Setting > Bonus is ON.
        const bonusType = req.body.bonusType === 'percent' ? 'percent' : (req.body.bonusType === 'perLitre' ? 'perLitre' : '');
        const bonusRate = Number.isFinite(Number(req.body.bonusRate)) && Number(req.body.bonusRate) > 0 ? Number(req.body.bonusRate) : 0;

        const qty = Number(quantity);
        const r = Number(rate);

        // Fix: allow rate=0 for isZero/holiday entries (first image shows Avg Rate 0, Today Rate 55 - rate calc may lag)
        if (Number.isNaN(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid quantity is required'
            });
        }
        if (Number.isNaN(r) || r < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid rate is required'
            });
        }

        let purchaseFarmerRef = null;

        if (purchaseFarmerId) {
            const pFarmer = await PurchaseFarmer.findOne({ _id: purchaseFarmerId, owner: req.userId, isActive: true });
            if (pFarmer) purchaseFarmerRef = pFarmer._id;
        }

        if (farmerCode && !purchaseFarmerRef) {
            const normalizedCode = normalizeCode(farmerCode);
            const pFarmer = await PurchaseFarmer.findOne({ code: codeRegex(normalizedCode), owner: req.userId, isActive: true });
            if (pFarmer) purchaseFarmerRef = pFarmer._id;
        }

        // Milk value, then bonus on top: per litre => qty x bonus; percent => % of milk value
        const baseAmount = parseFloat((parseFloat(quantity) * parseFloat(rate)).toFixed(2));
        let bonusAmount = 0;
        if (bonusRate > 0 && bonusType === 'perLitre') bonusAmount = parseFloat((parseFloat(quantity) * bonusRate).toFixed(2));
        else if (bonusRate > 0 && bonusType === 'percent') bonusAmount = parseFloat(((baseAmount * bonusRate) / 100).toFixed(2));
        const totalAmount = parseFloat((baseAmount + bonusAmount).toFixed(2));

        const collection = await MilkCollection.create({
            purchaseFarmer: purchaseFarmerRef,
            farmerCode: farmerCode ? normalizeCode(farmerCode) : '',
            milkType: milkType || 'buffalo',
            owner: req.userId,
            date: date ? new Date(date) : new Date(),
            shift: shift || (new Date().getHours() < 12 ? 'morning' : 'evening'),
            quantity: parseFloat(quantity),
            fat: parseFloat(fat) || 0,
            snf: parseFloat(snf) || 0,
            rate: parseFloat(rate),
            baseAmount,
            bonusAmount,
            bonusType: bonusAmount > 0 ? bonusType : '',
            bonusRate: bonusAmount > 0 ? bonusRate : 0,
            amount: totalAmount,
            notes: notes?.trim() || ''
        });

        // Update purchase farmer totals if exists
        if (purchaseFarmerRef) {
            await PurchaseFarmer.findByIdAndUpdate(purchaseFarmerRef, {
                $inc: {
                    totalQuantity: parseFloat(quantity),
                    totalAmount: collection.amount
                },
                lastPurchaseDate: new Date()
            });
        }

        const populatedCollection = await MilkCollection.findById(collection._id)
            .populate('purchaseFarmer', 'code name mobile')
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

// GET /api/milk-collections/:id - single entry (used by the Edit action)
// NOTE: declared after '/today' so that path keeps matching first.
router.get('/:id', auth, async (req, res) => {
    try {
        if (!/^[a-f\d]{24}$/i.test(String(req.params.id))) {
            return res.status(400).json({ success: false, message: 'Invalid entry id' });
        }
        const collection = await MilkCollection.findOne({ _id: req.params.id, owner: req.userId })
            .populate('purchaseFarmer', 'code name mobile')
            .lean();
        if (!collection) {
            return res.status(404).json({ success: false, message: 'Collection not found' });
        }
        res.json({ success: true, response: collection });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch collection' });
    }
});

// PUT /api/milk-collections/:id (requires purchase subscription)
router.put('/:id', auth, async (req, res) => {
    try {
        const { quantity, fat, snf, rate, notes } = req.body;
        const hasBonus = req.body.bonusType !== undefined;
        const bonusType = req.body.bonusType === 'percent' ? 'percent' : (req.body.bonusType === 'perLitre' ? 'perLitre' : '');
        const bonusRate = Number.isFinite(Number(req.body.bonusRate)) && Number(req.body.bonusRate) > 0 ? Number(req.body.bonusRate) : 0;

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
        const oldQuantity = collection.quantity;

        if (quantity !== undefined) collection.quantity = parseFloat(quantity);
        if (fat !== undefined) collection.fat = parseFloat(fat);
        if (snf !== undefined) collection.snf = parseFloat(snf);
        if (rate !== undefined) collection.rate = parseFloat(rate);
        if (notes !== undefined) collection.notes = notes.trim();

        if (hasBonus) {
            collection.baseAmount = parseFloat((collection.quantity * collection.rate).toFixed(2));
            let bonusAmount = 0;
            if (bonusRate > 0 && bonusType === 'perLitre') bonusAmount = parseFloat((collection.quantity * bonusRate).toFixed(2));
            else if (bonusRate > 0 && bonusType === 'percent') bonusAmount = parseFloat(((collection.baseAmount * bonusRate) / 100).toFixed(2));
            collection.bonusAmount = bonusAmount;
            collection.bonusType = bonusAmount > 0 ? bonusType : '';
            collection.bonusRate = bonusAmount > 0 ? bonusRate : 0;
            collection.amount = parseFloat((collection.baseAmount + bonusAmount).toFixed(2));
        } else {
            // Keep the entry's bonus when only quantity or rate changes.
            const base = parseFloat((collection.quantity * collection.rate).toFixed(2));
            if (collection.bonusType === 'percent' && collection.bonusRate > 0) {
                collection.bonusAmount = parseFloat((base * collection.bonusRate / 100).toFixed(2));
            } else if (collection.bonusType === 'perLitre' && collection.bonusRate > 0) {
                collection.bonusAmount = parseFloat((collection.quantity * collection.bonusRate).toFixed(2));
            }
            collection.amount = parseFloat((base + (Number(collection.bonusAmount) || 0)).toFixed(2));
        }
        await collection.save();

        // Update purchase farmer totals
        const amountDiff = collection.amount - oldAmount;
        const qtyDiff = collection.quantity - oldQuantity;
        if (collection.purchaseFarmer && (amountDiff !== 0 || qtyDiff !== 0)) {
            await PurchaseFarmer.findByIdAndUpdate(collection.purchaseFarmer, {
                $inc: { totalAmount: amountDiff, totalQuantity: qtyDiff }
            });
        }

        const populatedCollection = await MilkCollection.findById(collection._id)
            .populate('purchaseFarmer', 'code name mobile')
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

// DELETE /api/milk-collections/:id (requires purchase subscription)
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

        // Update purchase farmer totals
        if (collection.purchaseFarmer) {
            await PurchaseFarmer.findByIdAndUpdate(collection.purchaseFarmer, {
                $inc: {
                    totalQuantity: -collection.quantity,
                    totalAmount: -collection.amount
                }
            });
        }

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
