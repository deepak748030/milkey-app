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
    // console.log(apiKey, baseUrl, to, message, "connectionId", connectionId)
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
            const zyptosMessage = data?.message || data?.error || '';
            if (res.status === 403 && /public api access/i.test(zyptosMessage)) {
                return {
                    success: false,
                    status: res.status,
                    reason: 'public_api_disabled',
                    message: 'Zyptos Public API access is disabled for this workspace/API key. Enable Public API access in Zyptos Developer settings or generate a key with WhatsApp API access.',
                    data
                };
            }
            if (res.status === 401 || res.status === 403) {
                return {
                    success: false,
                    status: res.status,
                    reason: 'unauthorized',
                    message: 'Zyptos rejected the API key. Check ZYPTOS_API_KEY and workspace permissions.',
                    data
                };
            }
            return { success: false, status: res.status, message: zyptosMessage || 'Zyptos send failed', data };
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
        const settings = await getSettings();
        if (!settings.enabled) {
            return { skipped: true, reason: 'disabled' };
        }
        return await sendEventMessage({
            key: `user_welcome:${user?._id || user?.id || user?.phone || Date.now()}`,
            type: 'user_welcome',
            to: user?.phone,
            template: settings.welcomeMessage,
            vars: {
                name: user?.name || 'there',
                phone: user?.phone || '',
                email: user?.email || '',
                referralCode: user?.referralCode || ''
            },
            connectionId: settings.connectionId
        });
    } catch (err) {
        console.error('[zyptos] sendWelcomeMessage error:', err.message);
        return { success: false, error: err.message };
    }
}

async function getSettings() {
    const WhatsappSettings = require('../models/WhatsappSettings');
    let settings = await WhatsappSettings.findOne();
    if (!settings) {
        settings = await WhatsappSettings.create({});
    }
    return settings;
}

// Send a template message exactly once per logical event.
// `key` is persisted in WhatsappMessageLog with a unique index, so if the
// same event fires again (retry / duplicate webhook / double submit) the
// message is NOT sent a second time.
async function sendEventMessage({ key, type, to, template, vars, connectionId }) {
    try {
        if (!key || !to || !template) {
            return { skipped: true, reason: 'missing_key_to_or_template' };
        }

        const WhatsappMessageLog = require('../models/WhatsappMessageLog');

        // Claim the event first — if the key already exists, this is a duplicate.
        let log;
        try {
            log = await WhatsappMessageLog.create({ key, type: type || '', to: toE164(to), status: 'pending' });
        } catch (err) {
            if (err && err.code === 11000) {
                console.log('[zyptos] duplicate event suppressed:', key);
                return { skipped: true, reason: 'duplicate_event' };
            }
            throw err;
        }

        const message = renderTemplate(template, vars || {});
        const result = await sendTextMessage({ to, message, connectionId });

        const sentOk = result?.success === true;
        const skipped = result?.skipped === true;
        log.status = skipped ? 'skipped' : (sentOk ? 'sent' : 'failed');
        log.error = result?.message || result?.error || result?.reason || '';
        log.sentAt = sentOk ? new Date() : undefined;
        await log.save();

        return result;
    } catch (err) {
        console.error('[zyptos] sendEventMessage error:', err.message);
        return { success: false, error: err.message };
    }
}

// Welcome message for a newly added selling member/customer.
async function sendMemberWelcome(member) {
    try {
        const settings = await getSettings();
        if (!settings.enabled) {
            return { skipped: true, reason: 'disabled' };
        }
        return await sendEventMessage({
            key: `member_welcome:${member?._id || member?.mobile || Date.now()}`,
            type: 'member_welcome',
            to: member?.mobile,
            template: settings.memberWelcomeMessage,
            vars: {
                name: member?.name || 'there',
                phone: member?.mobile || ''
            },
            connectionId: settings.connectionId
        });
    } catch (err) {
        console.error('[zyptos] sendMemberWelcome error:', err.message);
        return { success: false, error: err.message };
    }
}

// Payment / subscription transaction outcome messages.
// eventId should uniquely identify the transaction event, e.g.
// `payment_success:<userSubscriptionId>` so retries never duplicate.
async function sendPaymentStatusMessage({ status, user, amount, plan, transactionId, eventId }) {
    try {
        const settings = await getSettings();
        if (!settings.enabled) {
            return { skipped: true, reason: 'disabled' };
        }

        const isSuccess = status === 'success';
        const template = isSuccess ? settings.paymentSuccessMessage : settings.paymentFailedMessage;
        const key = `${isSuccess ? 'payment_success' : 'payment_failed'}:${eventId || transactionId || user?._id || Date.now()}`;

        return await sendEventMessage({
            key,
            type: isSuccess ? 'payment_success' : 'payment_failed',
            to: user?.phone || user?.mobile,
            template,
            vars: {
                name: user?.name || 'there',
                phone: user?.phone || user?.mobile || '',
                amount: amount !== undefined && amount !== null ? String(amount) : '',
                plan: plan || '',
                transactionId: transactionId || '',
                date: new Date().toISOString().split('T')[0]
            },
            connectionId: settings.connectionId
        });
    } catch (err) {
        console.error('[zyptos] sendPaymentStatusMessage error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendTextMessage,
    sendWelcomeMessage,
    sendMemberWelcome,
    sendPaymentStatusMessage,
    sendEventMessage,
    getSettings,
    renderTemplate,
    toE164
};
