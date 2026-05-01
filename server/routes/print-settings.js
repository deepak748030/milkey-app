const express = require('express');
const router = express.Router();
const PrintSettings = require('../models/PrintSettings');
const auth = require('../middleware/auth');

// GET /api/print-settings - Get print settings for current user
router.get('/', auth, async (req, res) => {
    try {
        let settings = await PrintSettings.findOne({ owner: req.userId }).lean();
        if (!settings) {
            // Return defaults
            settings = {
                dairyName: '',
                ownerName: req.user?.name || '',
                mobileNumber: req.user?.phone || '',
                address: req.user?.address || '',
                showMobileOnReceipt: true,
                extraInfo: '',
                digitalSlipName: ''
            };
        }
        res.json({ success: true, response: settings });
    } catch (error) {
        console.error('Get print settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get print settings' });
    }
});

// PUT /api/print-settings - Update print settings
router.put('/', auth, async (req, res) => {
    try {
        const { dairyName, ownerName, mobileNumber, address, showMobileOnReceipt, extraInfo, digitalSlipName } = req.body;

        const settings = await PrintSettings.findOneAndUpdate(
            { owner: req.userId },
            {
                owner: req.userId,
                dairyName: dairyName || '',
                ownerName: ownerName || '',
                mobileNumber: mobileNumber || '',
                address: address || '',
                showMobileOnReceipt: showMobileOnReceipt !== undefined ? showMobileOnReceipt : true,
                extraInfo: extraInfo || '',
                digitalSlipName: digitalSlipName || ''
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ success: true, response: settings });
    } catch (error) {
        console.error('Update print settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update print settings' });
    }
});

module.exports = router;
