const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Order = require('../models/Order');
const MilkCollection = require('../models/MilkCollection');
const PurchaseFarmer = require('../models/PurchaseFarmer');
const Member = require('../models/Member');
const SellingEntry = require('../models/SellingEntry');
const Subscription = require('../models/Subscription');
const Farmer = require('../models/Farmer');
const Banner = require('../models/Banner');
const Product = require('../models/Product');
const { uploadToCloudinary } = require('../lib/cloudinary');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');
const MemberPayment = require('../models/MemberPayment');
const { notifyWithdrawalSuccess, notifyCommissionEarned, notifyOrderStatusUpdate, notifyPaymentReceived } = require('../lib/pushNotifications');

// Simple password hashing MemberPayment
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

// ==================== IMAGE UPLOAD ROUTE ====================

// POST /api/admin/upload - Upload image to Cloudinary
router.post('/upload', adminAuth, async (req, res) => {
    try {
        const { image, folder } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'Image data is required'
            });
        }

        // Validate image size (max ~10MB base64)
        if (image.length > 15 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: 'Image size too large. Maximum 10MB allowed.'
            });
        }

        console.log('Uploading image to Cloudinary, folder:', folder || 'milkey');

        const result = await uploadToCloudinary(image, folder || 'milkey');

        if (!result.success) {
            console.error('Cloudinary upload failed:', result.error);
            return res.status(500).json({
                success: false,
                message: result.error || 'Failed to upload image'
            });
        }

        console.log('Image uploaded successfully:', result.url);

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            response: {
                url: result.url,
                public_id: result.public_id
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image'
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
                .select('_id name email phone avatar isBlocked createdAt role address referralCode referralEarnings totalReferralEarnings')
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

// PUT /api/admin/users/:id/commission - Update user commission (withdraw)
router.put('/users/:id/commission', adminAuth, async (req, res) => {
    try {
        const { action, amount } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (action === 'withdraw') {
            // Withdraw from referral earnings
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid amount'
                });
            }

            if (amount > user.referralEarnings) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance'
                });
            }

            user.referralEarnings -= amount;
            await user.save();

            // Send push notification about successful withdrawal
            notifyWithdrawalSuccess(user._id.toString(), amount)
                .catch(err => console.error('Error sending withdrawal notification:', err));

            return res.json({
                success: true,
                message: `₹${amount} withdrawn successfully`,
                response: {
                    _id: user._id,
                    referralEarnings: user.referralEarnings,
                    totalReferralEarnings: user.totalReferralEarnings
                }
            });
        } else if (action === 'add') {
            // Add to referral earnings (manual credit)
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid amount'
                });
            }

            user.referralEarnings += amount;
            user.totalReferralEarnings += amount;
            await user.save();

            // Send push notification about commission added
            notifyCommissionEarned(user._id.toString(), amount, 'Admin')
                .catch(err => console.error('Error sending commission notification:', err));

            return res.json({
                success: true,
                message: `₹${amount} added successfully`,
                response: {
                    _id: user._id,
                    referralEarnings: user.referralEarnings,
                    totalReferralEarnings: user.totalReferralEarnings
                }
            });
        } else if (action === 'set') {
            // Set specific balance
            if (amount === undefined || amount < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid amount'
                });
            }

            user.referralEarnings = amount;
            await user.save();

            return res.json({
                success: true,
                message: `Balance set to ₹${amount}`,
                response: {
                    _id: user._id,
                    referralEarnings: user.referralEarnings,
                    totalReferralEarnings: user.totalReferralEarnings
                }
            });
        }

        return res.status(400).json({
            success: false,
            message: 'Invalid action. Use: withdraw, add, or set'
        });
    } catch (error) {
        console.error('Update commission error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update commission'
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

// GET /api/admin/dashboard - Comprehensive Dashboard analytics
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const filter = req.query.filter || 'monthly';

        // Calculate date ranges
        const now = new Date();
        let startDate;
        let previousStartDate;
        let previousEndDate;

        switch (filter) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                previousStartDate = new Date(startDate);
                previousStartDate.setDate(previousStartDate.getDate() - 1);
                previousEndDate = startDate;
                break;
            case 'weekly':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                previousEndDate = startDate;
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
                previousEndDate = startDate;
                break;
            case 'monthly':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                previousEndDate = startDate;
                break;
        }

        // Execute all queries in parallel for maximum performance
        const [
            // User stats
            totalUsers,
            activeUsers,
            blockedUsers,
            newUsers,
            previousNewUsers,
            // Farmer stats
            totalFarmers,
            activeFarmers,
            // Member stats
            totalMembers,
            activeMembers,
            // Subscription stats
            totalSubscriptions,
            activeSubscriptions,
            // Selling stats
            totalSellingEntries,
            paidSellingEntries,
            unpaidSellingEntries,
            // Purchase stats
            totalMilkCollections,
            paidMilkCollections,
            unpaidMilkCollections,
            // Banner stats
            totalBanners,
            activeBanners,
            // Product stats
            totalProducts,
            activeProducts,
            // Aggregations for amounts
            sellingStats,
            purchaseStats,
            // Monthly growth data (last 6 months)
            userGrowth,
            sellingGrowth,
            purchaseGrowth,
            // Subscription distribution
            subscriptionDistribution
        ] = await Promise.all([
            // User counts
            User.countDocuments(),
            User.countDocuments({ isBlocked: false }),
            User.countDocuments({ isBlocked: true }),
            User.countDocuments({ createdAt: { $gte: startDate } }),
            User.countDocuments({ createdAt: { $gte: previousStartDate, $lt: previousEndDate } }),
            // Farmer counts
            Farmer.countDocuments(),
            Farmer.countDocuments({ isActive: true }),
            // Member counts
            Member.countDocuments(),
            Member.countDocuments({ isActive: true }),
            // Subscription counts
            Subscription.countDocuments(),
            Subscription.countDocuments({ isActive: true }),
            // Selling Entry counts
            SellingEntry.countDocuments(),
            SellingEntry.countDocuments({ isPaid: true }),
            SellingEntry.countDocuments({ isPaid: false }),
            // Milk Collection counts
            MilkCollection.countDocuments(),
            MilkCollection.countDocuments({ isPaid: true }),
            MilkCollection.countDocuments({ isPaid: false }),
            // Banner counts
            Banner.countDocuments(),
            Banner.countDocuments({ isActive: true }),
            // Product counts
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            // Selling aggregation
            SellingEntry.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' },
                        totalQuantity: { $sum: { $add: ['$morningQuantity', '$eveningQuantity'] } },
                        paidAmount: { $sum: { $cond: ['$isPaid', '$amount', 0] } },
                        unpaidAmount: { $sum: { $cond: ['$isPaid', 0, '$amount'] } }
                    }
                }
            ]),
            // Purchase aggregation
            MilkCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' },
                        totalQuantity: { $sum: '$quantity' },
                        paidAmount: { $sum: { $cond: ['$isPaid', '$amount', 0] } },
                        unpaidAmount: { $sum: { $cond: ['$isPaid', 0, '$amount'] } }
                    }
                }
            ]),
            // User growth (last 6 months)
            User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
                    }
                },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            // Selling growth (last 6 months)
            SellingEntry.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
                    }
                },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        amount: { $sum: '$amount' },
                        quantity: { $sum: { $add: ['$morningQuantity', '$eveningQuantity'] } }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            // Purchase growth (last 6 months)
            MilkCollection.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
                    }
                },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        amount: { $sum: '$amount' },
                        quantity: { $sum: '$quantity' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            // Subscription tab distribution
            Subscription.aggregate([
                { $match: { isActive: true } },
                { $unwind: '$applicableTabs' },
                {
                    $group: {
                        _id: '$applicableTabs',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Process selling stats
        const sellingData = sellingStats[0] || { totalAmount: 0, totalQuantity: 0, paidAmount: 0, unpaidAmount: 0 };
        const purchaseData = purchaseStats[0] || { totalAmount: 0, totalQuantity: 0, paidAmount: 0, unpaidAmount: 0 };

        // Format monthly growth data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyGrowthData = [];

        for (let i = 5; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth() + 1;
            const monthName = monthNames[targetDate.getMonth()];

            const userEntry = userGrowth.find(u => u._id.year === year && u._id.month === month);
            const sellingEntry = sellingGrowth.find(s => s._id.year === year && s._id.month === month);
            const purchaseEntry = purchaseGrowth.find(p => p._id.year === year && p._id.month === month);

            monthlyGrowthData.push({
                name: monthName,
                users: userEntry?.count || 0,
                sellingAmount: sellingEntry?.amount || 0,
                purchaseAmount: purchaseEntry?.amount || 0,
                sellingQty: sellingEntry?.quantity || 0,
                purchaseQty: purchaseEntry?.quantity || 0
            });
        }

        // Subscription distribution for pie chart
        const subscriptionTabData = [
            { name: 'Purchase', value: subscriptionDistribution.find(s => s._id === 'purchase')?.count || 0, color: '#8b5cf6' },
            { name: 'Selling', value: subscriptionDistribution.find(s => s._id === 'selling')?.count || 0, color: '#3b82f6' },
            { name: 'Register', value: subscriptionDistribution.find(s => s._id === 'register')?.count || 0, color: '#22c55e' }
        ];

        // User status distribution for pie chart
        const userStatusData = [
            { name: 'Active', value: activeUsers, color: '#22c55e' },
            { name: 'Blocked', value: blockedUsers, color: '#ef4444' }
        ];

        // Selling payment status
        const sellingPaymentData = [
            { name: 'Paid', value: paidSellingEntries, color: '#22c55e' },
            { name: 'Unpaid', value: unpaidSellingEntries, color: '#f59e0b' }
        ];

        // Purchase payment status
        const purchasePaymentData = [
            { name: 'Paid', value: paidMilkCollections, color: '#22c55e' },
            { name: 'Unpaid', value: unpaidMilkCollections, color: '#f59e0b' }
        ];

        // Calculate user growth percentage
        const userGrowthPercent = previousNewUsers > 0
            ? Math.round(((newUsers - previousNewUsers) / previousNewUsers) * 100)
            : newUsers > 0 ? 100 : 0;

        res.json({
            success: true,
            response: {
                overview: {
                    totalUsers,
                    activeUsers,
                    blockedUsers,
                    totalFarmers,
                    activeFarmers,
                    totalMembers,
                    activeMembers,
                    totalSubscriptions,
                    activeSubscriptions,
                    totalSellingEntries,
                    paidSellingEntries,
                    unpaidSellingEntries,
                    totalMilkCollections,
                    paidMilkCollections,
                    unpaidMilkCollections,
                    totalBanners,
                    activeBanners,
                    totalProducts,
                    activeProducts
                },
                periodStats: {
                    newUsers,
                    userGrowthPercent,
                    filter
                },
                selling: {
                    totalAmount: sellingData.totalAmount,
                    totalQuantity: sellingData.totalQuantity,
                    paidAmount: sellingData.paidAmount,
                    unpaidAmount: sellingData.unpaidAmount
                },
                purchase: {
                    totalAmount: purchaseData.totalAmount,
                    totalQuantity: purchaseData.totalQuantity,
                    paidAmount: purchaseData.paidAmount,
                    unpaidAmount: purchaseData.unpaidAmount
                },
                charts: {
                    monthlyGrowth: monthlyGrowthData,
                    subscriptionDistribution: subscriptionTabData,
                    userStatusDistribution: userStatusData,
                    sellingPaymentDistribution: sellingPaymentData,
                    purchasePaymentDistribution: purchasePaymentData
                }
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

        // Send push notification for status update
        if (status && order.user && order.user._id) {
            console.log(`[Admin] Sending order status notification to user: ${order.user._id.toString()}, status: ${status}`);
            notifyOrderStatusUpdate(
                order.user._id.toString(),
                order._id.toString(),
                status,
                order.totalAmount
            ).then(result => {
                console.log(`[Admin] Order notification result:`, JSON.stringify(result));
            }).catch(err => console.error('[Admin] Error sending order status notification:', err));
        } else {
            console.log(`[Admin] Skipping notification - missing data: status=${status}, user=${order.user?._id}`);
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

        // Get all unpaid selling entries grouped by member with latest date (Till date)
        const entryQuery = { isPaid: false };
        if (userId) {
            entryQuery.owner = userId;
        }

        const unpaidEntriesAggregation = await SellingEntry.aggregate([
            { $match: entryQuery },
            { $sort: { date: -1 } },
            {
                $group: {
                    _id: '$member',
                    unpaidAmount: { $sum: '$amount' },
                    unpaidQuantity: { $sum: { $add: ['$morningQuantity', '$eveningQuantity'] } },
                    unpaidEntriesCount: { $sum: 1 },
                    tillDate: { $max: '$date' }  // Latest unpaid entry date
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
                unpaidEntriesCount: 0,
                tillDate: null
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
                createdAt: member.createdAt,
                lastPaymentDate: lastPayment?.lastPaymentDate || null,
                lastPeriodEnd: lastPayment?.lastPeriodEnd || null,
                tillDate: unpaidData.tillDate || null  // Till date from latest unpaid entry
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

// ==================== REGISTER FARMERS ROUTES ====================

// const Farmer = require('../models/Farmer');

// GET /api/admin/register-farmers - Get all register farmers with pagination, search, owner filter
router.get('/register-farmers', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const userId = req.query.userId || '';

        // Build query
        const query = { isActive: true, type: 'farmer' };

        // Owner filter
        if (userId) {
            query.owner = userId;
        }

        // Search filter
        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute count and find in parallel
        const [total, farmers] = await Promise.all([
            Farmer.countDocuments(query),
            Farmer.find(query)
                .populate('owner', 'name email phone')
                .sort({ code: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                data: farmers,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get register farmers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch farmers'
        });
    }
});

// GET /api/admin/register-farmers/:id - Get single farmer
router.get('/register-farmers/:id', adminAuth, async (req, res) => {
    try {
        const farmer = await Farmer.findOne({
            _id: req.params.id,
            type: 'farmer',
            isActive: true
        }).populate('owner', 'name email phone').lean();

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            response: farmer
        });
    } catch (error) {
        console.error('Get farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch farmer'
        });
    }
});

// PUT /api/admin/register-farmers/:id - Update farmer
router.put('/register-farmers/:id', adminAuth, async (req, res) => {
    try {
        const { name, mobile, address } = req.body;
        const updates = {};

        if (name) updates.name = name.trim();
        if (mobile) updates.mobile = mobile.trim();
        if (address !== undefined) updates.address = address.trim();

        const farmer = await Farmer.findOneAndUpdate(
            { _id: req.params.id, type: 'farmer', isActive: true },
            updates,
            { new: true }
        ).populate('owner', 'name email phone');

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Farmer updated successfully',
            response: farmer
        });
    } catch (error) {
        console.error('Update farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update farmer'
        });
    }
});

// DELETE /api/admin/register-farmers/:id - Soft delete farmer
router.delete('/register-farmers/:id', adminAuth, async (req, res) => {
    try {
        const farmer = await Farmer.findOneAndUpdate(
            { _id: req.params.id, type: 'farmer' },
            { isActive: false },
            { new: true }
        );

        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: 'Farmer not found'
            });
        }

        res.json({
            success: true,
            message: 'Farmer deleted successfully'
        });
    } catch (error) {
        console.error('Delete farmer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete farmer'
        });
    }
});

// ==================== REGISTER ADVANCES ROUTES ====================

// const Advance = require('../models/Advance');

// GET /api/admin/register-advances - Get all advances with pagination, search, owner filter
router.get('/register-advances', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const userId = req.query.userId || '';
        const status = req.query.status || 'all';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        // Build query
        const query = {};

        // Owner filter
        if (userId) {
            query.owner = userId;
        }

        // Status filter (pending = unpaid, settled = paid)
        if (status === 'pending') {
            query.status = 'pending';
        } else if (status === 'settled') {
            query.status = 'settled';
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

        // First get advances, then filter by farmer search if needed
        let farmerFilter = null;
        if (search) {
            const matchingFarmers = await Farmer.find({
                $or: [
                    { code: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } }
                ],
                isActive: true
            }).select('_id').lean();

            farmerFilter = matchingFarmers.map(f => f._id);
            query.farmer = { $in: farmerFilter };
        }

        // Execute count and find in parallel
        const [total, advances] = await Promise.all([
            Advance.countDocuments(query),
            Advance.find(query)
                .populate('farmer', 'code name mobile')
                .populate('owner', 'name email phone')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                data: advances,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get register advances error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advances'
        });
    }
});

// ==================== REGISTER PAYMENTS ROUTES ====================

// const Payment = require('../models/Payment');

// GET /api/admin/register-payments - Get all payments with pagination, search, owner filter
router.get('/register-payments', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const userId = req.query.userId || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        // Build query
        const query = {};

        // Owner filter
        if (userId) {
            query.owner = userId;
        }

        // Date filter (on createdAt)
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // First get payments, then filter by farmer search if needed
        if (search) {
            const matchingFarmers = await Farmer.find({
                $or: [
                    { code: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } }
                ],
                isActive: true
            }).select('_id').lean();

            query.farmer = { $in: matchingFarmers.map(f => f._id) };
        }

        // Execute count and find in parallel
        const [total, payments] = await Promise.all([
            Payment.countDocuments(query),
            Payment.find(query)
                .populate('farmer', 'code name mobile')
                .populate('owner', 'name email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                data: payments,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get register payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments'
        });
    }
});

