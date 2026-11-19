// Normalize common Indian dialling prefixes and formatting without changing
// existing stored customer numbers. Other digit lengths remain distinct.
function normalizeSellingMobile(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value).trim();
    if (!text || !/^[+\d\s().-]+$/.test(text)) return null;
    let digits = text.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3);
    else if (digits.length === 14 && digits.startsWith('0091')) digits = digits.slice(4);
    else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return digits;
}

// Match historic formatted numbers without migrating any customer documents.
function sellingMobilePattern(normalized) {
    const separator = '[\\s().+\\-]*';
    const digits = normalized.split('').join(separator);
    const prefix = normalized.length === 10
        ? `(?:0${separator}(?:0${separator})?9${separator}1${separator}|0${separator}|\\+?9${separator}1${separator})?`
        : '\\+?';
    return new RegExp(`^${separator}${prefix}${digits}${separator}$`);
}

module.exports = { normalizeSellingMobile, sellingMobilePattern };
