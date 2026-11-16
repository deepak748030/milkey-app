const express = require('express');
const router = express.Router();
const cache = require('../lib/cache');
const { sendNinzaOtp, generate6DigitOtp } = require('../lib/ninzaSms');
const { normalizePhone, findPortalProfiles, publicPortalIdentity } = require('../lib/portalIdentity');
const { signPortalToken } = require('../lib/portalToken');
const portalAuth = require('../middleware/portal-auth');

// OTP state is kept in-process and, when available, mirrored to Upstash Redis.
// This keeps the flow working on a single Node server and across serverless
// instances when the existing Redis cache credentials are configured.
const otpMemory = new Map();
const otpRate = new Map();
const OTP_PREFIX = 'portal:otp:';
const OTP_TTL_SECONDS = 10 * 60;
const TEST_OTP = process.env.TEST_OTP || '123456';
const ALLOW_TEST_OTP = process.env.ALLOW_TEST_OTP === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

const otpKey = (phone) => `${OTP_PREFIX}${phone}`;

const setOtp = async (phone, data) => {
    otpMemory.set(phone, data);
    await cache.set(otpKey(phone), data, OTP_TTL_SECONDS);
};

const getOtp = async (phone) => {
    const cached = await cache.get(otpKey(phone));
    if (cached) return cached;
    return otpMemory.get(phone) || null;
};

const deleteOtp = async (phone) => {
    otpMemory.delete(phone);
    await cache.del(otpKey(phone));
};

// 1 request / 30 seconds and max 5 requests / hour per mobile number.
const checkRateLimit = (phone) => {
    const now = Date.now();
    const entry = otpRate.get(phone) || { last: 0, count: 0, windowStart: now };
    if (now - entry.windowStart > 60 * 60 * 1000) {
        entry.count = 0;
        entry.windowStart = now;
    }
    if (now - entry.last < 30 * 1000) {
        return { ok: false, message: 'Please wait 30 seconds before requesting another OTP.' };
    }
    if (entry.count >= 5) {
        return { ok: false, message: 'Too many OTP requests. Please try again later.' };
    }
    entry.last = now;
    entry.count += 1;
    otpRate.set(phone, entry);
    return { ok: true };
};

const hasAnyModule = (identity) =>
    identity.availableModules.collection || identity.availableModules.selling;

// POST /api/portal/auth/send-otp
router.post('/send-otp', async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);
        const identity = await findPortalProfiles(phone);

        // No registration flow in portal mode: the mobile must already exist in
        // a dairy owner's selling customers or collection farmers.
        if (!hasAnyModule(identity)) {
            return res.status(404).json({
                success: false,
                message: 'This mobile number is not linked to any Collection farmer or Selling customer. Please contact your dairy owner.',
                code: 'PORTAL_PROFILE_NOT_FOUND',
            });
        }

        const rate = checkRateLimit(phone);
        if (!rate.ok) {
            return res.status(429).json({ success: false, message: rate.message, code: 'OTP_RATE_LIMIT' });
        }

        const smsConfigured = !!(process.env.NINZASMS_API_KEY && process.env.NINZASMS_SENDER_ID);
        let otp = TEST_OTP;
        let delivery = 'test';
        let devOtp = TEST_OTP;

        if (!smsConfigured && IS_PRODUCTION && !ALLOW_TEST_OTP) {
            return res.status(503).json({
                success: false,
                message: 'OTP service is not configured. Please contact support.',
                code: 'OTP_NOT_CONFIGURED',
            });
        }

        if (smsConfigured && !ALLOW_TEST_OTP) {
            const generated = generate6DigitOtp();
            const sent = await sendNinzaOtp(phone, generated);
            if (sent.ok) {
                otp = generated;
                delivery = 'sms';
                devOtp = undefined;
            } else if (!IS_PRODUCTION) {
                // Local dev / preview remains usable without paid SMS credits.
                otp = TEST_OTP;
                delivery = 'test';
                devOtp = TEST_OTP;
                console.warn('[portal-auth] NinzaSMS failed, using development OTP:', sent.error || sent.msg);
            } else {
                return res.status(502).json({
                    success: false,
                    message: sent.error || sent.msg || 'Could not send OTP. Please try again.',
                    code: 'OTP_DELIVERY_FAILED',
                });
            }
        }

        await setOtp(phone, {
            otp,
            delivery,
            expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
            attempts: 0,
        });

        return res.json({
            success: true,
            message: delivery === 'sms'
                ? `OTP sent to +91 ${phone}.`
                : `OTP ready for +91 ${phone}.`,
            response: {
                delivery,
                ...(devOtp ? { devOtp } : {}),
                availableModules: Object.keys(identity.availableModules).filter((key) => identity.availableModules[key]),
            },
        });
    } catch (error) {
        console.error('[portal-auth] send-otp error:', error);
        return res.status(error.message?.includes('mobile') ? 400 : 500).json({
            success: false,
            message: error.message || 'Failed to send OTP.',
        });
    }
});

// POST /api/portal/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);
        const otp = String(req.body?.otp || '').trim();
        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit OTP.' });
        }

        const stored = await getOtp(phone);
        if (!stored) {
            return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new OTP.' });
        }
        if (Date.now() > stored.expiresAt) {
            await deleteOtp(phone);
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
        }

        stored.attempts = Number(stored.attempts || 0) + 1;
        if (stored.attempts > 5) {
            await deleteOtp(phone);
            return res.status(429).json({ success: false, message: 'Too many invalid attempts. Please request a new OTP.' });
        }
        if (String(stored.otp) !== otp) {
            await setOtp(phone, stored);
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }

        await deleteOtp(phone);
        const identity = await findPortalProfiles(phone);
        if (!hasAnyModule(identity)) {
            return res.status(403).json({
                success: false,
                message: 'This mobile number is no longer linked to any dairy records.',
                code: 'PORTAL_PROFILE_NOT_FOUND',
            });
        }

        const token = signPortalToken(phone);
        return res.json({
            success: true,
            message: 'Login successful.',
            response: {
                token,
                user: publicPortalIdentity(identity),
            },
        });
    } catch (error) {
        console.error('[portal-auth] verify-otp error:', error);
        return res.status(error.message?.includes('mobile') ? 400 : 500).json({
            success: false,
            message: error.message || 'Failed to verify OTP.',
        });
    }
});

// GET /api/portal/auth/session
router.get('/session', portalAuth, async (req, res) => {
    try {
        const identity = await findPortalProfiles(req.portalPhone);
        if (!hasAnyModule(identity)) {
            return res.status(403).json({
                success: false,
                message: 'This mobile number is no longer linked to any dairy records.',
                code: 'PORTAL_PROFILE_NOT_FOUND',
            });
        }
        return res.json({
            success: true,
            response: { user: publicPortalIdentity(identity) },
        });
    } catch (error) {
        console.error('[portal-auth] session error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load portal session.' });
    }
});

// POST /api/portal/auth/logout
router.post('/logout', (req, res) => {
    // Portal JWTs are stateless; the app clears its local session.
    return res.json({ success: true, message: 'Logged out.', response: { loggedOut: true } });
});

module.exports = router;
