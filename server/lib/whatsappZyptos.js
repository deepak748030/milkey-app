// Lightweight Zyptos WhatsApp API client.
// Docs: https://zyptos.com/app/developer
// Base URL: https://zyptos.com/api/v1/whatsapp

const DEFAULT_BASE_URL = 'https://zyptos.com/api/v1/whatsapp';

function getConfig() {
    const apiKey = process.env.ZYPTOS_API_KEY || '';
    const baseUrl = process.env.ZYPTOS_BASE_URL || DEFAULT_BASE_URL;
    return { apiKey, baseUrl };
}

// Normalize a phone number to E.164 (assumes Indian numbers when 10 digits).
function toE164(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 10) return '+91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
    if (String(phone).startsWith('+')) return String(phone);
    return '+' + digits;
}

// Replace {{name}}, {{phone}}, {{referralCode}}, {{email}} placeholders.
function renderTemplate(template, vars = {}) {
    if (!template) return '';
    return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
        const v = vars[k];
        return v === undefined || v === null ? '' : String(v);
    });
}

async function sendTextMessage({ to, message, connectionId }) {
    const { apiKey, baseUrl } = getConfig();
    if (!apiKey) {
        console.warn('[zyptos] ZYPTOS_API_KEY not configured — skipping WhatsApp send');
        return { skipped: true, reason: 'missing_api_key' };
    }
    if (!to || !message) {
        return { skipped: true, reason: 'missing_to_or_message' };
    }

    const body = { to: toE164(to), message };
    if (connectionId && Number(connectionId) > 0) {
        body.connection_id = Number(connectionId);
    }

    const url = baseUrl.replace(/\/$/, '') + '/messages/text';
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(body)
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) {
            console.error('[zyptos] send failed', res.status, data);
            return { success: false, status: res.status, data };
        }
        console.log('[zyptos] message sent to', body.to, data?.data?.message_id || '');
        return { success: true, data };
    } catch (err) {
        console.error('[zyptos] send error:', err.message);
        return { success: false, error: err.message };
    }
}

async function sendWelcomeMessage(user) {
    try {
        const WhatsappSettings = require('../models/WhatsappSettings');
        let settings = await WhatsappSettings.findOne();
        if (!settings) {
            settings = await WhatsappSettings.create({});
        }
        if (!settings.enabled) {
            return { skipped: true, reason: 'disabled' };
        }
        const message = renderTemplate(settings.welcomeMessage, {
            name: user?.name || 'there',
            phone: user?.phone || '',
            email: user?.email || '',
            referralCode: user?.referralCode || ''
        });
        return await sendTextMessage({
            to: user?.phone,
            message,
            connectionId: settings.connectionId
        });
    } catch (err) {
        console.error('[zyptos] sendWelcomeMessage error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendTextMessage,
    sendWelcomeMessage,
    renderTemplate,
    toE164
};