// ==================== PRODUCT MANAGEMENT ROUTES ====================

// const Product = require('../models/Product');

// GET /api/admin/products - Get all products with filters
router.get('/products', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const status = req.query.status || 'all';
        const userId = req.query.userId || '';
        const unit = req.query.unit || 'all';

        const query = {};

        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        if (userId) {
            query.owner = userId;
        }

        if (unit && unit !== 'all') {
            query.unit = unit;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const [total, products] = await Promise.all([
            Product.countDocuments(query),
            Product.find(query)
                .populate('owner', 'name email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                products,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products'
        });
    }
});

// GET /api/admin/products/:id
router.get('/products/:id', adminAuth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('owner', 'name email phone')
            .lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            response: product
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product'
        });
    }
});

// POST /api/admin/products - Create new product (admin creates for themselves)
router.post('/products', adminAuth, async (req, res) => {
    try {
        const { name, price, unit, icon, description, stock, isActive, image } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Name and price are required'
            });
        }

        // Use admin's ID as owner - admin creates products for themselves
        const product = await Product.create({
            name: name.trim(),
            price: parseFloat(price),
            unit: unit || 'liter',
            icon: icon || '🥛',
            description: description?.trim() || '',
            stock: parseInt(stock) || 0,
            isActive: isActive !== false,
            owner: req.adminId,
            image: image || ''
        });

        const populatedProduct = await Product.findById(product._id)
            .populate('owner', 'name email phone')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            response: populatedProduct
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create product'
        });
    }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', adminAuth, async (req, res) => {
    try {
        const { name, price, unit, icon, description, stock, isActive, image } = req.body;
        const updates = {};

        if (name) updates.name = name.trim();
        if (price !== undefined) updates.price = parseFloat(price);
        if (unit) updates.unit = unit;
        if (icon) updates.icon = icon;
        if (description !== undefined) updates.description = description.trim();
        if (stock !== undefined) updates.stock = parseInt(stock);
        if (isActive !== undefined) updates.isActive = isActive;
        if (image !== undefined) updates.image = image;

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        ).populate('owner', 'name email phone');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            response: product
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product'
        });
    }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product'
        });
    }
});

