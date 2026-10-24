const mongoose = require('mongoose');
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true, trim: true },
  category: { type: String, default: 'general', trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });
faqSchema.index({ isActive: 1, order: 1 });
module.exports = mongoose.model('Faq', faqSchema);
