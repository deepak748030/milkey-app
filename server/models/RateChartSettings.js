const mongoose = require('mongoose');

// Per-user "quick" rate chart settings used by the mobile Collection tab.
// Formula is client-side (FatRate = rate*0.08, SnfRate = rate*0.053333);
// this only persists the user's inputs so the chart stays consistent across devices.
const rateChartSettingsSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    rate: { type: Number, default: 60 },
    fatMin: { type: Number, default: 3 },
    fatMax: { type: Number, default: 9 },
    snfMin: { type: Number, default: 8 },
    snfMax: { type: Number, default: 10 },
    step: { type: Number, default: 0.1 },
    presetKey: { type: String, default: 'standard' },
}, { timestamps: true });

module.exports = mongoose.model('RateChartSettings', rateChartSettingsSchema);
