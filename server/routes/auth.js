const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Referral = require('../models/Referral');
const auth = require('../middleware/auth');

// Simple password hashing (use bcrypt in production)
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, referralCode } = req.body;

        // Validation
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { phone }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: existingUser.email === email.toLowerCase()
                    ? 'Email already registered'
                    : 'Phone number already registered'
            });
        }

        // Handle referral
        let referrer = null;
        if (referralCode) {
            referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
            if (!referrer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid referral code'
                });
            }
        }

        // Create user
        const user = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashPassword(password),
            referredBy: referrer?._id,
            isVerified: true
        });

        await user.save();

        // Create referral record if referred
        if (referrer) {
            await Referral.create({
                referrer: referrer._id,
                referred: user._id,
                code: referralCode.toUpperCase(),
                status: 'active'
            });
        }

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            response: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    address: user.address,
                    role: user.role,
                    referralCode: user.referralCode,
                    memberSince: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked'
            });
        }

        const hashedPassword = hashPassword(password);
        if (user.password !== hashedPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            response: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar,
                    address: user.address,
                    role: user.role,
                    referralCode: user.referralCode,
                    memberSince: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            response: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
                avatar: req.user.avatar,
                address: req.user.address,
                role: req.user.role,
                referralCode: req.user.referralCode,
                memberSince: req.user.createdAt
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile'
        });
    }
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, avatar, address } = req.body;
        const updates = {};

        if (name) updates.name = name.trim();
        if (avatar !== undefined) updates.avatar = avatar;
        if (address !== undefined) updates.address = address.trim();

        const user = await User.findByIdAndUpdate(
            req.userId,
            updates,
            { new: true }
        ).select('-password -otp');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            response: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                address: user.address,
                role: user.role,
                referralCode: user.referralCode,
                memberSince: user.createdAt
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

// PUT /api/auth/push-token
router.put('/push-token', auth, async (req, res) => {
    try {
        const { expoPushToken } = req.body;

        await User.findByIdAndUpdate(req.userId, { expoPushToken });

        res.json({
            success: true,
            message: 'Push token updated'
        });
    } catch (error) {
        console.error('Update push token error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update push token'
        });
    }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
    try {
        // Clear push token on logout
        await User.findByIdAndUpdate(req.userId, { expoPushToken: '' });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

module.exports = router;
