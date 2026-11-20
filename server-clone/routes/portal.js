const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const MilkCollection = require('../models/MilkCollection');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');
const SellingEntry = require('../models/SellingEntry');
const MemberPayment = require('../models/MemberPayment');
const SellingAdvance = require('../models/SellingAdvance');
const portalAuth = require('../middleware/portal-auth');
const { findPortalProfiles, publicPortalIdentity, toId, escapeRegExp } = require('../lib/portalIdentity');

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const safeIso = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
};

const modeLabel = (value) => {
    const key = String(value || 'cash').toLowerCase();
    const labels = { cash: 'Cash', upi: 'UPI', bank: 'Bank', cheque: 'Cheque' };
    return labels[key] || (key ? key[0].toUpperCase() + key.slice(1) : 'Cash');
};

// Local calendar day for the device. The app passes minutes AHEAD of UTC
// (IST = 330), matching the existing collection/payment report routes.
const localDayRange = (tzOffsetMinutes) => {
    const parsed = Number(tzOffsetMinutes);
    const offset = Number.isFinite(parsed) ? Math.max(-720, Math.min(840, parsed)) : 330;
    const nowLocal = new Date(Date.now() + offset * 60000);
    const start = new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - offset * 60000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
};

const EMPTY_QUERY = { _id: { $exists: false } };
const scopedQuery = (clauses, extra = {}) => (
    clauses.length ? { $or: clauses, ...extra } : { ...EMPTY_QUERY, ...extra }
);

// Mongoose casts ObjectIds in find(), but NOT inside aggregate $match. Portal
// scopes are built from string IDs, so cast them explicitly for aggregation.
const OBJECT_ID_FIELDS = new Set(['_id', 'owner', 'purchaseFarmer', 'farmer', 'member']);
const castAggregateMatch = (node, fieldName = '') => {
    if (Array.isArray(node)) return node.map((item) => castAggregateMatch(item, fieldName));
    if (node && typeof node === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(node)) {
            if (key.startsWith('$')) {
                out[key] = castAggregateMatch(value, fieldName);
            } else {
                out[key] = castAggregateMatch(value, key);
            }
        }
        return out;
    }
    if (OBJECT_ID_FIELDS.has(fieldName) && typeof node === 'string' && mongoose.isValidObjectId(node)) {
        return new mongoose.Types.ObjectId(node);
    }
    return node;
};

const collectionRemaining = (doc) => {
    if (doc.status === 'settled') return 0;
    return Math.max(0, round2(Number(doc.amount || 0) - Number(doc.settledAmount || 0)));
};

// Use the same owner/profile scope as the portal dashboard; never accept a
// farmer or dairy ID from the client.
const collectionMilkQuery = (identity) => scopedQuery(identity.collectionLinks.map((link) => ({
    owner: link.owner,
    $or: [
        { purchaseFarmer: { $in: link.allProfileIds } },
        { farmerCode: { $regex: `^${escapeRegExp(link.code)}$`, $options: 'i' } },
    ],
})));

const sellingLedgerScopes = (identity) => identity.sellingLinks.map((link) => ({
    owner: link.owner,
    member: { $in: link.memberIds },
}));
const round3 = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
const mapSellingPayment = (row) => ({
    id: toId(row._id), date: safeIso(row._portalDate || row.date),
    amount: round2(row.amount || 0), mode: modeLabel(row.paymentMethod),
    periodStart: safeIso(row.periodStart), periodEnd: safeIso(row.periodEnd),
    totalMilkAmount: round2(row.totalSellAmount || 0),
    totalAdvanceDeduction: round2(row.advanceApplied || 0),
    advanceEffect: row.advanceEffect === 'add' ? 'add' : 'subtract',
    netPayable: round2(row.netPayable || 0), closingBalance: round2(row.closingBalance || 0),
    createdAt: safeIso(row.createdAt), remark: row.notes || row.reference || 'Payment received',
});

const collectionLedgerScopes = (identity) => identity.collectionLinks.map((link) => ({
    owner: link.owner,
    farmer: { $in: link.farmerIds.length ? link.farmerIds : link.allProfileIds },
}));

const validDateKey = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// Match the owner's calendar-day query, including legacy date strings. Date
// objects and strings are kept as separate Mongo types in this aggregation.
const collectionDateQuery = (start, end, offset) => {
    const dayStart = (key) => new Date(new Date(`${key}T00:00:00.000Z`).getTime() - offset * 60000);
    const dates = {};
    const strings = { $type: 'string' };
    if (start) { dates.$gte = dayStart(start); strings.$gte = start; }
    if (end) {
        dates.$lt = new Date(dayStart(end).getTime() + 86400000);
        strings.$lt = new Date(new Date(`${end}T00:00:00.000Z`).getTime() + 86400000).toISOString().slice(0, 10);
    }
    return { $or: [{ date: dates }, { date: strings }] };
};

