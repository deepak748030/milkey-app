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

// ==================== SELLING MODULE ROUTES ====================

const Member = require('../models/Member');
const SellingEntry = require('../models/SellingEntry');
const MemberPayment = require('../models/MemberPayment');

// ==================== SELLING MEMBERS ====================

// GET /api/admin/selling-members - Get all selling members with pagination
router.get('/selling-members', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const userId = req.query.userId || '';

        const query = { isActive: true };

        if (userId) {
            query.owner = userId;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const [total, members] = await Promise.all([
            Member.countDocuments(query),
            Member.find(query)
                .populate('owner', 'name email phone')
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        res.json({
            success: true,
            response: {
                data: members,
                count: members.length,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get selling members error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch members'
        });
    }
});

// GET /api/admin/selling-members/list - Get all members for dropdown
router.get('/selling-members/list', adminAuth, async (req, res) => {
    try {
        const userId = req.query.userId || '';
        const query = { isActive: true };

        if (userId) {
            query.owner = userId;
        }

        const members = await Member.find(query)
            .select('_id name mobile ratePerLiter owner')
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            response: members
        });
    } catch (error) {
        console.error('Get members list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch members list'
        });
    }
});

// GET /api/admin/selling-members/:id
router.get('/selling-members/:id', adminAuth, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id)
            .populate('owner', 'name email phone')
            .lean();

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            response: member
        });
    } catch (error) {
        console.error('Get member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch member'
        });
    }
});

// PUT /api/admin/selling-members/:id
router.put('/selling-members/:id', adminAuth, async (req, res) => {
    try {
        const { name, mobile, address, ratePerLiter } = req.body;
        const updates = {};

        if (name) updates.name = String(name).trim();
        if (mobile) updates.mobile = String(mobile).trim();
        if (address !== undefined) updates.address = address?.trim() || '';
        if (ratePerLiter !== undefined) updates.ratePerLiter = parseFloat(ratePerLiter) || 50;

        const member = await Member.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        ).populate('owner', 'name email phone');

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            message: 'Member updated successfully',
            response: member
        });
    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update member'
        });
    }
});

// DELETE /api/admin/selling-members/:id
router.delete('/selling-members/:id', adminAuth, async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            message: 'Member deleted successfully'
        });
    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete member'
        });
    }
});

// ==================== SELLING ENTRIES ====================

// GET /api/admin/selling-entries - Get all selling entries with filters
router.get('/selling-entries', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const memberId = req.query.memberId || '';
        const userId = req.query.userId || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const isPaid = req.query.isPaid || 'all';

        const query = {};

        if (memberId) {
            query.member = memberId;
        }

        if (userId) {
            query.owner = userId;
        }

        if (isPaid !== 'all') {
            query.isPaid = isPaid === 'true';
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const [total, entries, totals] = await Promise.all([
            SellingEntry.countDocuments(query),
            SellingEntry.find(query)
                .populate('member', 'name mobile ratePerLiter')
                .populate('owner', 'name email phone')
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SellingEntry.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalMorning: { $sum: '$morningQuantity' },
                        totalEvening: { $sum: '$eveningQuantity' },
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            response: {
                data: entries,
                totals: {
                    morningQuantity: totals[0]?.totalMorning || 0,
                    eveningQuantity: totals[0]?.totalEvening || 0,
                    totalQuantity: (totals[0]?.totalMorning || 0) + (totals[0]?.totalEvening || 0),
                    amount: totals[0]?.totalAmount || 0
                },
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get selling entries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch entries'
        });
    }
});

// GET /api/admin/selling-entries/:id
router.get('/selling-entries/:id', adminAuth, async (req, res) => {
    try {
        const entry = await SellingEntry.findById(req.params.id)
            .populate('member', 'name mobile ratePerLiter')
            .populate('owner', 'name email phone')
            .lean();

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Entry not found'
            });
        }

        res.json({
            success: true,
            response: entry
        });
    } catch (error) {
        console.error('Get entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch entry'
        });
    }
});

