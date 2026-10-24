const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../lib/cache');

const USER_CACHE_TTL = 30; // seconds
const userKey = (id) => `user:${id}`;

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Try cache first — auth runs on EVERY request, so this is the
            // single biggest perf win. We always re-hydrate as a Mongoose doc
            // so downstream code that may call user.save() still works.
            let user = null;
            const cached = await cache.get(userKey(decoded.userId));
            if (cached) {
                user = User.hydrate(cached);
            } else {
                user = await User.findById(decoded.userId).select('-password -otp');
                if (user) {
                    // Cache plain object (without sensitive fields)
                    cache.set(userKey(decoded.userId), user.toObject(), USER_CACHE_TTL);
                }
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found.'
                });
            }

            if (user.isBlocked) {
                return res.status(403).json({
                    success: false,
                    message: 'Your account has been blocked.'
                });
            }

            req.user = user;
            req.userId = user._id;

            // Real session enforcement: if client sends X-Device-Id and that
            // device was logged out remotely, force re-login (401).
            const deviceIdHeader = (req.headers['x-device-id'] || '').toString().trim();
            if (deviceIdHeader) {
                try {
                    const Device = require('../models/Device');
                    const dev = await Device.findOne({ user: decoded.userId, deviceId: deviceIdHeader }).select('isActive').lean();
                    if (dev && dev.isActive === false) {
                        return res.status(401).json({ success: false, message: 'This device has been logged out. Please login again.', code: 'DEVICE_LOGGED_OUT' });
                    }
                } catch {/* non-fatal — don't block if Device lookup fails */}
            }

            next();
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
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
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error.'
        });
    }
};

module.exports = auth;