// The balance is computed independently of the paginated history lists. Each
// linked account has its own settlement cutoff; no entry or payment is modified.
const portalBalanceParts = async ({ identity, module, offset }) => {
    const collection = module === 'collection';
    const paymentModel = collection ? Payment : MemberPayment;
    const entryModel = collection ? MilkCollection : SellingEntry;
    const accounts = collection
        ? identity.collectionLinks.map(link => ({
            paymentScope: { owner: link.owner, farmer: { $in: link.farmerIds.length ? link.farmerIds : link.allProfileIds } },
            entryScope: { owner: link.owner, $or: [
                { purchaseFarmer: { $in: link.allProfileIds } },
                { farmerCode: { $regex: `^${escapeRegExp(link.code)}$`, $options: 'i' } },
            ] },
            fallbackBalance: (link.farmerDocs || []).reduce((sum, farmer) => sum + Number(farmer.currentBalance || 0), 0),
        }))
        : identity.sellingLinks.flatMap(link => (link.memberDocs || []).map(member => ({
            paymentScope: { owner: link.owner, member: toId(member._id) },
            entryScope: { owner: link.owner, member: toId(member._id) },
            fallbackBalance: Number(member.sellingPaymentBalance || 0),
        })));

    const parts = await Promise.all(accounts.map(async account => {
        const rows = await paymentModel.find(account.paymentScope)
            .sort({ periodEnd: -1, date: -1, createdAt: -1, _id: -1 }).limit(1).lean();
        const latest = rows[0];
        const end = latest?.periodEnd ? new Date(latest.periodEnd) : null;
        let dateOrLegacyFilter;
        if (end && !Number.isNaN(end.getTime())) {
            const nextDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1)).toISOString().slice(0, 10);
            // Collection dates use the owner's local day; selling dates use UTC calendar days.
            dateOrLegacyFilter = collectionDateQuery(nextDay, null, collection ? offset : 0);
        } else {
            // A missing historical period must not be guessed from payment date.
            // Retain the prior unpaid-status rule until a period is available.
            dateOrLegacyFilter = { isPaid: { $ne: true } };
        }
        return {
            balance: Number(latest?.closingBalance ?? account.fallbackBalance ?? 0),
            clause: { $and: [castAggregateMatch(account.entryScope), dateOrLegacyFilter] },
        };
    }));
    // One OR-filtered aggregation avoids counting a legacy entry twice when
    // its farmer code and linked profile both match.
    const totals = await entryModel.aggregate([
        { $match: parts.length ? { $or: parts.map(part => part.clause) } : EMPTY_QUERY },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
    ]);
    return { baseBalance: parts.reduce((sum, part) => sum + part.balance, 0), entryAmount: Number(totals[0]?.total || 0) };
};

// The dairy's Collection Advances tab explicitly requests status=pending.
// Settled, partially settled and deleted records remain in the database but
// must not appear as extra rows in that pending list.
const collectionAdvanceQuery = (identity) => scopedQuery(identity.collectionLinks.map((link) => ({
    owner: link.owner,
    farmer: { $in: link.farmerIds.length ? link.farmerIds : link.allProfileIds },
})), { isDeleted: { $ne: true }, status: 'pending' });

const mapCollectionAdvance = (row, identity, fallbackName) => ({
    id: toId(row._id),
    date: safeIso(row.date),
    type: Number(row.settledAmount || 0) > 0 ? 'Adjusted' : 'Given',
    direction: Number(row.settledAmount || 0) > 0 ? 'up' : 'down',
    amount: round2(row.amount || 0),
    remaining: collectionRemaining(row),
    status: row.status || 'pending',
    remark: row.note || 'Advance given',
    farmerName: row.farmer?.name || fallbackName,
    dairyName: identity.ownerNames[toId(row.owner)] || 'Dairy',
});

const sellingAdvanceQuery = (identity) => scopedQuery(identity.sellingLinks.map((link) => ({
    owner: link.owner,
    member: { $in: link.memberIds },
})), { isDeleted: { $ne: true } });

const mapSellingAdvance = (row, identity, fallbackName) => {
    const adjusted = row.type === 'adjusted' || row.status === 'settled';
    const remaining = adjusted ? 0 : Math.max(0, round2(Number(row.amount || 0) - Number(row.settledAmount || 0)));
    return {
        id: toId(row._id), date: safeIso(row.date),
        type: row.type === 'adjusted' ? 'Adjusted' : row.status === 'settled' ? 'Settled' : 'Given',
        direction: adjusted ? 'up' : 'down', amount: round2(row.amount || 0), remaining,
        status: row.status || 'pending', customerName: row.member?.name || fallbackName,
        remark: row.note || (row.type === 'adjusted' ? 'Advance adjusted' : 'Advance given'),
        dairyName: identity.ownerNames[toId(row.owner)] || 'Dairy',
    };
};