// PUT /api/admin/selling-entries/:id
router.put('/selling-entries/:id', adminAuth, async (req, res) => {
    try {
        const { morningQuantity, eveningQuantity, rate, notes, isPaid } = req.body;

        const entry = await SellingEntry.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Entry not found'
            });
        }

        const oldAmount = entry.amount;
        const oldQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);

        if (morningQuantity !== undefined) entry.morningQuantity = parseFloat(morningQuantity) || 0;
        if (eveningQuantity !== undefined) entry.eveningQuantity = parseFloat(eveningQuantity) || 0;
        if (rate !== undefined) entry.rate = parseFloat(rate) || 0;
        if (notes !== undefined) entry.notes = notes?.trim() || '';
        if (isPaid !== undefined) entry.isPaid = isPaid;

        await entry.save();

        const newAmount = entry.amount;
        const newQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);

        // Update member totals
        const amountDiff = newAmount - oldAmount;
        const qtyDiff = newQty - oldQty;
        if (entry.member && (amountDiff !== 0 || qtyDiff !== 0)) {
            await Member.findByIdAndUpdate(entry.member, {
                $inc: {
                    totalLiters: qtyDiff,
                    totalAmount: amountDiff,
                    pendingAmount: amountDiff
                }
            });
        }

        const updatedEntry = await SellingEntry.findById(entry._id)
            .populate('member', 'name mobile ratePerLiter')
            .populate('owner', 'name email phone')
            .lean();

        res.json({
            success: true,
            message: 'Entry updated successfully',
            response: updatedEntry
        });
    } catch (error) {
        console.error('Update entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update entry'
        });
    }
});

// DELETE /api/admin/selling-entries/:id
router.delete('/selling-entries/:id', adminAuth, async (req, res) => {
    try {
        const entry = await SellingEntry.findById(req.params.id);

        if (!entry) {
            return res.status(404).json({
                success: false,
                message: 'Entry not found'
            });
        }

        // Reverse member totals
        const totalQty = Number(entry.morningQuantity || 0) + Number(entry.eveningQuantity || 0);
        if (entry.member) {
            await Member.findByIdAndUpdate(entry.member, {
                $inc: {
                    totalLiters: -totalQty,
                    totalAmount: -entry.amount,
                    pendingAmount: -entry.amount
                }
            });
        }

        await SellingEntry.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Entry deleted successfully'
        });
    } catch (error) {
        console.error('Delete entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete entry'
        });
    }
});

// ==================== MEMBER PAYMENTS ====================

// GET /api/admin/member-payments - Get all member payments with filters
router.get('/member-payments', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const memberId = req.query.memberId || '';
        const userId = req.query.userId || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        const query = {};

        if (memberId) {
            query.member = memberId;
        }

        if (userId) {
            query.owner = userId;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const [total, payments, totals] = await Promise.all([
            MemberPayment.countDocuments(query),
            MemberPayment.find(query)
                .populate('member', 'name mobile')
                .populate('owner', 'name email phone')
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MemberPayment.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' },
                        totalSellAmount: { $sum: '$totalSellAmount' },
                        totalQuantity: { $sum: '$totalQuantity' }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            response: {
                data: payments,
                totals: {
                    amount: totals[0]?.totalAmount || 0,
                    sellAmount: totals[0]?.totalSellAmount || 0,
                    quantity: totals[0]?.totalQuantity || 0
                },
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get member payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments'
        });
    }
});

// GET /api/admin/member-payments/:id
router.get('/member-payments/:id', adminAuth, async (req, res) => {
    try {
        const payment = await MemberPayment.findById(req.params.id)
            .populate('member', 'name mobile')
            .populate('owner', 'name email phone')
            .populate('settledEntries')
            .lean();

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        res.json({
            success: true,
            response: payment
        });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment'
        });
    }
});

// DELETE /api/admin/member-payments/:id - Delete payment and reverse entries
router.delete('/member-payments/:id', adminAuth, async (req, res) => {
    try {
        const payment = await MemberPayment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Reverse the settled entries to unpaid
        if (payment.settledEntries && payment.settledEntries.length > 0) {
            await SellingEntry.updateMany(
                { _id: { $in: payment.settledEntries } },
                { isPaid: false }
            );
        }

        // Reverse the member's balance
        if (payment.member) {
            const balanceAdjustment = payment.amount - payment.totalSellAmount;
            await Member.findByIdAndUpdate(payment.member, {
                $inc: { sellingPaymentBalance: balanceAdjustment }
            });
        }

        await MemberPayment.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Payment deleted and entries restored'
        });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete payment'
        });
    }
});

