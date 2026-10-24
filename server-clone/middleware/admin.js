const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const cache = require('../lib/cache');

const userKey = (id) => `user:${id}`;
const adminKey = (id) => `admin:${id}`;

/**
 * Admin auth - supports both Admin JWT (adminId/type admin) and User JWT (userId)
 */
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Admin token (from /api/admin/login) has adminId + type admin
    if (decoded.adminId || decoded.type === 'admin') {
      const adminId = decoded.adminId || decoded.userId;
      let admin = null;
      const cached = await cache.get(adminKey(adminId));
      if (cached) admin = Admin.hydrate(cached);
      else {
        admin = await Admin.findById(adminId).select('-password').lean();
        if (admin) cache.set(adminKey(adminId), admin, 30);
        else admin = await Admin.findById(adminId).select('-password');
      }
      if (!admin) return res.status(401).json({ success: false, message: 'Admin not found' });
      if (admin.isActive === false) return res.status(403).json({ success: false, message: 'Admin deactivated' });
      req.admin = admin;
      req.adminId = admin._id;
      req.userId = admin._id;
      // keep compat: req.user = admin
      req.user = admin;
      return next();
    }
    let user = null;
    const cached = await cache.get(userKey(decoded.userId));
    if (cached) user = User.hydrate(cached);
    else {
      user = await User.findById(decoded.userId).select('-password -otp');
      if (user) cache.set(userKey(decoded.userId), user.toObject(), 30);
    }
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ success: false, message: 'Blocked' });
    const allowedRoles = ['owner', 'staff', 'admin'];
    if (user.role && !allowedRoles.includes(user.role)) {
    }
    req.user = user;
    req.userId = user._id;
    req.adminId = user._id;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = adminAuth;