const advanceCursor = (rows, hasMore) => {
    const last = rows[rows.length - 1];
    return hasMore && last ? { date: safeIso(last.date) || 'none', id: toId(last._id) } : null;
};

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// GET /api/portal/dashboard?module=collection|selling&tzOffsetMinutes=330
router.get('/dashboard', portalAuth, async (req, res) => {
    try {
        const module = String(req.query.module || '').toLowerCase();
        if (!['collection', 'selling'].includes(module)) {
            return res.status(400).json({ success: false, message: 'Invalid portal module.' });
        }

        const identity = await findPortalProfiles(req.portalPhone);
        if (!identity.availableModules[module]) {
            return res.status(403).json({
                success: false,
                message: module === 'collection'
                    ? 'Collection data is not linked to this mobile number.'
                    : 'Selling data is not linked to this mobile number.',
                code: 'MODULE_NOT_AVAILABLE',
                response: {
                    availableModules: Object.keys(identity.availableModules).filter((key) => identity.availableModules[key]),
                },
            });
        }

        const { start: todayStart, end: tomorrowStart } = localDayRange(req.query.tzOffsetMinutes);
        const parsedOffset = Number(req.query.tzOffsetMinutes);
        const offset = Number.isFinite(parsedOffset) ? Math.max(-720, Math.min(840, parsedOffset)) : 330;
        const publicUser = publicPortalIdentity(identity, module);
        const availableModules = publicUser.availableModules;
        const ownerName = (doc) => identity.ownerNames[toId(doc?.owner)] || 'Dairy';

        let response;
        if (module === 'collection') {
            const ledgerScopes = collectionLedgerScopes(identity);

            const milkQuery = collectionMilkQuery(identity);
            const advanceQuery = collectionAdvanceQuery(identity);
            const pendingTotalQuery = scopedQuery(ledgerScopes, { isDeleted: { $ne: true }, status: { $in: ['pending', 'partial'] } });
            const paymentQuery = scopedQuery(ledgerScopes);

            const [totals, entries, payments, advances, advanceCount, advanceTotals] = await Promise.all([
                MilkCollection.aggregate([
                    { $match: castAggregateMatch(milkQuery) },
                    {
                        $facet: {
                            all: [{
                                $group: {
                                    _id: null,
                                    quantity: { $sum: { $ifNull: ['$quantity', 0] } },
                                    amount: { $sum: { $ifNull: ['$amount', 0] } },
                                    unpaidAmount: {
                                        $sum: {
                                            $cond: [
                                                { $eq: [{ $ifNull: ['$isPaid', false] }, false] },
                                                { $ifNull: ['$amount', 0] },
                                                0,
                                            ],
                                        },
                                    },
                                },
                            }],
                            today: [
                                { $match: { date: { $gte: todayStart, $lt: tomorrowStart } } },
                                {
                                    $group: {
                                        _id: null,
                                        quantity: { $sum: { $ifNull: ['$quantity', 0] } },
                                        amount: { $sum: { $ifNull: ['$amount', 0] } },
                                    },
                                },
                            ],
                        },
                    },
                ]),
                MilkCollection.find(milkQuery)
                    .populate('purchaseFarmer', 'code name mobile')
                    .sort({ date: -1, _id: -1 })
                    .limit(120)
                    .lean(),
                Payment.find(paymentQuery)
                    .populate('farmer', 'code name')
                    .sort({ date: -1, _id: -1 })
                    .limit(120)
                    .lean(),
                Advance.find(advanceQuery)
                    .populate('farmer', 'code name')
                    .sort({ date: -1, _id: -1 })
                    .limit(120)
                    .lean(),
                Advance.countDocuments(advanceQuery),
                // Sum every outstanding row, not just the 120 displayed rows.
                Advance.aggregate([
                    { $match: castAggregateMatch(pendingTotalQuery) },
                    { $group: { _id: null, total: { $sum: {
                        $max: [0, { $subtract: [{ $ifNull: ['$amount', 0] }, { $ifNull: ['$settledAmount', 0] }] }],
                    } } } },
                ]),
            ]);

            const allTotals = totals?.[0]?.all?.[0] || {};
            const todayTotals = totals?.[0]?.today?.[0] || {};
            const advancePending = round2(advanceTotals[0]?.total || 0);
            const { baseBalance, entryAmount } = await portalBalanceParts({ identity, module, offset });

            response = {
                module,
                availableModules,
                profile: publicUser,
                summary: {
                    todayMilkQuantity: round2(todayTotals.quantity || 0),
                    todayMilkAmount: round2(todayTotals.amount || 0),
                    totalMilkQuantity: round2(allTotals.quantity || 0),
                    totalMilkAmount: round2(allTotals.amount || 0),
                    advancePending,
                    currentBalance: round2(baseBalance + entryAmount - advancePending),
                    status: 'Active',
                },
                entries: entries.map((row) => ({
                    id: toId(row._id),
                    date: safeIso(row.date),
                    quantity: round2(row.quantity || 0),
                    fat: row.fat == null ? null : round2(row.fat),
                    snf: row.snf == null ? null : round2(row.snf),
                    rate: round2(row.rate || 0),
                    bonusAmount: round2(row.bonusAmount || 0),
                    bonusType: row.bonusType || '',
                    bonusRate: round2(row.bonusRate || 0),
                    amount: round2(row.amount || 0),
                    status: row.isPaid ? 'Paid' : 'Pending',
                    remark: [row.shift, row.milkType].filter(Boolean).map((v) => String(v)).join(' • ') || 'Milk entry',
                    dairyName: ownerName(row),
                    farmerName: row.purchaseFarmer?.name || row.farmerCode || publicUser.name,
                })),
                payments: payments.map((row) => ({
                    id: toId(row._id),
                    date: safeIso(row.date),
                    amount: round2(row.amount || 0),
                    mode: modeLabel(row.paymentMethod),
                    periodStart: safeIso(row.periodStart),
                    periodEnd: safeIso(row.periodEnd),
                    totalMilkAmount: round2(row.totalMilkAmount || 0),
                    entriesAmount: row.entriesAmount == null ? null : round2(row.entriesAmount),
                    extraMilkAmount: row.extraMilkAmount == null ? null : round2(row.extraMilkAmount),
                    totalAdvanceDeduction: round2(row.totalAdvanceDeduction || 0),
                    netPayable: round2(row.netPayable || 0),
                    closingBalance: round2(row.closingBalance || 0),
                    createdAt: safeIso(row.createdAt),
                    remark: row.notes || row.reference || 'Payment received',
                    dairyName: ownerName(row),
                })),
                advances: advances.map((row) => mapCollectionAdvance(row, identity, publicUser.name)),
                advancePage: {
                    total: advanceCount,
                    nextCursor: advanceCursor(advances, advanceCount > advances.length),
                },
                generatedAt: new Date().toISOString(),
            };
        } else {
            const sellingScopes = sellingLedgerScopes(identity);
            const entryQuery = scopedQuery(sellingScopes);
            const paymentQuery = scopedQuery(sellingScopes);
            const advanceQuery = sellingAdvanceQuery(identity);

            const [totals, entries, payments, advances, advanceCount, advanceTotals] = await Promise.all([
                SellingEntry.aggregate([
                    { $match: castAggregateMatch(entryQuery) },
                    {
                        $facet: {
                            all: [{
                                $group: {
                                    _id: null,
                                    quantity: {
                                        $sum: {
                                            $add: [
                                                { $ifNull: ['$morningQuantity', 0] },
                                                { $ifNull: ['$eveningQuantity', 0] },
                                            ],
                                        },
                                    },
                                    amount: { $sum: { $ifNull: ['$amount', 0] } },
                                    unpaidAmount: {
                                        $sum: {
                                            $cond: [
                                                { $eq: [{ $ifNull: ['$isPaid', false] }, false] },
                                                { $ifNull: ['$amount', 0] },
                                                0,
                                            ],
                                        },
                                    },
                                },
                            }],
                            today: [
                                { $match: { date: { $gte: todayStart, $lt: tomorrowStart } } },
                                {
                                    $group: {
                                        _id: null,
                                        quantity: {
                                            $sum: {
                                                $add: [
                                                    { $ifNull: ['$morningQuantity', 0] },
                                                    { $ifNull: ['$eveningQuantity', 0] },
                                                ],
                                            },
                                        },
                                        amount: { $sum: { $ifNull: ['$amount', 0] } },
                                    },
                                },
                            ],
                        },
                    },
                ]),
                SellingEntry.find(entryQuery)
                    .populate('member', 'name mobile')
                    .sort({ date: -1, _id: -1 })
                    .limit(120)
                    .lean(),
                MemberPayment.find(paymentQuery)
                    .populate('member', 'name mobile')
                    .sort({ date: -1, _id: -1 })
                    .limit(120)
                    .lean(),
                SellingAdvance.find(advanceQuery)
                    .populate('member', 'name mobile')
                    .sort({ date: -1, _id: -1 })
                    .limit(120)
                    .lean(),
                SellingAdvance.countDocuments(advanceQuery),
                // Offsets belong to a specific customer and dairy, not the
                // combined histories of everyone linked to the same phone.
                SellingAdvance.aggregate([
                    { $match: castAggregateMatch(advanceQuery) },
                    { $group: {
                        _id: { owner: '$owner', member: '$member' },
                        given: { $sum: { $cond: [
                            { $and: [{ $ne: ['$type', 'adjusted'] }, { $ne: ['$status', 'settled'] }] },
                            { $max: [0, { $subtract: [{ $ifNull: ['$amount', 0] }, { $ifNull: ['$settledAmount', 0] }] }] }, 0,
                        ] } },
                        adjusted: { $sum: { $cond: [{ $eq: ['$type', 'adjusted'] }, { $ifNull: ['$amount', 0] }, 0] } },
                    } },
                ]),
            ]);

            const allTotals = totals?.[0]?.all?.[0] || {};
            const todayTotals = totals?.[0]?.today?.[0] || {};
            const advancePending = round2(advanceTotals.reduce((sum, group) => sum + Math.max(0, Number(group.given || 0) - Number(group.adjusted || 0)), 0));
            const { baseBalance, entryAmount } = await portalBalanceParts({ identity, module, offset });

            response = {
                module,
                availableModules,
                profile: publicUser,
                summary: {
                    todayMilkQuantity: round2(todayTotals.quantity || 0),
                    todayMilkAmount: round2(todayTotals.amount || 0),
                    totalMilkQuantity: round2(allTotals.quantity || 0),
                    totalMilkAmount: round2(allTotals.amount || 0),
                    advancePending,
                    currentBalance: round2(baseBalance + entryAmount + advancePending),
                    status: 'Active',
                },
                entries: entries.map((row) => ({
                    id: toId(row._id),
                    date: safeIso(row.date),
                    customerName: row.member?.name || publicUser.name,
                    quantity: round3(Number(row.morningQuantity || 0) + Number(row.eveningQuantity || 0)),
                    morningQuantity: round3(row.morningQuantity),
                    eveningQuantity: round3(row.eveningQuantity),
                    rate: round2(row.rate || 0),
                    amount: round2(row.amount || 0),
                    status: row.isPaid ? 'Paid' : 'Pending',
                    remark: row.notes || 'Milk sale',
                    dairyName: ownerName(row),
                })),
                payments: payments.map((row) => ({ ...mapSellingPayment(row), dairyName: ownerName(row) })),
                advances: advances.map((row) => mapSellingAdvance(row, identity, publicUser.name)),
                advancePage: {
                    total: advanceCount,
                    nextCursor: advanceCursor(advances, advanceCount > advances.length),
                },
                generatedAt: new Date().toISOString(),
            };
        }

        return res.json({ success: true, response });
    } catch (error) {
        console.error('[portal] dashboard error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load portal dashboard.' });
    }
});

