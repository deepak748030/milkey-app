const express = require('express');
const router = express.Router();
const VideoTutorial = require('../models/VideoTutorial');
const adminAuth = require('../middleware/admin');
router.get('/', async (req, res) => {
  try { const vids = await VideoTutorial.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean(); res.json({ success: true, response: vids }); } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
router.get('/admin/all', adminAuth, async (req, res) => {
  try { const vids = await VideoTutorial.find().sort({ order: 1, createdAt: -1 }).lean(); res.json({ success: true, response: vids }); } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
router.post('/', adminAuth, async (req, res) => {
  try { const { title, description, youtubeUrl, thumbnail, category, order } = req.body; if (!title || !youtubeUrl) return res.status(400).json({ success: false, message: 'Title and youtubeUrl required' }); const vid = await VideoTutorial.create({ title: title.trim(), description: description || '', youtubeUrl: youtubeUrl.trim(), thumbnail: thumbnail || '', category: category || 'general', order: order || 0, createdBy: req.adminId }); res.status(201).json({ success: true, response: vid }); } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
router.put('/:id', adminAuth, async (req, res) => {
  try { const vid = await VideoTutorial.findByIdAndUpdate(req.params.id, req.body, { new: true }); if (!vid) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, response: vid }); } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
router.delete('/:id', adminAuth, async (req, res) => { try { await VideoTutorial.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Deleted' }); } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); } });
module.exports = router;
