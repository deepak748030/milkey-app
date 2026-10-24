const mongoose = require('mongoose');
const videoTutorialSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  youtubeUrl: { type: String, required: true, trim: true },
  thumbnail: { type: String, default: '' },
  category: { type: String, default: 'general' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });
videoTutorialSchema.index({ isActive: 1, order: 1 });
module.exports = mongoose.model('VideoTutorial', videoTutorialSchema);
