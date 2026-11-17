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

const sellingAdvancePending = (docs) => {
    let pendingGiven = 0;
    let adjusted = 0;
    for (const doc of docs) {
        if (doc.isDeleted) continue;
        const amount = Number(doc.amount || 0);
        if (doc.type === 'adjusted') {
            adjusted += amount;
        } else if (doc.status !== 'settled') {
            pendingGiven += Math.max(0, round2(amount - Number(doc.settledAmount || 0)));
        }
    }
    return round2(Math.max(0, pendingGiven - adjusted));
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
        const publicUser = publicPortalIdentity(identity, module);
        const availableModules = publicUser.availableModules;
        const ownerName = (doc) => identity.ownerNames[toId(doc?.owner)] || 'Dairy';

        let response;
        if (module === 'collection') {
            const milkScopes = identity.collectionLinks.map((link) => ({
                owner: link.owner,
                $or: [
                    { purchaseFarmer: { $in: link.allProfileIds } },
                    { farmerCode: { $regex: `^${escapeRegExp(link.code)}$`, $options: 'i' } },
                ],
            }));
            const ledgerScopes = identity.collectionLinks.map((link) => ({
                owner: link.owner,
                farmer: { $in: link.farmerIds.length ? link.farmerIds : link.allProfileIds },
            }));

            const milkQuery = scopedQuery(milkScopes);
            const advanceQuery = scopedQuery(ledgerScopes, { isDeleted: { $ne: true } });
            const paymentQuery = scopedQuery(ledgerScopes);

            const [totals, entries, payments, advances] = await Promise.all([
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
            ]);

            const allTotals = totals?.[0]?.all?.[0] || {};
            const todayTotals = totals?.[0]?.today?.[0] || {};
            const advancePending = round2(advances.reduce((sum, doc) => sum + collectionRemaining(doc), 0));
            const unpaidMilkAmount = round2(allTotals.unpaidAmount || 0);

            // Read-only balance: latest payment closing balance per linked farmer,
            // falling back to the existing farmer.currentBalance field. We never
            // write these values back, so old data remains untouched.
            const latestPaymentByFarmer = new Map();
            for (const payment of payments) {
                const farmerId = toId(payment.farmer?._id || payment.farmer);
                const key = `${toId(payment.owner)}:${farmerId}`;
                if (!latestPaymentByFarmer.has(key)) latestPaymentByFarmer.set(key, payment);
            }
            const baseBalance = identity.collectionLinks.reduce((sum, link) => {
                let linkBalance = 0;
                for (const farmer of link.farmerDocs) {
                    const key = `${link.owner}:${toId(farmer._id)}`;
                    const latest = latestPaymentByFarmer.get(key);
                    linkBalance += Number(latest?.closingBalance ?? farmer.currentBalance ?? 0);
                }
                return sum + linkBalance;
            }, 0);

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
                    currentBalance: round2(baseBalance + unpaidMilkAmount - advancePending),
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
                    totalAdvanceDeduction: round2(row.totalAdvanceDeduction || 0),
                    netPayable: round2(row.netPayable || 0),
                    closingBalance: round2(row.closingBalance || 0),
                    createdAt: safeIso(row.createdAt),
                    remark: row.notes || row.reference || 'Payment received',
                    dairyName: ownerName(row),
                })),
                advances: advances.map((row) => {
                    const adjusted = row.status === 'settled' || Number(row.settledAmount || 0) > 0;
                    return {
                        id: toId(row._id),
                        date: safeIso(row.date),
                        type: adjusted ? 'Adjusted' : 'Given',
                        direction: adjusted ? 'up' : 'down',
                        amount: round2(row.amount || 0),
                        remaining: collectionRemaining(row),
                        status: row.status || 'pending',
                        remark: row.note || (adjusted ? 'Adjusted in settlement' : 'Advance given'),
                        dairyName: ownerName(row),
                    };
                }),
                generatedAt: new Date().toISOString(),
            };
        } else {
            const sellingScopes = identity.sellingLinks.map((link) => ({
                owner: link.owner,
                member: { $in: link.memberIds },
            }));
            const entryQuery = scopedQuery(sellingScopes);
            const paymentQuery = scopedQuery(sellingScopes);
            const advanceQuery = scopedQuery(sellingScopes, { isDeleted: { $ne: true } });

            const [totals, entries, payments, advances] = await Promise.all([
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
            ]);

            const allTotals = totals?.[0]?.all?.[0] || {};
            const todayTotals = totals?.[0]?.today?.[0] || {};
            const advancePending = sellingAdvancePending(advances);
            const unpaidSellAmount = round2(allTotals.unpaidAmount || 0);

            const latestPaymentByMember = new Map();
            for (const payment of payments) {
                const memberId = toId(payment.member?._id || payment.member);
                const key = `${toId(payment.owner)}:${memberId}`;
                if (!latestPaymentByMember.has(key)) latestPaymentByMember.set(key, payment);
            }
            const baseBalance = identity.sellingLinks.reduce((sum, link) => {
                let linkBalance = 0;
                for (const member of link.memberDocs) {
                    const key = `${link.owner}:${toId(member._id)}`;
                    const latest = latestPaymentByMember.get(key);
                    linkBalance += Number(latest?.closingBalance ?? member.sellingPaymentBalance ?? 0);
                }
                return sum + linkBalance;
            }, 0);

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
                    currentBalance: round2(baseBalance + unpaidSellAmount - advancePending),
                    status: 'Active',
                },
                entries: entries.map((row) => ({
                    id: toId(row._id),
                    date: safeIso(row.date),
                    customerName: row.member?.name || publicUser.name,
                    quantity: round2(Number(row.morningQuantity || 0) + Number(row.eveningQuantity || 0)),
                    rate: round2(row.rate || 0),
                    amount: round2(row.amount || 0),
                    status: row.isPaid ? 'Paid' : 'Pending',
                    remark: row.notes || 'Milk sale',
                    dairyName: ownerName(row),
                })),
                payments: payments.map((row) => ({
                    id: toId(row._id),
                    date: safeIso(row.date),
                    amount: round2(row.amount || 0),
                    mode: modeLabel(row.paymentMethod),
                    remark: row.notes || row.reference || 'Payment received',
                    dairyName: ownerName(row),
                })),
                advances: advances.map((row) => {
                    const adjusted = row.type === 'adjusted' || row.status === 'settled';
                    const remaining = row.type === 'adjusted' || row.status === 'settled'
                        ? 0
                        : Math.max(0, round2(Number(row.amount || 0) - Number(row.settledAmount || 0)));
                    return {
                        id: toId(row._id),
                        date: safeIso(row.date),
                        type: row.type === 'adjusted' ? 'Adjusted' : row.status === 'settled' ? 'Settled' : 'Given',
                        direction: adjusted ? 'up' : 'down',
                        amount: round2(row.amount || 0),
                        remaining,
                        status: row.status || 'pending',
                        remark: row.note || (row.type === 'adjusted' ? 'Advance adjusted' : 'Advance given'),
                        dairyName: ownerName(row),
                    };
                }),
                generatedAt: new Date().toISOString(),
            };
        }

        return res.json({ success: true, response });
    } catch (error) {
        console.error('[portal] dashboard error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load portal dashboard.' });
    }
});

module.exports = router;
