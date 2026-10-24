const express = require('express');
const router = express.Router();
const Faq = require('../models/Faq');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/admin');

// Public - app fetches
router.get('/', async (req, res) => {
  try {
    const faqs = await Faq.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ success: true, response: faqs });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to fetch FAQs' }); }
});
// Admin - all including inactive
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json({ success: true, response: faqs });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
router.post('/', adminAuth, async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, message: 'Question and answer required' });
    const faq = await Faq.create({ question: question.trim(), answer: answer.trim(), category: category || 'general', order: order || 0, createdBy: req.adminId });
    res.status(201).json({ success: true, response: faq });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to create' }); }
});
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!faq) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, response: faq });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
router.delete('/:id', adminAuth, async (req, res) => {
  try { await Faq.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Deleted' }); } catch (e) { res.status(500).json({ success: false, message: 'Failed' }); }
});
module.exports = router;
