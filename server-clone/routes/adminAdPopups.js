const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AdPopup = require('../models/AdPopup');
const { parsePaging } = require('../lib/pagination');

// Admin auth middleware (duplicate from admin.js for isolation)
const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'admin') return res.status(401).json({ success: false, message: 'Invalid admin token.' });
        const admin = await Admin.findById(decoded.adminId).select('-password').lean();
        if (!admin) return res.status(401).json({ success: false, message: 'Admin not found.' });
        if (!admin.isActive) return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
        req.admin = admin;
        req.adminId = admin._id;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

// GET /api/admin/ad-popups - list with pagination/search/status
router.get('/', adminAuth, async (req, res) => {
    try {
        const { page, limit, skip } = parsePaging(req.query, { page: 1, limit: 10, maxLimit: 50 });
        const search = req.query.search?.trim() || '';
        const status = req.query.status || 'all';
        const query = {};
        if (status === 'active') query.isActive = true;
        else if (status === 'inactive') query.isActive = false;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { subtitle: { $regex: search, $options: 'i' } },
            ];
        }
        const [total, adPopups] = await Promise.all([
            AdPopup.countDocuments(query),
            AdPopup.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit).lean()
        ]);
        const pages = Math.ceil(total / limit);
        res.json({ success: true, response: { adPopups, pagination: { page, limit, total, pages } } });
    } catch (error) {
        console.error('Get ad-popups error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ad popups' });
    }
});

// GET /api/admin/ad-popups/:id
router.get('/:id', adminAuth, async (req, res) => {
    try {
        const ad = await AdPopup.findById(req.params.id).lean();
        if (!ad) return res.status(404).json({ success: false, message: 'Ad popup not found' });
        res.json({ success: true, response: ad });
    } catch (error) {
        console.error('Get ad popup error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ad popup' });
    }
});

// POST /api/admin/ad-popups - create
router.post('/', adminAuth, async (req, res) => {
    try {
        const { title, subtitle, image, linkType, linkValue, order } = req.body;
        if (!image) return res.status(400).json({ success: false, message: 'Image is required' });
        const t = (title?.trim() || `Ad ${Date.now()}`);
        let adOrder = order;
        if (adOrder === undefined || adOrder === null) {
            const max = await AdPopup.findOne().sort({ order: -1 }).lean();
            adOrder = max ? max.order + 1 : 0;
        }
        const ad = await AdPopup.create({
            title: t,
            subtitle: subtitle?.trim() || '',
            image,
            linkType: linkType || 'none',
            linkValue: linkValue || '',
            order: parseInt(adOrder) || 0,
            isActive: true
        });
        res.status(201).json({ success: true, message: 'Ad popup created', response: ad });
    } catch (error) {
        console.error('Create ad popup error:', error);
        res.status(500).json({ success: false, message: 'Failed to create ad popup' });
    }
});

// PUT /api/admin/ad-popups/:id - update
router.put('/:id', adminAuth, async (req, res) => {
    try {
        const { title, subtitle, image, linkType, linkValue, order, isActive } = req.body;
        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (subtitle !== undefined) updates.subtitle = subtitle.trim();
        if (image) updates.image = image;
        if (linkType) updates.linkType = linkType;
        if (linkValue !== undefined) updates.linkValue = linkValue;
        if (order !== undefined) updates.order = parseInt(order);
        if (isActive !== undefined) updates.isActive = isActive;
        const ad = await AdPopup.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
        if (!ad) return res.status(404).json({ success: false, message: 'Ad popup not found' });
        res.json({ success: true, message: 'Ad popup updated', response: ad });
    } catch (error) {
        console.error('Update ad popup error:', error);
        res.status(500).json({ success: false, message: 'Failed to update ad popup' });
    }
});

// DELETE /api/admin/ad-popups/:id
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const ad = await AdPopup.findByIdAndDelete(req.params.id);
        if (!ad) return res.status(404).json({ success: false, message: 'Ad popup not found' });
        res.json({ success: true, message: 'Ad popup deleted' });
    } catch (error) {
        console.error('Delete ad popup error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete ad popup' });
    }
});

// PUT /api/admin/ad-popups/:id/toggle
router.put('/:id/toggle', adminAuth, async (req, res) => {
    try {
        const ad = await AdPopup.findById(req.params.id);
        if (!ad) return res.status(404).json({ success: false, message: 'Ad popup not found' });
        ad.isActive = !ad.isActive;
        await ad.save();
        res.json({ success: true, message: ad.isActive ? 'Ad popup activated' : 'Ad popup deactivated', response: ad });
    } catch (error) {
        console.error('Toggle ad popup error:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle ad popup' });
    }
});

module.exports = router;
