
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const User = require('../models/User');
const Referral = require('../models/Referral');
const auth = require('../middleware/auth');
const { notifyReferralSignup } = require('../lib/pushNotifications');

// Initialize Firebase Admin SDK (only once)
// Prefers GOOGLE_APPLICATION_CREDENTIALS env var or FIREBASE_SERVICE_ACCOUNT JSON
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id || 'milkeyapp',
            });
            console.log('[firebase-admin] initialized with FIREBASE_SERVICE_ACCOUNT env var');
        } else {
            // Falls back to GOOGLE_APPLICATION_CREDENTIALS or default credentials
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: 'milkeyapp',
            });
            console.log('[firebase-admin] initialized with applicationDefault credentials');
        }
    } catch (e) {
        console.error('[firebase-admin] FAILED to init with credentials, falling back to projectId-only (verifyIdToken WILL FAIL):', e.message);
        admin.initializeApp({ projectId: 'milkeyapp' });
    }
}

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

// Generate 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTPs temporarily (in production, use Redis or DB)
const otpStore = new Map();

// Create nodemailer transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: 'koba ukdl amtu skpm',
        },
    });
};

// Send OTP email
const sendOtpEmail = async (email, otp) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Milkey - Email Verification OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #22c55e;">🥛 Milkey</h1>
                </div>
                <div style="background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                    <h2 style="color: #1f2937; margin-bottom: 10px;">Email Verification</h2>
                    <p style="color: #6b7280; margin-bottom: 20px;">Use the following OTP to verify your email address:</p>
                    <div style="background: #22c55e; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 15px 30px; border-radius: 8px; display: inline-block;">
                        ${otp}
                    </div>
                    <p style="color: #9ca3af; margin-top: 20px; font-size: 14px;">This OTP will expire in 10 minutes.</p>
                </div>
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
                    If you didn't request this, please ignore this email.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if email already registered
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Generate OTP
        const otp = generateOtp();

        // Store OTP with expiry (10 minutes)
        otpStore.set(email.toLowerCase(), {
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        // Send OTP email
        await sendOtpEmail(email, otp);

        res.json({
            success: true,
            message: 'OTP sent successfully'
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP. Please try again.'
        });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const storedData = otpStore.get(email.toLowerCase());

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired or not found. Please request a new one.'
            });
        }

        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        // OTP verified, remove from store
        otpStore.delete(email.toLowerCase());

        res.json({
            success: true,
            message: 'OTP verified successfully',
            response: { verified: true }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP. Please try again.'
        });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, address, referralCode } = req.body;

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
            address: address ? address.trim() : '',
            referredBy: referrer?._id,
            isVerified: true
        });

        await user.save();

        // Create referral record if referred
        if (referrer) {
            const ReferralConfig = require('../models/ReferralConfig');
            const cfg = await ReferralConfig.findOneAndUpdate(
                {},
                { $setOnInsert: { defaultCommissionRate: 5 } },
                { new: true, upsert: true }
            );
            const commissionRate = typeof cfg?.defaultCommissionRate === 'number' ? cfg.defaultCommissionRate : 5;

            await Referral.create({
                referrer: referrer._id,
                referred: user._id,
                code: referralCode.toUpperCase(),
                status: 'active',
                commissionRate
            });

            // Send push notification to referrer about new signup
            notifyReferralSignup(
                referrer._id.toString(),
                user.name
            ).catch(err => console.error('Error sending referral signup notification:', err));
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

// Store for forgot password OTPs and reset tokens
const forgotPasswordOtpStore = new Map();
const resetTokenStore = new Map();

// Send forgot password OTP email
const sendForgotPasswordOtpEmail = async (email, otp) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Milkey - Password Reset OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #22c55e;">🥛 Milkey</h1>
                </div>
                <div style="background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                    <h2 style="color: #1f2937; margin-bottom: 10px;">Password Reset</h2>
                    <p style="color: #6b7280; margin-bottom: 20px;">Use the following OTP to reset your password:</p>
                    <div style="background: #ef4444; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 15px 30px; border-radius: 8px; display: inline-block;">
                        ${otp}
                    </div>
                    <p style="color: #9ca3af; margin-top: 20px; font-size: 14px;">This OTP will expire in 10 minutes.</p>
                </div>
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
                    If you didn't request this, please ignore this email.
                </p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        // Generate OTP
        const otp = generateOtp();

        // Store OTP with expiry (10 minutes)
        forgotPasswordOtpStore.set(email.toLowerCase(), {
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        // Send OTP email
        await sendForgotPasswordOtpEmail(email, otp);

        res.json({
            success: true,
            message: 'Password reset OTP sent to your email'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP. Please try again.'
        });
    }
});