// PUT /api/admin/products/:id/toggle - Toggle product status
router.put('/products/:id/toggle', adminAuth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        product.isActive = !product.isActive;
        await product.save();

        res.json({
            success: true,
            message: product.isActive ? 'Product activated' : 'Product deactivated',
            response: product
        });
    } catch (error) {
        console.error('Toggle product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle product status'
        });
    }
});

// ==================== BANNER MANAGEMENT ROUTES ====================

// const Banner = require('../models/Banner');

// GET /api/admin/banners - Get all banners with filters
router.get('/banners', adminAuth, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim() || '';
        const status = req.query.status || 'all';

        const query = {};

        if (status === 'active') {
            query.isActive = true;
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { subtitle: { $regex: search, $options: 'i' } },
                { badge: { $regex: search, $options: 'i' } }
            ];
        }

        const [total, banners] = await Promise.all([
            Banner.countDocuments(query),
            Banner.find(query)
                .sort({ order: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const pages = Math.ceil(total / limit);

        res.json({
            success: true,
            response: {
                banners,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                }
            }
        });
    } catch (error) {
        console.error('Get banners error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch banners'
        });
    }
});

// GET /api/admin/banners/:id
router.get('/banners/:id', adminAuth, async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id).lean();

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        res.json({
            success: true,
            response: banner
        });
    } catch (error) {
        console.error('Get banner error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch banner'
        });
    }
});

