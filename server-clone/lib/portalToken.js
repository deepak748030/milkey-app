const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Portal sessions are deliberately separate from dairy-owner User sessions.
// A portal token only proves that a farmer/customer mobile number was verified;
// it never resolves to a User document and cannot pass the normal auth middleware.
const TOKEN_KIND = 'milkey_farmer_customer_portal';
const PURPOSE = 'portal_session';

let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    // Safe for local development. Production must provide JWT_SECRET, which also
    // keeps tokens valid across process restarts.
    SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[portal-auth] JWT_SECRET is missing; using an ephemeral development secret');
}

function signPortalToken(phone) {
    const normalized = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(normalized)) {
        throw new Error('Invalid portal phone');
    }
    return jwt.sign(
        { kind: TOKEN_KIND, purpose: PURPOSE, phone: normalized },
        SECRET,
        { expiresIn: process.env.PORTAL_JWT_EXPIRES_IN || '30d' }
    );
}

function verifyPortalToken(token) {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded || decoded.kind !== TOKEN_KIND || decoded.purpose !== PURPOSE) {
        throw new Error('Invalid portal token');
    }
    const phone = String(decoded.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
        throw new Error('Invalid portal token');
    }
    return { ...decoded, phone };
}

module.exports = {
    TOKEN_KIND,
    PURPOSE,
    signPortalToken,
    verifyPortalToken,
};