// POST /api/auth/verify-forgot-otp
router.post('/verify-forgot-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const storedData = forgotPasswordOtpStore.get(email.toLowerCase());

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired or not found. Please request a new one.'
            });
        }

        if (Date.now() > storedData.expiresAt) {
            forgotPasswordOtpStore.delete(email.toLowerCase());
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        if (storedData.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        // OTP verified, generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Store reset token with expiry (15 minutes)
        resetTokenStore.set(email.toLowerCase(), {
            token: resetToken,
            expiresAt: Date.now() + 15 * 60 * 1000
        });

        // Remove OTP from store
        forgotPasswordOtpStore.delete(email.toLowerCase());

        res.json({
            success: true,
            message: 'OTP verified successfully',
            response: { verified: true, resetToken }
        });
    } catch (error) {
        console.error('Verify forgot OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP. Please try again.'
        });
    }
});

// POST /api/auth/reset-password /send-phone-otp
router.post('/reset-password', async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email, reset token, and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const storedData = resetTokenStore.get(email.toLowerCase());

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: 'Reset token expired or not found. Please start again.'
            });
        }

        if (Date.now() > storedData.expiresAt) {
            resetTokenStore.delete(email.toLowerCase());
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired. Please start again.'
            });
        }

        if (storedData.token !== resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset token. Please start again.'
            });
        }

        // Update password
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = hashPassword(newPassword);
        await user.save();

        // Remove reset token from store
        resetTokenStore.delete(email.toLowerCase());

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password. Please try again.'
        });
    }
});

// Store for phone OTPs
const phoneOtpStore = new Map();

// POST /api/auth/send-phone-otp
// router.post('/send-phone-otp', async (req, res) => {
//     try {
//         const { phone } = req.body;
//         if (!phone) {
//             return res.status(400).json({ success: false, message: 'Phone number is required' });
//         }

//         // Use hardcoded OTP 123456 for now
//         const otp = '123456';

//         phoneOtpStore.set(phone, {
//             otp,
//             expiresAt: Date.now() + 10 * 60 * 1000
//         });

//         console.log(`Phone OTP for ${phone}: ${otp}`);

//         res.json({ success: true, message: 'OTP sent successfully' });
//     } catch (error) {
//         console.error('Send phone OTP error:', error);
//         res.status(500).json({ success: false, message: 'Failed to send OTP' });
//     }
// });