// Read-only, cursor-paged collection report for the verified portal phone.
router.get('/collection-entries', portalAuth, async (req, res) => {
    try {
        const start = String(req.query.startDate || '');
        const end = String(req.query.endDate || '');
        if ((start && !validDateKey(start)) || (end && !validDateKey(end)) || (start && end && start > end)) {
            return res.status(400).json({ success: false, message: 'Please select a valid date range.' });
        }
        const cursorDate = String(req.query.date || '');
        const cursorId = String(req.query.id || '');
        const parsedCursorDate = cursorDate === 'none' ? null : new Date(cursorDate);
        if ((cursorDate || cursorId) && (!cursorDate || !mongoose.isValidObjectId(cursorId) || (parsedCursorDate && Number.isNaN(parsedCursorDate.getTime())))) {
            return res.status(400).json({ success: false, message: 'Invalid entries cursor.' });
        }
        const identity = await findPortalProfiles(req.portalPhone);
        if (!identity.availableModules.collection) {
            return res.status(403).json({ success: false, message: 'Collection data is not linked to this mobile number.', code: 'MODULE_NOT_AVAILABLE' });
        }
        const offsetValue = Number(req.query.tzOffsetMinutes);
        const offset = req.query.tzOffsetMinutes === undefined || !Number.isFinite(offsetValue) ? 330 : Math.max(-720, Math.min(840, offsetValue));
        const scope = castAggregateMatch(collectionMilkQuery(identity));
        const query = start || end ? { $and: [scope, collectionDateQuery(start, end, offset)] } : scope;
        const pagePipeline = [
            { $match: query },
            { $addFields: { _portalDate: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } } } },
        ];
        if (cursorDate) {
            const oid = new mongoose.Types.ObjectId(cursorId);
            const older = parsedCursorDate ? [
                { _portalDate: { $lt: parsedCursorDate } },
                { _portalDate: parsedCursorDate, _id: { $lt: oid } },
                { _portalDate: null },
            ] : [{ _portalDate: null, _id: { $lt: oid } }];
            pagePipeline.push({ $match: { $or: older } });
        }
        pagePipeline.push({ $sort: { _portalDate: -1, _id: -1 } }, { $limit: 61 });
        const [totals, docs] = await Promise.all([
            MilkCollection.aggregate([
                { $match: query },
                { $group: {
                    _id: null,
                    count: { $sum: 1 },
                    quantity: { $sum: { $ifNull: ['$quantity', 0] } },
                    amount: { $sum: { $ifNull: ['$amount', 0] } },
                    bonus: { $sum: { $ifNull: ['$bonusAmount', 0] } },
                } },
            ]),
            MilkCollection.aggregate(pagePipeline),
        ]);
        const rows = docs.slice(0, 60);
        const total = totals[0] || {};
        const quantity = Number(total.quantity || 0);
        const amount = Number(total.amount || 0);
        const last = rows[rows.length - 1];
        return res.json({ success: true, response: {
            summary: {
                count: Number(total.count || 0),
                quantity: Math.round(quantity * 1000) / 1000,
                amount: round2(amount),
                bonus: round2(total.bonus || 0),
                avgRate: quantity > 0 ? round2(amount / quantity) : 0,
            },
            entries: rows.map((row) => {
                const link = identity.collectionLinks.find((candidate) => toId(row.owner) === candidate.owner && (
                    candidate.allProfileIds.includes(toId(row.purchaseFarmer)) ||
                    (row.farmerCode && String(row.farmerCode).trim().toLowerCase() === String(candidate.code).trim().toLowerCase())
                ));
                return {
                    id: toId(row._id), date: safeIso(row._portalDate),
                    quantity: Math.round(Number(row.quantity || 0) * 1000) / 1000,
                    fat: row.fat == null ? null : round2(row.fat),
                    snf: row.snf == null ? null : round2(row.snf), rate: round2(row.rate || 0),
                    bonusAmount: round2(row.bonusAmount || 0), bonusType: row.bonusType || '', bonusRate: round2(row.bonusRate || 0),
                    amount: round2(row.amount || 0), status: row.isPaid ? 'Paid' : 'Pending',
                    shift: row.shift || '', farmerName: link?.name || 'Farmer', dairyName: identity.ownerNames[toId(row.owner)] || 'Dairy',
                };
            }),
            nextCursor: docs.length > 60 && last ? { date: safeIso(last._portalDate) || 'none', id: toId(last._id) } : null,
            dairyNames: Array.from(new Set(identity.collectionLinks.map((link) => identity.ownerNames[link.owner] || 'Dairy'))),
            multipleProfiles: identity.collectionLinks.length > 1,
        } });
    } catch (error) {
        console.error('[portal] collection entries error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load collection entries.' });
    }
});

