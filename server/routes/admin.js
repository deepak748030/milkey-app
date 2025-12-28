const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const User = require('../models/User');

// Simple password hashing
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Generate JWT token
const generateToken = (adminId) => {
    return jwt.sign(
        { adminId, type: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Admin auth middleware
const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin token.'
            });
        }

        const admin = await Admin.findById(decoded.adminId).select('-password').lean();
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Admin not found.'
            });
        }

        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated.'
            });
        }

        req.admin = admin;
        req.adminId = admin._id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

// POST /api/admin/setup - First time admin creation
router.post('/setup', async (req, res) => {
    try {
        // Check if any admin exists
        const adminCount = await Admin.countDocuments();
        if (adminCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Admin already exists. Please login.'
            });
        }

        // Create default admin
        const admin = new Admin({
            name: 'Super Admin',
            email: 'admin@milkey.com',
            password: hashPassword('Admin@123'),
            role: 'superadmin',
            isActive: true
        });

        await admin.save();

        res.status(201).json({
            success: true,
            message: 'Default admin created successfully',
            response: {
                email: admin.email,
                name: admin.name
            }
        });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create admin'
        });
    }
});

// POST /api/admin/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        const hashedPassword = hashPassword(password);
        if (admin.password !== hashedPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        const token = generateToken(admin._id);

        res.json({
            success: true,
            message: 'Login successful',
            response: {
                token,
                admin: {
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    avatar: admin.avatar,
                    role: admin.role
                }
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// GET /api/admin/me
router.get('/me', adminAuth, async (req, res) => {
    try {
        res.json({
            success: true,
            response: {
                _id: req.admin._id,
                name: req.admin.name,
                email: req.admin.email,
                avatar: req.admin.avatar,
                role: req.admin.role
            }
        });
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile'
        });
    }
});

// GET /api/admin/users - Get users with server-side pagination, search, filter
router.get('/users', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const status = req.query.status || 'all';

        // Build query with indexed fields for O(log n) performance
        const query = {};

        // Status filter
        if (status === 'active') {
            query.isBlocked = false;
        } else if (status === 'blocked') {
            query.isBlocked = true;
        }

        // Search filter - uses regex but can be optimized with text index
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute count and find in parallel for better performance
        const [total, users] = await Promise.all([
            User.countDocuments(query),
            User.find(query)
                .select('_id name email phone avatar isBlocked createdAt role address')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// GET /api/admin/users/:id - Get single user
router.get('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -otp')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            response: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user'
        });
    }
});

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const { name, email, phone, address, role } = req.body;
        const updates = {};

        if (name) updates.name = name.trim();
        if (email) updates.email = email.toLowerCase().trim();
        if (phone) updates.phone = phone.trim();
        if (address !== undefined) updates.address = address.trim();
        if (role && ['owner', 'staff', 'farmer'].includes(role)) {
            updates.role = role;
        }

        // Check for duplicate email/phone
        if (email || phone) {
            const existingUser = await User.findOne({
                _id: { $ne: req.params.id },
                $or: [
                    ...(email ? [{ email: email.toLowerCase() }] : []),
                    ...(phone ? [{ phone }] : [])
                ]
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: existingUser.email === email?.toLowerCase()
                        ? 'Email already in use'
                        : 'Phone number already in use'
                });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        ).select('-password -otp');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            response: user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user'
        });
    }
});

// PUT /api/admin/users/:id/block - Toggle user block status
router.put('/users/:id/block', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.json({
            success: true,
            message: user.isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
            response: {
                _id: user._id,
                isBlocked: user.isBlocked
            }
        });
    } catch (error) {
        console.error('Toggle block error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status'
        });
    }
});

// GET /api/admin/dashboard - Dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            blockedUsers,
            recentUsers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isBlocked: false }),
            User.countDocuments({ isBlocked: true }),
            User.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            })
        ]);

        res.json({
            success: true,
            response: {
                totalUsers,
                activeUsers,
                blockedUsers,
                recentUsers
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats'
        });
    }
});

module.exports = router;