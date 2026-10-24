const mongoose = require('mongoose');
const farmerSchema = new mongoose.Schema({
    code: { type: String, required: [true, 'Code is required'], trim: true },
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: [100, 'Name cannot exceed 100 characters'] },
    mobile: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['farmer', 'member', 'unified'], default: 'unified' },
    totalPurchase: { type: Number, default: 0 },
    totalLiters: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    cowEnabled: { type: Boolean, default: true },
    buffaloEnabled: { type: Boolean, default: true },
    defaultMilk: { type: String, enum: ['cow', 'buffalo'], default: 'buffalo' },
    priceBasis: { type: String, enum: ['rate', 'fat', 'fat_snf'], default: 'rate' },
    cowRate: { type: Number, default: 0 },
    buffaloRate: { type: Number, default: 0 },
    cowFat: { type: Number, default: 0 },
    buffaloFat: { type: Number, default: 0 },
    cowSnf: { type: Number, default: 0 },
    buffaloSnf: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    lastPurchaseDate: { type: Date, default: null },
    alertMethod: { type: String, enum: ['sms', 'whatsapp', 'email', 'none'], default: 'none' },
    printEntrySlip: { type: String, enum: ['default', 'yes', 'no'], default: 'default' },
    showRateChart: { type: Boolean, default: false },
    showRateSetting: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
// Sync Rate Setting alias — keep both fields in sync for backward compat
farmerSchema.pre('save', function(next) {
  if (this.isModified('showRateSetting')) this.showRateChart = this.showRateSetting;
  else if (this.isModified('showRateChart')) this.showRateSetting = this.showRateChart;
  next();
});
farmerSchema.pre('findOneAndUpdate', function(next) {
  const upd = this.getUpdate();
  if (!upd) return next();
  const set = upd.$set || upd;
  if (set.showRateSetting !== undefined) set.showRateChart = set.showRateSetting;
  else if (set.showRateChart !== undefined) set.showRateSetting = set.showRateChart;
  next();
});
farmerSchema.index({ code: 1, owner: 1 }, { unique: true });
farmerSchema.index({ owner: 1 });
farmerSchema.index({ owner: 1, isActive: 1 });
module.exports = mongoose.model('Farmer', farmerSchema);