// Selling dates use UTC calendar days and the verified owner/member scope.
router.get('/selling-entries', portalAuth, async (req, res) => {
    try {
        const start = String(req.query.startDate || '');
        const end = String(req.query.endDate || '');
        if ((start && !validDateKey(start)) || (end && !validDateKey(end)) || (start && end && start > end)) {
            return res.status(400).json({ success: false, message: 'Please select a valid date range.' });
        }
        const cursorDate = String(req.query.date || '');
        const cursorId = String(req.query.id || '');
        const parsedCursorDate = cursorDate === 'none' ? null : new Date(cursorDate);
        if ((cursorDate || cursorId) && (!cursorDate || !mongoose.isValidObjectId(cursorId) || (parsedCursorDate && Number.isNaN(parsedCursorDate.getTime())))) {
            return res.status(400).json({ success: false, message: 'Invalid entries cursor.' });
        }
        const identity = await findPortalProfiles(req.portalPhone);
        if (!identity.availableModules.selling) {
            return res.status(403).json({ success: false, message: 'Selling data is not linked to this mobile number.', code: 'MODULE_NOT_AVAILABLE' });
        }
        // SellingEntry dates are normalized to UTC midnight by the dairy API.
        const scope = castAggregateMatch(scopedQuery(sellingLedgerScopes(identity)));
        const query = start || end ? { $and: [scope, collectionDateQuery(start, end, 0)] } : scope;
        const pagePipeline = [
            { $match: query },
            { $addFields: { _portalDate: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } } } },
        ];
        if (cursorDate) {
            const oid = new mongoose.Types.ObjectId(cursorId);
            const older = parsedCursorDate ? [
                { _portalDate: { $lt: parsedCursorDate } },
                { _portalDate: parsedCursorDate, _id: { $lt: oid } },
                { _portalDate: null },
            ] : [{ _portalDate: null, _id: { $lt: oid } }];
            pagePipeline.push({ $match: { $or: older } });
        }
        pagePipeline.push({ $sort: { _portalDate: -1, _id: -1 } }, { $limit: 61 });
        const [totals, docs] = await Promise.all([
            SellingEntry.aggregate([
                { $match: query },
                { $group: {
                    _id: null,
                    count: { $sum: 1 },
                    quantity: { $sum: { $add: [{ $ifNull: ['$morningQuantity', 0] }, { $ifNull: ['$eveningQuantity', 0] }] } },
                    amount: { $sum: { $ifNull: ['$amount', 0] } },
                } },
            ]),
            SellingEntry.aggregate(pagePipeline),
        ]);
        const rows = docs.slice(0, 60);
        const total = totals[0] || {};
        const quantity = Number(total.quantity || 0);
        const amount = Number(total.amount || 0);
        const last = rows[rows.length - 1];
        return res.json({ success: true, response: {
            summary: {
                count: Number(total.count || 0),
                quantity: Math.round(quantity * 1000) / 1000,
                amount: round2(amount),
                bonus: round2(total.bonus || 0),
                avgRate: quantity > 0 ? round2(amount / quantity) : 0,
            },
            entries: rows.map((row) => {
                const link = identity.sellingLinks.find((candidate) => toId(row.owner) === candidate.owner && candidate.memberIds.includes(toId(row.member)));
                const member = link?.memberDocs?.find((doc) => toId(doc._id) === toId(row.member));
                return {
                    id: toId(row._id), date: safeIso(row._portalDate),
                    quantity: round3(Number(row.morningQuantity || 0) + Number(row.eveningQuantity || 0)),
                    morningQuantity: round3(row.morningQuantity), eveningQuantity: round3(row.eveningQuantity),
                    rate: round2(row.rate || 0), amount: round2(row.amount || 0),
                    status: row.isPaid ? 'Paid' : 'Pending',
                    customerName: member?.name || link?.name || 'Customer', dairyName: identity.ownerNames[toId(row.owner)] || 'Dairy',
                };
            }),
            nextCursor: docs.length > 60 && last ? { date: safeIso(last._portalDate) || 'none', id: toId(last._id) } : null,
            dairyNames: Array.from(new Set(identity.sellingLinks.map((link) => identity.ownerNames[link.owner] || 'Dairy'))),
            multipleProfiles: identity.sellingLinks.reduce((n, link) => n + link.memberIds.length, 0) > 1,
        } });
    } catch (error) {
        console.error('[portal] selling entries error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load selling entries.' });
    }
});

