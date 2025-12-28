const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Order = require('../models/Order');
const MilkCollection = require('../models/MilkCollection');
const PurchaseFarmer = require('../models/PurchaseFarmer');

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

// GET /api/admin/users/list - Get all users for dropdowns (minimal data)
router.get('/users/list', adminAuth, async (req, res) => {
    try {
        const users = await User.find({ isBlocked: false })
            .select('_id name email phone')
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            response: users
        });
    } catch (error) {
        console.error('Get users list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users list'
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
            recentUsers,
            totalOrders,
            pendingOrders,
            totalMilkCollections
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isBlocked: false }),
            User.countDocuments({ isBlocked: true }),
            User.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }),
            Order.countDocuments(),
            Order.countDocuments({ status: 'pending' }),
            MilkCollection.countDocuments()
        ]);

        res.json({
            success: true,
            response: {
                totalUsers,
                activeUsers,
                blockedUsers,
                recentUsers,
                totalOrders,
                pendingOrders,
                totalMilkCollections
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

// ==================== ORDERS ROUTES ====================

// GET /api/admin/orders - Get all orders with server-side pagination
router.get('/orders', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const status = req.query.status || 'all';
        const paymentStatus = req.query.paymentStatus || 'all';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        // Build query
        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (paymentStatus && paymentStatus !== 'all') {
            query.paymentStatus = paymentStatus;
        }

        // Date filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Search filter
        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { deliveryAddress: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute count and find in parallel
        const [total, orders] = await Promise.all([
            Order.countDocuments(query),
            Order.find(query)
                .populate('user', 'name email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                orders,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

// GET /api/admin/orders/:id
router.get('/orders/:id', adminAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone address')
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            response: order
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order'
        });
    }
});

// PUT /api/admin/orders/:id/status - Update order status
router.put('/orders/:id/status', adminAuth, async (req, res) => {
    try {
        const { status, paymentStatus } = req.body;
        const updates = {};

        if (status) {
            const validStatuses = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
            }
            updates.status = status;
        }

        if (paymentStatus) {
            const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
            if (!validPaymentStatuses.includes(paymentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment status'
                });
            }
            updates.paymentStatus = paymentStatus;
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        ).populate('user', 'name email phone');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            message: 'Order updated successfully',
            response: order
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order'
        });
    }
});

// DELETE /api/admin/orders/:id
router.delete('/orders/:id', adminAuth, async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            message: 'Order deleted successfully'
        });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete order'
        });
    }
});

// ==================== MILK COLLECTIONS (PURCHASE) ROUTES ====================

// GET /api/admin/milk-collections - Get all milk collections with filters
router.get('/milk-collections', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const shift = req.query.shift || 'all';
        const isPaid = req.query.isPaid || 'all';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const userId = req.query.userId || '';

        // Build query
        const query = {};

        if (shift && shift !== 'all') {
            query.shift = shift;
        }

        if (isPaid && isPaid !== 'all') {
            query.isPaid = isPaid === 'true';
        }

        if (userId) {
            query.owner = userId;
        }

        // Date filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        // Search filter - by farmer code
        if (search) {
            query.$or = [
                { farmerCode: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute count, find, and totals in parallel
        const [total, collections, totals] = await Promise.all([
            MilkCollection.countDocuments(query),
            MilkCollection.find(query)
                .populate('purchaseFarmer', 'code name mobile')
                .populate('owner', 'name email phone')
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MilkCollection.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: '$quantity' },
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ])
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                collections,
                totals: {
                    quantity: totals[0]?.totalQuantity || 0,
                    amount: totals[0]?.totalAmount || 0
                },
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get milk collections error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch milk collections'
        });
    }
});

// GET /api/admin/milk-collections/:id
router.get('/milk-collections/:id', adminAuth, async (req, res) => {
    try {
        const collection = await MilkCollection.findById(req.params.id)
            .populate('purchaseFarmer', 'code name mobile address')
            .populate('owner', 'name email phone')
            .lean();

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        res.json({
            success: true,
            response: collection
        });
    } catch (error) {
        console.error('Get milk collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch collection'
        });
    }
});

// PUT /api/admin/milk-collections/:id - Update milk collection
router.put('/milk-collections/:id', adminAuth, async (req, res) => {
    try {
        const { quantity, fat, snf, rate, isPaid, notes } = req.body;
        const updates = {};

        if (quantity !== undefined) updates.quantity = parseFloat(quantity);
        if (fat !== undefined) updates.fat = parseFloat(fat);
        if (snf !== undefined) updates.snf = parseFloat(snf);
        if (rate !== undefined) updates.rate = parseFloat(rate);
        if (isPaid !== undefined) updates.isPaid = isPaid;
        if (notes !== undefined) updates.notes = notes.trim();

        // Recalculate amount if quantity or rate changed
        const collection = await MilkCollection.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        const oldAmount = collection.amount;
        const oldQuantity = collection.quantity;

        Object.assign(collection, updates);
        collection.amount = collection.quantity * collection.rate;
        await collection.save();

        // Update purchase farmer totals
        const amountDiff = collection.amount - oldAmount;
        const qtyDiff = collection.quantity - oldQuantity;
        if (collection.purchaseFarmer && (amountDiff !== 0 || qtyDiff !== 0)) {
            await PurchaseFarmer.findByIdAndUpdate(collection.purchaseFarmer, {
                $inc: { totalAmount: amountDiff, totalQuantity: qtyDiff }
            });
        }

        const updatedCollection = await MilkCollection.findById(collection._id)
            .populate('purchaseFarmer', 'code name mobile')
            .populate('owner', 'name email phone')
            .lean();

        res.json({
            success: true,
            message: 'Collection updated successfully',
            response: updatedCollection
        });
    } catch (error) {
        console.error('Update milk collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update collection'
        });
    }
});

// DELETE /api/admin/milk-collections/:id
router.delete('/milk-collections/:id', adminAuth, async (req, res) => {
    try {
        const collection = await MilkCollection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Update purchase farmer totals
        if (collection.purchaseFarmer) {
            await PurchaseFarmer.findByIdAndUpdate(collection.purchaseFarmer, {
                $inc: {
                    totalQuantity: -collection.quantity,
                    totalAmount: -collection.amount
                }
            });
        }

        await MilkCollection.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Collection deleted successfully'
        });
    } catch (error) {
        console.error('Delete milk collection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete collection'
        });
    }
});

// GET /api/admin/users-list - Get all users for dropdown (simple list)
router.get('/users-list', adminAuth, async (req, res) => {
    try {
        const users = await User.find({ isBlocked: false })
            .select('_id name email phone')
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            response: users
        });
    } catch (error) {
        console.error('Get users list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users list'
        });
    }
});

module.exports = router;