// POST /api/admin/banners - Create new banner
router.post('/banners', adminAuth, async (req, res) => {
    try {
        const { title, subtitle, image, badge, gradient, linkType, linkValue, order } = req.body;

        if (!title || !image) {
            return res.status(400).json({
                success: false,
                message: 'Title and image are required'
            });
        }

        // Get the max order if not specified
        let bannerOrder = order;
        if (bannerOrder === undefined || bannerOrder === null) {
            const maxOrderBanner = await Banner.findOne().sort({ order: -1 }).lean();
            bannerOrder = maxOrderBanner ? maxOrderBanner.order + 1 : 0;
        }

        const banner = await Banner.create({
            title: title.trim(),
            subtitle: subtitle?.trim() || '',
            image,
            badge: badge?.trim() || '',
            gradient: gradient || ['#22C55E', '#16A34A'],
            linkType: linkType || 'category',
            linkValue: linkValue || '',
            order: parseInt(bannerOrder) || 0,
            isActive: true
        });

        res.status(201).json({
            success: true,
            message: 'Banner created successfully',
            response: banner
        });
    } catch (error) {
        console.error('Create banner error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create banner'
        });
    }
});

// PUT /api/admin/banners/:id - Update banner
router.put('/banners/:id', adminAuth, async (req, res) => {
    try {
        const { title, subtitle, image, badge, gradient, linkType, linkValue, order, isActive } = req.body;
        const updates = {};

        if (title) updates.title = title.trim();
        if (subtitle !== undefined) updates.subtitle = subtitle.trim();
        if (image) updates.image = image;
        if (badge !== undefined) updates.badge = badge.trim();
        if (gradient) updates.gradient = gradient;
        if (linkType) updates.linkType = linkType;
        if (linkValue !== undefined) updates.linkValue = linkValue;
        if (order !== undefined) updates.order = parseInt(order);
        if (isActive !== undefined) updates.isActive = isActive;

        const banner = await Banner.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        ).lean();

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        res.json({
            success: true,
            message: 'Banner updated successfully',
            response: banner
        });
    } catch (error) {
        console.error('Update banner error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update banner'
        });
    }
});