// POST /api/auth/verify-phone-otp
router.post('/verify-phone-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
        }

        const storedData = phoneOtpStore.get(phone);

        if (!storedData) {
            // Also accept hardcoded 123456
            if (otp === '123456') {
                return res.json({ success: true, message: 'OTP verified', response: { verified: true } });
            }
            return res.status(400).json({ success: false, message: 'OTP expired or not found' });
        }

        if (Date.now() > storedData.expiresAt) {
            phoneOtpStore.delete(phone);
            if (otp === '123456') {
                return res.json({ success: true, message: 'OTP verified', response: { verified: true } });
            }
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        if (storedData.otp !== otp && otp !== '123456') {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        phoneOtpStore.delete(phone);
        res.json({ success: true, message: 'OTP verified', response: { verified: true } });
    } catch (error) {
        console.error('Verify phone OTP error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
});

// POST /api/auth/phone-login - Login with phone + OTP (auto-detect new user)
router.post('/phone-login', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
        }

        // Verify OTP (accept hardcoded 123456)
        const storedData = phoneOtpStore.get(phone);
        if (otp !== '123456') {
            if (!storedData || Date.now() > storedData.expiresAt || storedData.otp !== otp) {
                return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
            }
        }
        phoneOtpStore.delete(phone);

        // Find user by phone
        const user = await User.findOne({ phone });
        if (!user) {
            // Return special code so app can show registration form
            return res.json({
                success: true,
                code: 'USER_NOT_FOUND',
                message: 'Phone verified. Please complete registration.',
                response: { needsRegistration: true, phone }
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account has been blocked' });
        }

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
        console.error('Phone login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// POST /api/auth/send-phone-otp
// DEPRECATED — phone OTP is now sent by the CLIENT via Firebase Phone Auth (JS SDK + reCAPTCHA).
// This endpoint stays only to return a clear error if any old client still calls it.
router.post('/send-phone-otp', async (req, res) => {
    console.log(req.body)
    console.warn('[send-phone-otp] called — deprecated. Phone OTP must go through Firebase on the client.');
    return res.status(410).json({
        success: false,
        message: 'Phone OTP is now handled by Firebase on the client. Please update the app.',
    });
});

// POST /api/auth/firebase-phone-login
// Client obtains Firebase ID token via Firebase Phone Auth, then sends it here.
router.post('/firebase-phone-login', async (req, res) => {
    try {
        const { firebaseIdToken, phone } = req.body;
        console.log('[firebase-phone-login] phone:', phone, 'tokenLen:', firebaseIdToken ? firebaseIdToken.length : 0);

        if (!firebaseIdToken || !phone) {
            console.warn('[firebase-phone-login] missing firebaseIdToken or phone');
            return res.status(400).json({ success: false, message: 'Firebase ID token and phone are required' });
        }

        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
            console.log('[firebase-phone-login] decoded token uid:', decodedToken.uid, 'phone:', decodedToken.phone_number);
        } catch (verifyError) {
            console.error('[firebase-phone-login] token verification failed:', verifyError.message);
            return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token' });
        }

        const firebasePhone = decodedToken.phone_number || '';
        const normalizedPhone = String(phone).replace(/^\+91/, '').replace(/\D/g, '');
        const normalizedFirebasePhone = firebasePhone.replace(/^\+91/, '').replace(/\D/g, '');
        console.log('[firebase-phone-login] normalized phones — app:', normalizedPhone, 'firebase:', normalizedFirebasePhone);

        if (normalizedFirebasePhone !== normalizedPhone) {
            console.warn('[firebase-phone-login] phone mismatch');
            return res.status(400).json({ success: false, message: 'Phone number mismatch' });
        }

        const user = await User.findOne({ phone: normalizedPhone });
        if (!user) {
            console.log('[firebase-phone-login] user not found, needs registration');
            return res.json({
                success: true,
                code: 'USER_NOT_FOUND',
                message: 'Phone verified. Please complete registration.',
                response: { needsRegistration: true, phone: normalizedPhone }
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account has been blocked' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);
        console.log('[firebase-phone-login] login successful for user:', user._id.toString());

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
        console.error('[firebase-phone-login] error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});


// router.post('/phone-register', async (req, res) => {
//     try {
//         const { phone, name, email, password, address, referralCode } = req.body;

//         if (!phone || !name || !email || !password) {
//             return res.status(400).json({ success: false, message: 'Phone, name, email, and password are required' });
//         }

//         if (password.length < 6) {
//             return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
//         }

//         // Check if user already exists
//         const existingUser = await User.findOne({
//             $or: [{ email: email.toLowerCase() }, { phone }]
//         });

//         if (existingUser) {
//             return res.status(400).json({
//                 success: false,
//                 message: existingUser.email === email.toLowerCase()
//                     ? 'Email already registered'
//                     : 'Phone number already registered'
//             });
//         }

//         // Handle referral
//         let referrer = null;
//         if (referralCode) {
//             referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
//             if (!referrer) {
//                 return res.status(400).json({ success: false, message: 'Invalid referral code' });
//             }
//         }

//         const user = new User({
//             name: name.trim(),
//             email: email.toLowerCase().trim(),
//             phone: phone.trim(),
//             password: hashPassword(password),
//             address: address ? address.trim() : '',
//             referredBy: referrer?._id,
//             isVerified: true
//         });

//         await user.save();

//         // Create referral record if referred
//         if (referrer) {
//             const ReferralConfig = require('../models/ReferralConfig');
//             const cfg = await ReferralConfig.findOneAndUpdate(
//                 {},
//                 { $setOnInsert: { defaultCommissionRate: 5 } },
//                 { new: true, upsert: true }
//             );
//             const commissionRate = typeof cfg?.defaultCommissionRate === 'number' ? cfg.defaultCommissionRate : 5;

//             await Referral.create({
//                 referrer: referrer._id,
//                 referred: user._id,
//                 code: referralCode.toUpperCase(),
//                 status: 'active',
//                 commissionRate
//             });

//             notifyReferralSignup(referrer._id.toString(), user.name)
//                 .catch(err => console.error('Error sending referral signup notification:', err));
//         }

//         const token = generateToken(user._id);

//         res.status(201).json({
//             success: true,
//             message: 'Registration successful',
//             response: {
//                 token,
//                 user: {
//                     id: user._id,
//                     name: user.name,
//                     email: user.email,
//                     phone: user.phone,
//                     avatar: user.avatar,
//                     address: user.address,
//                     role: user.role,
//                     referralCode: user.referralCode,
//                     memberSince: user.createdAt
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Phone register error:', error);
//         res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
//     }
// });

// POST /api/auth/google - Google Sign In
router.post('/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google token is required' });
        }

        // Decode the ID token (in production, verify with Google's API)
        // For now, decode the JWT payload
        let decoded;
        try {
            const parts = idToken.split('.');
            if (parts.length === 3) {
                decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            }
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid Google token' });
        }

        if (!decoded || !decoded.email) {
            return res.status(400).json({ success: false, message: 'Could not extract email from Google token' });
        }

        // Find or create user
        let user = await User.findOne({ email: decoded.email.toLowerCase() });

        if (!user) {
            user = new User({
                name: decoded.name || decoded.email.split('@')[0],
                email: decoded.email.toLowerCase(),
                phone: '',
                password: hashPassword(crypto.randomBytes(16).toString('hex')),
                avatar: decoded.picture || '',
                isVerified: true
            });
            await user.save();
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account has been blocked' });
        }

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
        console.error('Google auth error:', error);
        res.status(500).json({ success: false, message: 'Google sign in failed' });
    }
});

// POST /api/auth/google-info - Google Sign In with user info (from expo-auth-session access token)
router.post('/google-info', async (req, res) => {
    try {
        const { email, name, picture } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        // Find or create user
        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            user = new User({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                phone: '',
                password: hashPassword(crypto.randomBytes(16).toString('hex')),
                avatar: picture || '',
                isVerified: true
            });
            await user.save();
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account has been blocked' });
        }

        user.lastLogin = new Date();
        if (picture && !user.avatar) {
            user.avatar = picture;
        }
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
        console.error('Google info auth error:', error);
        res.status(500).json({ success: false, message: 'Google sign in failed' });
    }
});

module.exports = router;
