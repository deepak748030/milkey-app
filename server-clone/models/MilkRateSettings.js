const mongoose = require('mongoose');

const milkRateSettingsSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  // FAT + SNF Rate (rate chart) - rate per litre for given FAT/SNF table
  fatSnfRate: {
    buffalo: { type: Number, default: 0 },
    cow: { type: Number, default: 0 },
    baseLabel: { type: String, default: '65/90' }, // e.g. 6.5/9.0 shown as 65/90 in UI
    moreOptions: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  // Fixed Rate (₹/litre)
  fixedRate: {
    buffalo: { type: Number, default: 0 },
    cow: { type: Number, default: 0 },
  },
  // FAT Rate (per point)
  fatRate: {
    buffalo: { type: Number, default: 0 },
    cow: { type: Number, default: 0 },
  },
  // CLR & Pro Rata
  clrProRata: {
    clrToSnf: { type: Number, default: 0 },
    proRataEnabled: { type: Boolean, default: false },
    proRata: {
      col1: { type: Number, default: 0 },
      col2: { type: Number, default: 0 },
      col3: { type: Number, default: 0 },
    },
  },
  // Bonus
  bonus: {
    type: { type: String, enum: ['perLitre', 'percent'], default: 'perLitre' },
    perLitre: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('MilkRateSettings', milkRateSettingsSchema);
