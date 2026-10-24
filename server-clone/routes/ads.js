const express = require('express');
const router = express.Router();
const AdPopup = require('../models/AdPopup');

// GET /api/ads/active - Get single active ad popup (public)
// Returns the most recent active ad ordered by `order` asc (like banners)
router.get('/active', async (req, res) => {
    try {
        const ad = await AdPopup.findOne({ isActive: true })
            .sort({ order: 1, createdAt: -1 })
            .select('_id title subtitle image linkType linkValue order isActive')
            .lean();

        if (!ad) {
            return res.json({
                success: true,
                response: null
            });
        }

        res.json({
            success: true,
            response: ad
        });
    } catch (error) {
        console.error('Get active ad popup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get ad popup'
        });
    }
});

// GET /api/ads - Get all active ad popups (public, optional)
router.get('/', async (req, res) => {
    try {
        const ads = await AdPopup.find({ isActive: true })
            .sort({ order: 1 })
            .select('_id title subtitle image linkType linkValue order')
            .lean();

        res.json({
            success: true,
            response: ads
        });
    } catch (error) {
        console.error('Get ads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get ads'
        });
    }
});

module.exports = router;
