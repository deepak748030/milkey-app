const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const auth = require('../middleware/auth');
const { requireSubscription } = require('../middleware/subscription');
const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeCode = (code) => String(code || '').trim().toUpperCase();
const codeRegex = (code) => new RegExp(`^${escapeRegExp(normalizeCode(code))}$`, 'i');
router.get('/', auth, async (req, res) => {
    try {
        const { search, page = 1, limit, includeInactive } = req.query;
        const parsedPage = Math.max(1, parseInt(page) || 1);
        const clientLimit = parseInt(limit) || 0;
        let parsedLimit = Math.min(5000, Math.max(10, clientLimit || 10));
        if (search) parsedLimit = Math.min(5000, Math.max(10, clientLimit || 10));
        const query = { owner: req.userId }; if (includeInactive !== 'true') query.isActive = true;
        if (search) { const trimmed = String(search).trim(); if (trimmed) query.$or = [{ code: { $regex: trimmed, $options: 'i' } }, { name: { $regex: trimmed, $options: 'i' } }, { mobile: { $regex: trimmed, $options: 'i' } }]; }
        const total = await Farmer.countDocuments(query);
        const farmers = await Farmer.aggregate([
            { $match: query },
            {
                $addFields: {
                    _codeNum: {
                        $convert: {
                            input: { $trim: { input: '$code' } },
                            to: 'double',
                            onError: 999999999,
                            onNull: 999999999
                        }
                    }
                }
            },
            { $sort: { isActive: -1, _codeNum: 1, code: 1 } },
            { $skip: (parsedPage - 1) * parsedLimit },
            { $limit: parsedLimit },
            { $project: { _codeNum: 0 } }
        ]);
        res.json({ success: true, response: { data: farmers, count: total, pagination: { page: parsedPage, limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) || 1 } } });
    } catch (error) { console.error('Get purchase farmers error:', error); res.status(500).json({ success: false, message: 'Failed to get purchase farmers' }); }
});
router.get('/:id', auth, async (req, res) => {
    try { const farmer = await Farmer.findOne({ _id: req.params.id, owner: req.userId }).lean(); if (!farmer) return res.status(404).json({ success: false, message: 'Purchase farmer not found' }); res.json({ success: true, response: farmer }); } catch (error) { res.status(500).json({ success: false, message: 'Failed to get purchase farmer' }); }
});
router.get('/code/:code', auth, async (req, res) => {
    try { const farmer = await Farmer.findOne({ code: codeRegex(req.params.code), owner: req.userId, isActive: true }).lean(); if (!farmer) return res.status(404).json({ success: false, message: 'Purchase farmer not found' }); res.json({ success: true, response: farmer }); } catch (error) { res.status(500).json({ success: false, message: 'Failed to get purchase farmer' }); }
});
router.post('/', auth, requireSubscription('purchase'), async (req, res) => {
    try {
        const { code, name, mobile, address, cowEnabled, buffaloEnabled, defaultMilk, priceBasis, cowRate, buffaloRate, cowFat, buffaloFat, cowSnf, buffaloSnf, alertMethod, printEntrySlip, showRateChart, showRateSetting } = req.body;
        const normalizedCode = normalizeCode(code); if (!normalizedCode || !name) return res.status(400).json({ success: false, message: 'Code and name are required' });
        const existing = await Farmer.findOne({ code: codeRegex(normalizedCode), owner: req.userId });
        if (existing) {
            if (existing.isActive === false) {
                existing.name = String(name).trim(); existing.mobile = mobile?.trim() || ''; existing.address = address?.trim() || ''; existing.cowEnabled = cowEnabled !== undefined ? cowEnabled : true; existing.buffaloEnabled = buffaloEnabled !== undefined ? buffaloEnabled : true; existing.defaultMilk = defaultMilk || 'buffalo'; existing.priceBasis = priceBasis || 'rate'; existing.cowRate = parseFloat(cowRate) || 0; existing.buffaloRate = parseFloat(buffaloRate) || 0; existing.cowFat = parseFloat(cowFat) || 0; existing.buffaloFat = parseFloat(buffaloFat) || 0; existing.cowSnf = parseFloat(cowSnf) || 0; existing.buffaloSnf = parseFloat(buffaloSnf) || 0; existing.alertMethod = alertMethod || 'none'; existing.printEntrySlip = printEntrySlip || 'default'; const _showRate2 = showRateSetting !== undefined ? !!showRateSetting : !!showRateChart; existing.showRateChart = _showRate2; existing.showRateSetting = _showRate2; existing.isActive = true; existing.type = 'unified'; await existing.save(); return res.status(200).json({ success: true, message: 'Customer restored successfully', response: existing });
            }
            return res.status(400).json({ success: false, message: 'Customer with this code already exists' });
        }
        const farmer = await Farmer.create({ code: normalizedCode, name: String(name).trim(), mobile: mobile?.trim() || '', address: address?.trim() || '', owner: req.userId, type: 'unified', cowEnabled: cowEnabled !== undefined ? cowEnabled : true, buffaloEnabled: buffaloEnabled !== undefined ? buffaloEnabled : true, defaultMilk: defaultMilk || 'buffalo', priceBasis: priceBasis || 'rate', cowRate: parseFloat(cowRate) || 0, buffaloRate: parseFloat(buffaloRate) || 0, cowFat: parseFloat(cowFat) || 0, buffaloFat: parseFloat(buffaloFat) || 0, cowSnf: parseFloat(cowSnf) || 0, buffaloSnf: parseFloat(buffaloSnf) || 0, alertMethod: alertMethod || 'none', printEntrySlip: printEntrySlip || 'default', showRateChart: (showRateSetting !== undefined ? !!showRateSetting : !!showRateChart), showRateSetting: (showRateSetting !== undefined ? !!showRateSetting : !!showRateChart) });
        res.status(201).json({ success: true, message: 'Customer added successfully', response: farmer });
    } catch (error) { console.error('Create purchase farmer error:', error); if (error.code === 11000) return res.status(400).json({ success: false, message: 'Customer with this code already exists' }); res.status(500).json({ success: false, message: 'Failed to add customer' }); }
});
router.put('/:id', auth, requireSubscription('purchase'), async (req, res) => {
    try {
        const { name, mobile, address, cowEnabled, buffaloEnabled, defaultMilk, priceBasis, cowRate, buffaloRate, cowFat, buffaloFat, cowSnf, buffaloSnf, alertMethod, printEntrySlip, showRateChart, showRateSetting } = req.body;
        const updateData = {}; if (name !== undefined) updateData.name = name; if (mobile !== undefined) updateData.mobile = mobile; if (address !== undefined) updateData.address = address; if (cowEnabled !== undefined) updateData.cowEnabled = cowEnabled; if (buffaloEnabled !== undefined) updateData.buffaloEnabled = buffaloEnabled; if (defaultMilk !== undefined) updateData.defaultMilk = defaultMilk; if (priceBasis !== undefined) updateData.priceBasis = priceBasis; if (cowRate !== undefined) updateData.cowRate = parseFloat(cowRate) || 0; if (buffaloRate !== undefined) updateData.buffaloRate = parseFloat(buffaloRate) || 0; if (cowFat !== undefined) updateData.cowFat = parseFloat(cowFat) || 0; if (buffaloFat !== undefined) updateData.buffaloFat = parseFloat(buffaloFat) || 0; if (cowSnf !== undefined) updateData.cowSnf = parseFloat(cowSnf) || 0; if (buffaloSnf !== undefined) updateData.buffaloSnf = parseFloat(buffaloSnf) || 0; if (alertMethod !== undefined) updateData.alertMethod = alertMethod; if (printEntrySlip !== undefined) updateData.printEntrySlip = printEntrySlip; const _updRate = showRateSetting !== undefined ? !!showRateSetting : (showRateChart !== undefined ? !!showRateChart : undefined); if (_updRate !== undefined) { updateData.showRateChart = _updRate; updateData.showRateSetting = _updRate; }
        const farmer = await Farmer.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, updateData, { new: true }); if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' }); res.json({ success: true, message: 'Customer updated successfully', response: farmer });
    } catch (error) { res.status(500).json({ success: false, message: 'Failed to update customer' }); }
});
router.put('/:id/stats', auth, requireSubscription('purchase'), async (req, res) => {
    try { const { quantity, amount } = req.body; const farmer = await Farmer.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { $inc: { totalQuantity: quantity || 0, totalAmount: amount || 0, totalLiters: quantity || 0, totalPurchase: amount || 0 }, lastPurchaseDate: new Date() }, { new: true }); if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' }); res.json({ success: true, message: 'Customer stats updated', response: farmer }); } catch (error) { res.status(500).json({ success: false, message: 'Failed to update stats' }); }
});
router.get('/check-code/:code', auth, async (req, res) => {
    try { const existing = await Farmer.findOne({ code: codeRegex(req.params.code), owner: req.userId, isActive: true }); res.json({ success: true, response: { available: !existing } }); } catch (error) { res.status(500).json({ success: false, message: 'Failed to check code' }); }
});
router.delete('/:id', auth, requireSubscription('purchase'), async (req, res) => {
    try { const farmer = await Farmer.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { isActive: false }, { new: true }); if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' }); res.json({ success: true, message: 'Customer deleted successfully' }); } catch (error) { res.status(500).json({ success: false, message: 'Failed to delete customer' }); }
});
// Restore inactive customer - dairy owner can re-activate
router.put('/:id/restore', auth, requireSubscription('purchase'), async (req, res) => {
    try { const farmer = await Farmer.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { isActive: true }, { new: true }); if (!farmer) return res.status(404).json({ success: false, message: 'Customer not found' }); res.json({ success: true, message: 'Customer restored successfully', response: farmer }); } catch (error) { res.status(500).json({ success: false, message: 'Failed to restore customer' }); }
});
module.exports = router;
