const express = require('express');
const router = express.Router();
const RateChart = require('../models/RateChart');
const RateChartSettings = require('../models/RateChartSettings');
const auth = require('../middleware/auth');

// ─── Quick rate-chart settings (per-user) ───
// Used by the mobile Collection tab's Rate Chart modal.
// Client computes the grid; server just stores the user's inputs.

const clampNum = (v, def, min, max) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!Number.isFinite(n)) return def;
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
};

router.get('/quick-settings', auth, async (req, res) => {
    try {
        let doc = await RateChartSettings.findOne({ owner: req.user._id });
        if (!doc) {
            doc = await RateChartSettings.create({ owner: req.user._id });
        }
        res.json({ success: true, response: doc });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/quick-settings', auth, async (req, res) => {
    try {
        const { rate, fatMin, fatMax, snfMin, snfMax, step, presetKey } = req.body || {};
        const update = {
            rate: clampNum(rate, 60, 0, 100000),
            fatMin: clampNum(fatMin, 3, 0, 100),
            fatMax: clampNum(fatMax, 9, 0, 100),
            snfMin: clampNum(snfMin, 8, 0, 100),
            snfMax: clampNum(snfMax, 10, 0, 100),
            step: clampNum(step, 0.1, 0.01, 5),
            presetKey: typeof presetKey === 'string' ? presetKey.slice(0, 32) : 'standard',
        };
        if (update.fatMax < update.fatMin) update.fatMax = update.fatMin;
        if (update.snfMax < update.snfMin) update.snfMax = update.snfMin;
        const doc = await RateChartSettings.findOneAndUpdate(
            { owner: req.user._id },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, response: doc });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

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

        if (fat === undefined) {
            return res.status(400).json({ success: false, message: 'FAT is required' });
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