// Settlement history for the verified portal identity. Three records per
// request; an opaque date/id cursor avoids skipping rows with the same date.
router.get('/collection-payments', portalAuth, async (req, res) => {
    try {
        const cursorDate = String(req.query.date || '');
        const cursorId = String(req.query.id || '');
        const parsedDate = cursorDate === 'none' ? null : new Date(cursorDate);
        if ((cursorDate || cursorId) && (!cursorDate || !mongoose.isValidObjectId(cursorId) || (parsedDate && Number.isNaN(parsedDate.getTime())))) {
            return res.status(400).json({ success: false, message: 'Invalid payment cursor.' });
        }
        const identity = await findPortalProfiles(req.portalPhone);
        if (!identity.availableModules.collection) {
            return res.status(403).json({ success: false, message: 'Collection data is not linked to this mobile number.', code: 'MODULE_NOT_AVAILABLE' });
        }
        const query = scopedQuery(collectionLedgerScopes(identity));
        const pagePipeline = [
            { $match: castAggregateMatch(query) },
            { $addFields: { _portalDate: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } } } },
        ];
        if (cursorDate) {
            const oid = new mongoose.Types.ObjectId(cursorId);
            const older = parsedDate ? [
                { _portalDate: { $lt: parsedDate } },
                { _portalDate: parsedDate, _id: { $lt: oid } },
                { _portalDate: null },
            ] : [{ _portalDate: null, _id: { $lt: oid } }];
            pagePipeline.push({ $match: { $or: older } });
        }
        pagePipeline.push({ $sort: { _portalDate: -1, _id: -1 } }, { $limit: 4 }, { $project: {
            owner: 1, farmer: 1, _portalDate: 1, amount: 1, paymentMethod: 1, periodStart: 1, periodEnd: 1,
            totalMilkAmount: 1, entriesAmount: 1, extraMilkAmount: 1, totalAdvanceDeduction: 1, netPayable: 1, closingBalance: 1, createdAt: 1, notes: 1, reference: 1,
        } });
        const [total, docs] = await Promise.all([
            Payment.countDocuments(query),
            Payment.aggregate(pagePipeline),
        ]);
        const rows = docs.slice(0, 3);
        const last = rows[rows.length - 1];
        return res.json({ success: true, response: {
            total,
            payments: rows.map((row) => {
                const link = identity.collectionLinks.find((candidate) => toId(row.owner) === candidate.owner &&
                    (candidate.farmerIds.length ? candidate.farmerIds : candidate.allProfileIds).includes(toId(row.farmer)));
                const farmer = link?.farmerDocs?.find((doc) => toId(doc._id) === toId(row.farmer));
                return {
                    id: toId(row._id), date: safeIso(row._portalDate),
                    amount: round2(row.amount || 0), mode: modeLabel(row.paymentMethod),
                    periodStart: safeIso(row.periodStart), periodEnd: safeIso(row.periodEnd),
                    totalMilkAmount: round2(row.totalMilkAmount || 0),
                    entriesAmount: row.entriesAmount == null ? null : round2(row.entriesAmount),
                    extraMilkAmount: row.extraMilkAmount == null ? null : round2(row.extraMilkAmount),
                    totalAdvanceDeduction: round2(row.totalAdvanceDeduction || 0),
                    netPayable: round2(row.netPayable || 0), closingBalance: round2(row.closingBalance || 0),
                    createdAt: safeIso(row.createdAt), remark: row.notes || row.reference || 'Payment received',
                    farmerName: farmer?.name || link?.name || 'Farmer',
                    dairyName: identity.ownerNames[toId(row.owner)] || 'Dairy',
                };
            }),
            nextCursor: docs.length > 3 && last ? { date: safeIso(last._portalDate) || 'none', id: toId(last._id) } : null,
            multipleProfiles: identity.collectionLinks.length > 1,
        } });
    } catch (error) {
        console.error('[portal] collection payments error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load settlement payments.' });
    }
});

