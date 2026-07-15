const express = require('express');
const router = express.Router();
const PurchaseFarmer = require('../models/PurchaseFarmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const codeRegex = (code) => new RegExp(`^${escapeRegExp(normalizeCode(code))}$`, 'i');

// GET /api/purchase-farmers
router.get('/', auth, async (req, res) => {
    try {
        const { search, page = 1, limit = 50, includeInactive } = req.query;
        const query = { owner: req.userId };

        // By default only show active, but allow including inactive
        if (includeInactive === 'true') {
            // Show all farmers (active + inactive)
        } else {
            query.isActive = true;
        }

        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await PurchaseFarmer.countDocuments(query);
        // Sort by code numerically (ascending). Codes are stored as strings,
        // so we use an aggregation that converts the code to a number when
        // possible, falling back to a high value for non-numeric codes so
        // they sort to the end. Active farmers first, then by numeric code.
        const farmers = await PurchaseFarmer.aggregate([
            { $match: query },
            {
                $addFields: {
                    _codeNum: {
                        $convert: {
                            input: '$code',
                            to: 'double',
                            onError: Number.MAX_SAFE_INTEGER,
                            onNull: Number.MAX_SAFE_INTEGER,
                        },
                    },
                },
            },
            { $sort: { isActive: -1, _codeNum: 1, code: 1 } },
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            { $project: { _codeNum: 0 } },
        ]);

        res.json({
            success: true,
            response: {
                data: farmers,
                count: total,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get purchase farmers error:', error);
        res.status(500).json({ success: false, message: 'Failed to get purchase farmers' });
    }
});

// GET /api/purchase-farmers/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const farmer = await PurchaseFarmer.findOne({ _id: req.params.id, owner: req.userId }).lean();
        if (!farmer) return res.status(404).json({ success: false, message: 'Purchase farmer not found' });
        res.json({ success: true, response: farmer });
    } catch (error) {
        console.error('Get purchase farmer error:', error);
        res.status(500).json({ success: false, message: 'Failed to get purchase farmer' });
    }
});

// GET /api/purchase-farmers/code/:code
router.get('/code/:code', auth, async (req, res) => {
    try {
        const farmer = await PurchaseFarmer.findOne({
            code: codeRegex(req.params.code),
            owner: req.userId,
            isActive: true
        }).lean();
        if (!farmer) return res.status(404).json({ success: false, message: 'Purchase farmer not found' });
        res.json({ success: true, response: farmer });
    } catch (error) {
        console.error('Get purchase farmer by code error:', error);
        res.status(500).json({ success: false, message: 'Failed to get purchase farmer' });
    }
});

// POST /api/purchase-farmers
router.post('/', auth, requireSubscription('purchase'), async (req, res) => {
    try {
        const { code, name, mobile, address, cowEnabled, buffaloEnabled, defaultMilk, priceBasis, cowRate, buffaloRate, cowFat, buffaloFat, cowSnf, buffaloSnf, alertMethod, printEntrySlip, showRateChart } = req.body;
        const normalizedCode = normalizeCode(code);

        if (!normalizedCode || !name) {
            return res.status(400).json({ success: false, message: 'Code and name are required' });
        }

        const existing = await PurchaseFarmer.findOne({ code: codeRegex(normalizedCode), owner: req.userId });
        if (existing) return res.status(400).json({ success: false, message: 'Customer with this code already exists' });

        const farmer = await PurchaseFarmer.create({
            code: normalizedCode,
            name: String(name).trim(),
            mobile: mobile?.trim() || '',
            address: address?.trim() || '',
            owner: req.userId,
            cowEnabled: cowEnabled !== undefined ? cowEnabled : true,
            buffaloEnabled: buffaloEnabled !== undefined ? buffaloEnabled : true,
            defaultMilk: defaultMilk || 'buffalo',
            priceBasis: priceBasis || 'rate',
            cowRate: parseFloat(cowRate) || 0,
            buffaloRate: parseFloat(buffaloRate) || 0,
            cowFat: parseFloat(cowFat) || 0,
            buffaloFat: parseFloat(buffaloFat) || 0,
            cowSnf: parseFloat(cowSnf) || 0,
            buffaloSnf: parseFloat(buffaloSnf) || 0,
            alertMethod: alertMethod || 'none',
            printEntrySlip: printEntrySlip || 'default',
            showRateChart: showRateChart === true,
        });

        res.status(201).json({ success: true, message: 'Customer added successfully', response: farmer });
    } catch (error) {
        console.error('Create purchase farmer error:', error);
        res.status(500).json({ success: false, message: 'Failed to add customer' });
    }
});

// PUT /api/purchase-farmers/:id
router.put('/:id', auth, requireSubscription('purchase'), async (req, res) => {
    try {
        const { name, mobile, address, cowEnabled, buffaloEnabled, defaultMilk, priceBasis, cowRate, buffaloRate, cowFat, buffaloFat, cowSnf, buffaloSnf, alertMethod, printEntrySlip, showRateChart } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (mobile !== undefined) updateData.mobile = mobile;
        if (address !== undefined) updateData.address = address;
        if (cowEnabled !== undefined) updateData.cowEnabled = cowEnabled;
        if (buffaloEnabled !== undefined) updateData.buffaloEnabled = buffaloEnabled;
        if (defaultMilk !== undefined) updateData.defaultMilk = defaultMilk;
        if (priceBasis !== undefined) updateData.priceBasis = priceBasis;
        if (cowRate !== undefined) updateData.cowRate = parseFloat(cowRate) || 0;
        if (buffaloRate !== undefined) updateData.buffaloRate = parseFloat(buffaloRate) || 0;
        if (cowFat !== undefined) updateData.cowFat = parseFloat(cowFat) || 0;
        if (buffaloFat !== undefined) updateData.buffaloFat = parseFloat(buffaloFat) || 0;
        if (cowSnf !== undefined) updateData.cowSnf = parseFloat(cowSnf) || 0;
        if (buffaloSnf !== undefined) updateData.buffaloSnf = parseFloat(buffaloSnf) || 0;
        if (alertMethod !== undefined) updateData.alertMethod = alertMethod;
        if (printEntrySlip !== undefined) updateData.printEntrySlip = printEntrySlip;
        if (showRateChart !== undefined) updateData.showRateChart = !!showRateChart;

        const farmer = await PurchaseFarmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            updateData,
            { new: true }
        );

        if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.json({ success: true, message: 'Customer updated successfully', response: farmer });
    } catch (error) {
        console.error('Update purchase farmer error:', error);
        res.status(500).json({ success: false, message: 'Failed to update customer' });
    }
});

// PUT /api/purchase-farmers/:id/stats
router.put('/:id/stats', auth, requireSubscription('purchase'), async (req, res) => {
    try {
        const { quantity, amount } = req.body;
        const farmer = await PurchaseFarmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { $inc: { totalQuantity: quantity || 0, totalAmount: amount || 0 }, lastPurchaseDate: new Date() },
            { new: true }
        );
        if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.json({ success: true, message: 'Customer stats updated', response: farmer });
    } catch (error) {
        console.error('Update purchase farmer stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to update stats' });
    }
});

// Check code availability
router.get('/check-code/:code', auth, async (req, res) => {
    try {
        const existing = await PurchaseFarmer.findOne({
            code: codeRegex(req.params.code),
            owner: req.userId,
            isActive: true
        });
        res.json({ success: true, response: { available: !existing } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check code' });
    }
});

// DELETE /api/purchase-farmers/:id
router.delete('/:id', auth, requireSubscription('purchase'), async (req, res) => {
    try {
        const farmer = await PurchaseFarmer.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { isActive: false },
            { new: true }
        );
        if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' });
        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Delete purchase farmer error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete customer' });
    }
});

module.exports = router;
