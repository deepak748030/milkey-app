const express = require('express');
const router = express.Router();
const CustomForm = require('../models/CustomForm');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Helper function to verify admin token
const verifyAdminToken = async (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, status: 401, message: 'Access denied. No token provided.' };
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return { success: false, status: 401, message: 'Invalid token.' };
    }

    const adminId = decoded.adminId || decoded.userId;
    const admin = await Admin.findById(adminId).lean();

    if (!admin) {
        return { success: false, status: 403, message: 'Access denied. Admin only.' };
    }

    return { success: true, admin };
};

// Get all forms for current user
router.get('/', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const forms = await CustomForm.find({ user: req.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const count = await CustomForm.countDocuments({ user: req.userId });

        res.json({
            success: true,
            response: {
                data: forms,
                count,
                hasMore: skip + forms.length < count
            }
        });
    } catch (error) {
        console.error('Get forms error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch forms'
        });
    }
});

// Get all forms for admin
router.get('/admin', async (req, res) => {
    try {
        const authResult = await verifyAdminToken(req);
        if (!authResult.success) {
            return res.status(authResult.status).json({
                success: false,
                message: authResult.message
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status;

        const query = {};
        if (status) query.status = status;

        const forms = await CustomForm.find(query)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const count = await CustomForm.countDocuments(query);

        res.json({
            success: true,
            response: {
                data: forms,
                count,
                hasMore: skip + forms.length < count
            }
        });
    } catch (error) {
        console.error('Get admin forms error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch forms'
        });
    }
});

// Create new form
router.post('/', auth, async (req, res) => {
    try {
        const { formName, fields } = req.body;

        if (!formName || !fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Form name and at least one field are required'
            });
        }

        const form = new CustomForm({
            user: req.userId,
            formName: formName.trim(),
            fields: fields.map(f => ({
                label: f.label?.trim() || '',
                value: f.value?.trim() || ''
            })).filter(f => f.label)
        });

        await form.save();

        res.status(201).json({
            success: true,
            message: 'Form submitted successfully',
            response: form
        });
    } catch (error) {
        console.error('Create form error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit form'
        });
    }
});

// Update form status (admin only)
router.put('/:id/status', async (req, res) => {
    try {
        const authResult = await verifyAdminToken(req);
        if (!authResult.success) {
            return res.status(authResult.status).json({
                success: false,
                message: authResult.message
            });
        }

        const { status, adminNotes } = req.body;

        const form = await CustomForm.findByIdAndUpdate(
            req.params.id,
            { status, adminNotes },
            { new: true }
        ).populate('user', 'name email phone');

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found'
            });
        }

        res.json({
            success: true,
            message: 'Form updated successfully',
            response: form
        });
    } catch (error) {
        console.error('Update form status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update form'
        });
    }
});

// Delete form (user)
router.delete('/:id', auth, async (req, res) => {
    try {
        const form = await CustomForm.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found'
            });
        }

        await CustomForm.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Form deleted successfully'
        });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete form'
        });
    }
});

// Delete form (admin)
router.delete('/admin/:id', async (req, res) => {
    try {
        const authResult = await verifyAdminToken(req);
        if (!authResult.success) {
            return res.status(authResult.status).json({
                success: false,
                message: authResult.message
            });
        }

        const form = await CustomForm.findById(req.params.id);

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found'
            });
        }

        await CustomForm.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Form deleted successfully'
        });
    } catch (error) {
        console.error('Admin delete form error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete form'
        });
    }
});

module.exports = router;
