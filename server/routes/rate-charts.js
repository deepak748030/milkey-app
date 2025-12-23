const express = require('express');
const router = express.Router();
const RateChart = require('../models/RateChart');
const auth = require('../middleware/auth');

// Get all rate charts
router.get('/', auth, async (req, res) => {
    try {
        const charts = await RateChart.find({ owner: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, response: { data: charts } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get active rate chart
router.get('/active', auth, async (req, res) => {
    try {
        let chart = await RateChart.findOne({ owner: req.user._id, isActive: true });
        if (!chart) {
            // Create default chart
            chart = await RateChart.create({
                owner: req.user._id,
                name: 'Default Rate Chart',
                calculationType: 'fat_snf',
                baseRate: 50,
                baseFat: 3.5,
                baseSnf: 8.5,
                fatRate: 7.5,
                snfRate: 6.5,
                isActive: true
            });
        }
        res.json({ success: true, response: chart });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Calculate rate for given FAT/SNF
router.post('/calculate', auth, async (req, res) => {
    try {
        const { fat, snf } = req.body;

        if (fat === undefined || snf === undefined) {
            return res.status(400).json({ success: false, message: 'FAT and SNF are required' });
        }

        let chart = await RateChart.findOne({ owner: req.user._id, isActive: true });
        if (!chart) {
            chart = await RateChart.create({
                owner: req.user._id,
                name: 'Default Rate Chart',
                calculationType: 'fat_snf',
                baseRate: 50,
                baseFat: 3.5,
                baseSnf: 8.5,
                fatRate: 7.5,
                snfRate: 6.5,
                isActive: true
            });
        }

        const rate = chart.calculateRate(parseFloat(fat), parseFloat(snf));

        res.json({
            success: true,
            response: {
                rate: Math.round(rate * 100) / 100,
                fat: parseFloat(fat),
                snf: parseFloat(snf),
                chartName: chart.name,
                calculationType: chart.calculationType
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create rate chart
router.post('/', auth, async (req, res) => {
    try {
        const { name, milkType, calculationType, fixedRate, fatRate, snfRate, baseFat, baseSnf, baseRate, entries } = req.body;

        // Deactivate other charts if this is active
        await RateChart.updateMany({ owner: req.user._id }, { isActive: false });

        const chart = await RateChart.create({
            owner: req.user._id,
            name: name || 'New Rate Chart',
            milkType,
            calculationType,
            fixedRate,
            fatRate,
            snfRate,
            baseFat,
            baseSnf,
            baseRate,
            entries,
            isActive: true
        });

        res.status(201).json({ success: true, response: chart });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update rate chart
router.put('/:id', auth, async (req, res) => {
    try {
        const chart = await RateChart.findOneAndUpdate(
            { _id: req.params.id, owner: req.user._id },
            { $set: req.body },
            { new: true }
        );

        if (!chart) {
            return res.status(404).json({ success: false, message: 'Rate chart not found' });
        }

        res.json({ success: true, response: chart });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Set active chart
router.put('/:id/activate', auth, async (req, res) => {
    try {
        await RateChart.updateMany({ owner: req.user._id }, { isActive: false });

        const chart = await RateChart.findOneAndUpdate(
            { _id: req.params.id, owner: req.user._id },
            { isActive: true },
            { new: true }
        );

        if (!chart) {
            return res.status(404).json({ success: false, message: 'Rate chart not found' });
        }

        res.json({ success: true, response: chart });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete rate chart
router.delete('/:id', auth, async (req, res) => {
    try {
        const chart = await RateChart.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

        if (!chart) {
            return res.status(404).json({ success: false, message: 'Rate chart not found' });
        }

        res.json({ success: true, message: 'Rate chart deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Generate rate chart table
router.get('/table', auth, async (req, res) => {
    try {
        const { fatMin = 3.0, fatMax = 6.0, snfMin = 8.0, snfMax = 9.5, step = 0.1 } = req.query;

        let chart = await RateChart.findOne({ owner: req.user._id, isActive: true });
        if (!chart) {
            chart = await RateChart.create({
                owner: req.user._id,
                name: 'Default Rate Chart',
                calculationType: 'fat_snf',
                baseRate: 50,
                baseFat: 3.5,
                baseSnf: 8.5,
                fatRate: 7.5,
                snfRate: 6.5,
                isActive: true
            });
        }

        const table = [];
        for (let fat = parseFloat(fatMin); fat <= parseFloat(fatMax); fat += parseFloat(step)) {
            const row = { fat: Math.round(fat * 10) / 10, rates: [] };
            for (let snf = parseFloat(snfMin); snf <= parseFloat(snfMax); snf += parseFloat(step)) {
                const rate = chart.calculateRate(fat, snf);
                row.rates.push({
                    snf: Math.round(snf * 10) / 10,
                    rate: Math.round(rate * 100) / 100
                });
            }
            table.push(row);
        }

        res.json({ success: true, response: { chart, table } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
