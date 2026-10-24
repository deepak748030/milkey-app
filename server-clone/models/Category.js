const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, trim: true, lowercase: true },
  icon: { type: String, default: '' },
  color: { type: String, default: '#22C55E' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
categorySchema.index({ owner: 1, name: 1 }, { unique: true, sparse: true });
categorySchema.index({ slug: 1 });
module.exports = mongoose.model('Category', categorySchema);
