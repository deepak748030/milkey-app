const { verifyPortalToken } = require('../lib/portalToken');

/**
 * Auth middleware for farmer/customer portal endpoints only.
 * It never looks up or mutates a dairy-owner User document.
 */
module.exports = function portalAuth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Portal session required.',
                code: 'PORTAL_SESSION_REQUIRED',
            });
        }

        const payload = verifyPortalToken(header.slice(7).trim());
        req.portalPhone = payload.phone;
        req.portalTokenPayload = payload;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired portal session. Please login again.',
            code: 'INVALID_PORTAL_SESSION',
        });
    }
};