// DELETE /api/admin/banners/:id
router.delete('/banners/:id', adminAuth, async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        res.json({
            success: true,
            message: 'Banner deleted successfully'
        });
    } catch (error) {
        console.error('Delete banner error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete banner'
        });
    }
});

// PUT /api/admin/banners/:id/toggle - Toggle banner status
router.put('/banners/:id/toggle', adminAuth, async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner not found'
            });
        }

        banner.isActive = !banner.isActive;
        await banner.save();

        res.json({
            success: true,
            message: banner.isActive ? 'Banner activated' : 'Banner deactivated',
            response: banner
        });
    } catch (error) {
        console.error('Toggle banner error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle banner status'
        });
    }
});

// PUT /api/admin/banners/reorder - Reorder banners
router.put('/banners/reorder', adminAuth, async (req, res) => {
    try {
        const { bannerOrders } = req.body;

        if (!bannerOrders || !Array.isArray(bannerOrders)) {
            return res.status(400).json({
                success: false,
                message: 'Banner orders array is required'
            });
        }

        // Update each banner's order
        await Promise.all(
            bannerOrders.map(({ id, order }) =>
                Banner.findByIdAndUpdate(id, { order: parseInt(order) })
            )
        );

        res.json({
            success: true,
            message: 'Banners reordered successfully'
        });
    } catch (error) {
        console.error('Reorder banners error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder banners'
        });
    }
});

module.exports = router;