// Selling settlement history uses the same 3-row cursor paging as Collection.
router.get('/selling-payments', portalAuth, async (req, res) => {
    try {
        const cursorDate = String(req.query.date || '');
        const cursorId = String(req.query.id || '');
        const parsedDate = cursorDate === 'none' ? null : new Date(cursorDate);
        if ((cursorDate || cursorId) && (!cursorDate || !mongoose.isValidObjectId(cursorId) || (parsedDate && Number.isNaN(parsedDate.getTime())))) {
            return res.status(400).json({ success: false, message: 'Invalid payment cursor.' });
        }
        const identity = await findPortalProfiles(req.portalPhone);
        if (!identity.availableModules.selling) {
            return res.status(403).json({ success: false, message: 'Selling data is not linked to this mobile number.', code: 'MODULE_NOT_AVAILABLE' });
        }
        const query = scopedQuery(sellingLedgerScopes(identity));
        const pagePipeline = [
            { $match: castAggregateMatch(query) },
            { $addFields: { _portalDate: { $convert: { input: '$date', to: 'date', onError: null, onNull: null } } } },
        ];
        if (cursorDate) {
            const oid = new mongoose.Types.ObjectId(cursorId);
            const older = parsedDate ? [
                { _portalDate: { $lt: parsedDate } },
                { _portalDate: parsedDate, _id: { $lt: oid } },
                { _portalDate: null },
            ] : [{ _portalDate: null, _id: { $lt: oid } }];
            pagePipeline.push({ $match: { $or: older } });
        }
        pagePipeline.push({ $sort: { _portalDate: -1, _id: -1 } }, { $limit: 4 }, { $project: {
            owner: 1, member: 1, _portalDate: 1, amount: 1, paymentMethod: 1, periodStart: 1, periodEnd: 1,
            totalSellAmount: 1, advanceApplied: 1, advanceEffect: 1, netPayable: 1, closingBalance: 1, createdAt: 1, notes: 1, reference: 1,
        } });
        const [total, docs] = await Promise.all([
            MemberPayment.countDocuments(query),
            MemberPayment.aggregate(pagePipeline),
        ]);
        const rows = docs.slice(0, 3);
        const last = rows[rows.length - 1];
        return res.json({ success: true, response: {
            total,
            payments: rows.map((row) => {
                const link = identity.sellingLinks.find((candidate) => toId(row.owner) === candidate.owner && candidate.memberIds.includes(toId(row.member)));
                const member = link?.memberDocs?.find((doc) => toId(doc._id) === toId(row.member));
                return { ...mapSellingPayment(row), customerName: member?.name || link?.name || 'Customer', dairyName: identity.ownerNames[toId(row.owner)] || 'Dairy' };
            }),
            nextCursor: docs.length > 3 && last ? { date: safeIso(last._portalDate) || 'none', id: toId(last._id) } : null,
            multipleProfiles: identity.sellingLinks.reduce((n, link) => n + link.memberIds.length, 0) > 1,
        } });
    } catch (error) {
        console.error('[portal] selling payments error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load selling payments.' });
    }
});

