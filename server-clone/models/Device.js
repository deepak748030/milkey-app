const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId: { type: String, required: true },
  deviceName: { type: String, default: '' },
  platform: { type: String, enum: ['android','ios','web','unknown'], default: 'unknown' },
  // Extra metadata for richer session view
  modelName: { type: String, default: '' },
  osName: { type: String, default: '' },
  osVersion: { type: String, default: '' },
  appVersion: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  pushToken: { type: String, default: '' },
  lastActive: { type: Date, default: Date.now },
  firstSeenAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  ip: { type: String, default: '' },
  // Last known location hint derived from ip if available (optional)
  lastLoginAt: { type: Date, default: Date.now },
}, { timestamps: true });

deviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ user: 1, isActive: 1, lastActive: -1 });
deviceSchema.index({ lastActive: -1 });

module.exports = mongoose.model('Device', deviceSchema);
