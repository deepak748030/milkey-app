const mongoose = require('mongoose');

const rateChartSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Default Rate Chart'
    },
    milkType: {
        type: String,
        enum: ['cow', 'buffalo', 'mixed'],
        default: 'mixed'
    },
    // Rate calculation method
    calculationType: {
        type: String,
        enum: ['fat_only', 'fat_snf', 'fixed'],
        default: 'fat_snf'
    },
    // Fixed rate (if calculationType is 'fixed')
    fixedRate: {
        type: Number,
        default: 0
    },
    // FAT-based rate parameters
    fatRate: {
        type: Number,
        default: 7.5  // Rate per 0.1% FAT
    },
    // SNF-based rate parameters
    snfRate: {
        type: Number,
        default: 6.5  // Rate per 0.1% SNF
    },
    // Base values
    baseFat: {
        type: Number,
        default: 3.5
    },
    baseSnf: {
        type: Number,
        default: 8.5
    },
    baseRate: {
        type: Number,
        default: 50
    },
    // Rate chart entries (for custom charts)
    entries: [{
        fat: { type: Number, required: true },
        snf: { type: Number, required: true },
        rate: { type: Number, required: true }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
rateChartSchema.index({ owner: 1, isActive: 1 });

// Method to calculate rate based on FAT and SNF
rateChartSchema.methods.calculateRate = function (fat, snf) {
    if (this.calculationType === 'fixed') {
        return this.fixedRate;
    }

    // Check if there's a matching entry in custom chart
    if (this.entries && this.entries.length > 0) {
        const entry = this.entries.find(e =>
            Math.abs(e.fat - fat) < 0.05 && Math.abs(e.snf - snf) < 0.05
        );
        if (entry) return entry.rate;
    }

    // Formula-based calculation
    if (this.calculationType === 'fat_only') {
        const fatDiff = (fat - this.baseFat) * 10;
        return this.baseRate + (fatDiff * this.fatRate);
    }

    // fat_snf calculation
    const fatDiff = (fat - this.baseFat) * 10;
    const snfDiff = (snf - this.baseSnf) * 10;
    return this.baseRate + (fatDiff * this.fatRate) + (snfDiff * this.snfRate);
};

module.exports = mongoose.model('RateChart', rateChartSchema);