// Additional portal advances, using a stable date/id cursor.
router.get('/advances', portalAuth, async (req, res) => {
    try {
        const module = String(req.query.module || '').toLowerCase();
        if (!['collection', 'selling'].includes(module)) {
            return res.status(400).json({ success: false, message: 'Invalid portal module.' });
        }
        const dateText = String(req.query.date || '');
        const id = String(req.query.id || '');
        const date = dateText === 'none' ? null : new Date(dateText);
        if (!dateText || (date && Number.isNaN(date.getTime())) || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid advance cursor.' });
        }
        const identity = await findPortalProfiles(req.portalPhone);
        if (!identity.availableModules[module]) {
            return res.status(403).json({ success: false, message: 'This module is not linked to this mobile number.', code: 'MODULE_NOT_AVAILABLE' });
        }
        const isCollection = module === 'collection';
        const baseQuery = isCollection ? collectionAdvanceQuery(identity) : sellingAdvanceQuery(identity);
        const older = date ? [
            { date: { $lt: date } },
            { date, _id: { $lt: new mongoose.Types.ObjectId(id) } },
            { date: null }, // Legacy records without a date sort after dated rows.
        ] : [{ date: null, _id: { $lt: new mongoose.Types.ObjectId(id) } }];
        const query = { $and: [baseQuery, { $or: older }] };
        const Model = isCollection ? Advance : SellingAdvance;
        const docs = await Model.find(query).populate(isCollection ? 'farmer' : 'member', 'code name mobile')
            .sort({ date: -1, _id: -1 }).limit(121).lean();
        const rows = docs.slice(0, 120);
        const profile = publicPortalIdentity(identity, module);
        return res.json({ success: true, response: {
            advances: rows.map((row) => isCollection ? mapCollectionAdvance(row, identity, profile.name) : mapSellingAdvance(row, identity, profile.name)),
            nextCursor: advanceCursor(rows, docs.length > 120),
        } });
    } catch (error) {
        console.error('[portal] advances error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load more advances.' });
    }
});

module.exports = router;
