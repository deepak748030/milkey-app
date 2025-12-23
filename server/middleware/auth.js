const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

            const user = await User.findById(decoded.userId).select('-password -otp');

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
