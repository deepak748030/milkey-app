const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const auth = require('../middleware/auth');

function getClientIp(req){
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
  return req.ip || '';
}

// Register / heartbeat current device — called on app launch & login
router.post('/register', auth.forDeviceRegistration, async (req, res) => {
  try {
    const { deviceId, deviceName, platform, pushToken, modelName, osName, osVersion, appVersion, userAgent } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId required' });
    const headerDeviceId = String(req.headers['x-device-id'] || '').trim();
    if (!headerDeviceId || headerDeviceId !== String(deviceId)) {
      return res.status(400).json({ success: false, message: 'Device ID mismatch' });
    }
    const existing = await Device.findOne({ user: req.userId, deviceId: String(deviceId).slice(0, 120) }).select('isActive lastActive').lean();
    if (existing && !existing.isActive && (!Number.isFinite(req.authIssuedAtMs) || req.authIssuedAtMs <= new Date(existing.lastActive).getTime())) {
      return res.status(401).json({ success: false, code: 'DEVICE_LOGGED_OUT', message: 'This device has been logged out. Please login again.' });
    }

    const ip = getClientIp(req);
    const ua = userAgent || req.headers['user-agent'] || '';

    const update = {
      deviceName: deviceName || modelName || '',
      platform: platform || 'unknown',
      modelName: modelName || '',
      osName: osName || '',
      osVersion: osVersion || '',
      appVersion: appVersion || '',
      userAgent: ua || '',
      lastActive: new Date(),
      lastLoginAt: new Date(),
      isActive: true,
      ip,
    };
    if (typeof pushToken === 'string' && pushToken) update.pushToken = pushToken;

    const deviceQuery = { user: req.userId, deviceId: String(deviceId).slice(0, 120) };
    // Recheck atomically: a remote logout may have happened after the read above.
    if (existing) {
      deviceQuery.$or = [{ isActive: true }];
      if (Number.isFinite(req.authIssuedAtMs)) {
        deviceQuery.$or.push({ isActive: false, lastActive: { $lt: new Date(req.authIssuedAtMs) } });
      }
    }
    const dev = await Device.findOneAndUpdate(
      deviceQuery,
      { $set: update, $setOnInsert: { firstSeenAt: new Date() } },
      { upsert: !existing, new: true, setDefaultsOnInsert: true }
    );
    if (!dev) return res.status(401).json({ success: false, code: 'DEVICE_LOGGED_OUT', message: 'This device has been logged out. Please login again.' });

    // Enforce max 3 active devices — oldest deactivates (keep most-recent 3)
    const active = await Device.find({ user: req.userId, isActive: true }).sort({ lastActive: -1 }).select('_id');
    if (active.length > 3) {
      const toDeactivate = active.slice(3).map(d => d._id);
      await Device.updateMany({ _id: { $in: toDeactivate } }, { isActive: false, lastActive: new Date() });
    }

    res.json({ success: true, response: dev });
  } catch (e) {
    console.error('[devices/register] error', e);
    res.status(500).json({ success: false, message: 'Failed to register device' });
  }
});

// List all devices for current user — newest first
router.get('/', auth, async (req, res) => {
  try {
    const list = await Device.find({ user: req.userId }).sort({ lastActive: -1 }).lean();
    // Attach isCurrent flag if caller passes currentDeviceId as query
    const currentDeviceId = (req.query.currentDeviceId || req.headers['x-device-id'] || '').toString();
    const enriched = currentDeviceId
      ? list.map(d => ({ ...d, isCurrent: String(d.deviceId) === currentDeviceId }))
      : list;
    res.json({ success: true, response: enriched });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load devices' });
  }
});

// Get current device meta (for header sync checks)
router.get('/current', auth, async (req, res) => {
  try {
    const deviceId = (req.query.deviceId || req.headers['x-device-id'] || '').toString();
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId required' });
    const d = await Device.findOne({ user: req.userId, deviceId }).lean();
    res.json({ success: true, response: d || null });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Deactivate single device (logout that device)
router.delete('/:id', auth, async (req, res) => {
  try {
    const d = await Device.findOne({ _id: req.params.id, user: req.userId });
    if (!d) return res.status(404).json({ success: false, message: 'Device not found' });
    d.isActive = false;
    d.lastActive = new Date();
    await d.save();
    res.json({ success: true, message: 'Device logged out' });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});

// Logout all other devices except current
router.post('/logout-others', auth, async (req, res) => {
  try {
    let currentDeviceId = (req.body && req.body.currentDeviceId) || req.headers['x-device-id'] || '';
    currentDeviceId = String(currentDeviceId).trim();
    if (!currentDeviceId) {
      // Fallback: keep most-recent active, deactivate rest
      const active = await Device.find({ user: req.userId, isActive: true }).sort({ lastActive: -1 });
      if (active.length <= 1) return res.json({ success: true, message: 'No other devices' });
      const keepId = active[0]._id;
      await Device.updateMany({ user: req.userId, _id: { $ne: keepId }, isActive: true }, { isActive: false, lastActive: new Date() });
      return res.json({ success: true, message: 'Other devices logged out' });
    }
    await Device.updateMany({ user: req.userId, deviceId: { $ne: currentDeviceId } }, { isActive: false, lastActive: new Date() });
    res.json({ success: true, message: 'Other devices logged out' });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});

// Logout current device by deviceId (used on app logout)
router.post('/logout-current', auth, async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || req.headers['x-device-id'] || '').trim();
    if (!deviceId) return res.json({ success: true, message: 'No deviceId' });
    await Device.updateOne({ user: req.userId, deviceId }, { isActive: false, lastActive: new Date() });
    res.json({ success: true, message: 'Current device logged out' });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Optional: heartbeat ping (lightweight touch)
router.post('/ping', auth, async (req, res) => {
  try {
    const deviceId = (req.body && req.body.deviceId) || req.headers['x-device-id'] || '';
    if (!deviceId) return res.json({ success: true });
    await Device.updateOne({ user: req.userId, deviceId: String(deviceId) }, { lastActive: new Date(), isActive: true });
    res.json({ success: true });
  } catch { res.json({ success: true }); }
});

module.exports = router;
