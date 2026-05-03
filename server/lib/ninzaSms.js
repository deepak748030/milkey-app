// server/lib/ninzaSms.js
// NinzaSMS integration for sending OTPs to Indian mobile numbers
const axios = require('axios');

const NINZASMS_URL = 'https://ninzasms.in.net/auth/send_sms';

/**
 * Normalize an Indian mobile number to a strict 10-digit format.
 * Accepts: "9876543210", "+919876543210", "919876543210", "09876543210"
 * Returns: { ok: true, tenDigit, withCountry } or { ok: false, error }
 */
function normalizeIndianMobile(input) {
    if (!input) return { ok: false, error: 'Mobile number is required' };
    const digits = String(input).replace(/\D/g, '');

    let ten = digits;
    if (ten.length === 12 && ten.startsWith('91')) ten = ten.slice(2);
    else if (ten.length === 11 && ten.startsWith('0')) ten = ten.slice(1);

    if (ten.length !== 10) {
        return { ok: false, error: 'Invalid Indian mobile number (must be 10 digits)' };
    }
    if (!/^[6-9]\d{9}$/.test(ten)) {
        return { ok: false, error: 'Invalid Indian mobile number (must start with 6-9)' };
    }
    return { ok: true, tenDigit: ten, withCountry: '91' + ten };
}

/**
 * Generate a 6-digit numeric OTP.
 */
function generate6DigitOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send an OTP via NinzaSMS.
 * @param {string} mobile - Indian mobile (10 digits or with +91 / 91)
 * @param {string} otp - 6-digit OTP
 * @param {object} [opts]
 * @param {('sms'|'whatsapp')} [opts.route] - delivery route, defaults to 'sms'
 * @returns {Promise<{ok:boolean, status?:number, msg?:string, error?:string, raw?:any}>}
 */
async function sendNinzaOtp(mobile, otp, opts = {}) {
    const apiKey = process.env.NINZASMS_API_KEY;
    const senderId = process.env.NINZASMS_SENDER_ID;

    if (!apiKey || !senderId) {
        return {
            ok: false,
            error: 'NinzaSMS not configured (NINZASMS_API_KEY / NINZASMS_SENDER_ID missing)',
        };
    }

    const norm = normalizeIndianMobile(mobile);
    if (!norm.ok) return { ok: false, error: norm.error };

    if (!/^\d{4,6}$/.test(String(otp))) {
        return { ok: false, error: 'OTP must be 4-6 digits' };
    }

    const route = (opts.route || process.env.NINZASMS_ROUTE || 'sms').toLowerCase();

    const payload = {
        sender_id: String(senderId),
        variables_values: String(otp),
        numbers: norm.tenDigit,
    };
    if (route === 'whatsapp' || route === 'waninza') {
        payload.rout = 'waninza';
    }

    try {
        const response = await axios.post(NINZASMS_URL, payload, {
            headers: {
                authorization: apiKey,
                'content-type': 'application/json',
            },
            timeout: 15000,
        });

        const data = response.data || {};
        const success = Number(data.status) === 1;

        if (!success) {
            console.error('[ninzasms] send failed:', data);
            return { ok: false, status: data.status, msg: data.msg || 'SMS provider error', raw: data };
        }

        return { ok: true, status: data.status, msg: data.msg, raw: data };
    } catch (err) {
        const data = err.response?.data;
        console.error('[ninzasms] request error:', data || err.message);
        return {
            ok: false,
            error: data?.msg || err.message || 'Failed to reach SMS provider',
            raw: data,
        };
    }
}

module.exports = {
    sendNinzaOtp,
    generate6DigitOtp,
    normalizeIndianMobile,
};