// ==================== SELLING BALANCE REPORT ====================

// GET /api/admin/selling-report - Get balance report for all members
router.get('/selling-report', adminAuth, async (req, res) => {
    try {
        const userId = req.query.userId || '';

        const memberQuery = { isActive: true };
        if (userId) {
            memberQuery.owner = userId;
        }

        const members = await Member.find(memberQuery)
            .populate('owner', 'name email phone')
            .sort({ name: 1 })
            .lean();

        // Get all unpaid selling entries grouped by member
        const entryQuery = { isPaid: false };
        if (userId) {
            entryQuery.owner = userId;
        }

        const unpaidEntriesAggregation = await SellingEntry.aggregate([
            { $match: entryQuery },
            {
                $group: {
                    _id: '$member',
                    unpaidAmount: { $sum: '$amount' },
                    unpaidQuantity: { $sum: { $add: ['$morningQuantity', '$eveningQuantity'] } },
                    unpaidEntriesCount: { $sum: 1 }
                }
            }
        ]);

        const unpaidByMember = new Map(
            unpaidEntriesAggregation.map(item => [String(item._id), item])
        );

        // Get last payment date for each member
        const paymentQuery = {};
        if (userId) {
            paymentQuery.owner = userId;
        }

        const lastPaymentsAggregation = await MemberPayment.aggregate([
            { $match: paymentQuery },
            { $sort: { date: -1 } },
            {
                $group: {
                    _id: '$member',
                    lastPaymentDate: { $first: '$date' },
                    lastPeriodEnd: { $first: '$periodEnd' }
                }
            }
        ]);

        const lastPaymentByMember = new Map(
            lastPaymentsAggregation.map(item => [String(item._id), item])
        );

        const reportData = members.map(member => {
            const memberIdStr = String(member._id);
            const unpaidData = unpaidByMember.get(memberIdStr) || {
                unpaidAmount: 0,
                unpaidQuantity: 0,
                unpaidEntriesCount: 0
            };
            const lastPayment = lastPaymentByMember.get(memberIdStr);

            const currentBalance = Number(member.sellingPaymentBalance || 0);
            const totalBalance = currentBalance + unpaidData.unpaidAmount;

            return {
                _id: member._id,
                name: member.name,
                mobile: member.mobile,
                ratePerLiter: member.ratePerLiter,
                owner: member.owner,
                currentBalance,
                unpaidAmount: unpaidData.unpaidAmount,
                totalBalance,
                unpaidEntriesCount: unpaidData.unpaidEntriesCount,
                unpaidQuantity: unpaidData.unpaidQuantity,
                date: new Date().toISOString().split('T')[0],
                lastPaymentDate: lastPayment?.lastPaymentDate || null,
                lastPeriodEnd: lastPayment?.lastPeriodEnd || null
            };
        });

        const totalPositiveBalance = reportData
            .filter(m => m.totalBalance > 0)
            .reduce((sum, m) => sum + m.totalBalance, 0);

        const totalNegativeBalance = reportData
            .filter(m => m.totalBalance < 0)
            .reduce((sum, m) => sum + Math.abs(m.totalBalance), 0);

        const netBalance = reportData.reduce((sum, m) => sum + m.totalBalance, 0);
        const totalUnpaidAmount = reportData.reduce((sum, m) => sum + m.unpaidAmount, 0);
        const totalUnpaidQuantity = reportData.reduce((sum, m) => sum + m.unpaidQuantity, 0);

        res.json({
            success: true,
            response: {
                data: reportData,
                summary: {
                    totalMembers: members.length,
                    totalReceivable: totalPositiveBalance,
                    totalPayable: totalNegativeBalance,
                    netBalance,
                    totalUnpaidAmount,
                    totalUnpaidQuantity
                }
            }
        });
    } catch (error) {
        console.error('Get selling report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report'
        });
    }
});

module.exports = router;