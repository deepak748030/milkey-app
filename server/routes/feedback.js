const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');
const { notifyFeedbackResponse } = require('../lib/pushNotifications');

// Get user's feedback submissions
router.get('/my', auth, async (req, res) => {
    try {
        const feedbacks = await Feedback.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({ success: true, response: { data: feedbacks } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all feedback (admin only)
router.get('/', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { status, type, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status) query.status = status;
        if (type) query.type = type;

        const feedbacks = await Feedback.find(query)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Feedback.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: feedbacks,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get feedback stats (admin only)
router.get('/stats', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const [total, pending, inReview, resolved] = await Promise.all([
            Feedback.countDocuments(),
            Feedback.countDocuments({ status: 'pending' }),
            Feedback.countDocuments({ status: 'in_review' }),
            Feedback.countDocuments({ status: 'resolved' })
        ]);

        const byType = await Feedback.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            response: {
                total,
                pending,
                inReview,
                resolved,
                byType: byType.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Submit feedback
router.post('/', auth, async (req, res) => {
    try {
        const { type, subject, message, priority } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ success: false, message: 'Subject and message are required' });
        }

        const feedback = await Feedback.create({
            user: req.user._id,
            type: type || 'feedback',
            subject,
            message,
            priority: priority || 'medium'
        });

        res.status(201).json({ success: true, response: feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update feedback status (admin only)
router.put('/:id/status', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { status, adminResponse } = req.body;

        const updateData = { status };
        if (adminResponse) {
            updateData.adminResponse = adminResponse;
            updateData.respondedAt = new Date();
            updateData.respondedBy = req.user._id;
        }

        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).populate('user', 'name email');

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        // Send push notification to user about feedback update
        if (feedback.user && feedback.user._id) {
            notifyFeedbackResponse(
                feedback.user._id.toString(),
                feedback._id.toString(),
                status,
                adminResponse
            ).catch(err => console.error('Error sending feedback notification:', err));
        }

        res.json({ success: true, response: feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single feedback
router.get('/:id', auth, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('respondedBy', 'name');

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        // Check if user owns the feedback or is admin
        if (feedback.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, response: feedback });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete feedback (admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const feedback = await Feedback.findByIdAndDelete(req.params.id);

        if (!feedback) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }

        res.json({ success: true, message: 'Feedback deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
