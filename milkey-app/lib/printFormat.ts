/**
 * Print payload helpers for `react-native-thermal-printer` (DantSu engine).
 *
 * The library accepts a string payload using a tag-based formatting language:
 *   [L] left aligned
 *   [C] centered
 *   [R] right aligned
 *   <b>...</b>     bold
 *   <u>...</u>     underline
 *   <font size='big'|'tall'|'wide'|'normal'>...</font>
 *
 * Designed primarily for 58mm thermal printers (e.g. Shreyans SR588 / SR58B,
 * MTP-2, TVS, XPrinter, Rongta, Sunmi). 58mm prints with ~32 chars per line
 * in the default font.
 */

export const COLUMN_WIDTH_58 = 32;
export const COLUMN_WIDTH_80 = 48;

const NEW_LINE = '\n';

/** Sanitise text so DantSu tag parser doesn't get confused by stray brackets. */
function safe(text: string | number | undefined | null): string {
    if (text === undefined || text === null) return '';
    return String(text).replace(/[\[\]]/g, '');
}

/** Single horizontal separator line. */
export function line(width: number = COLUMN_WIDTH_58, char: string = '.'): string {
    return `[L]${char.repeat(width)}` + NEW_LINE;
}

/** Bold double separator line. */
export function doubleLine(width: number = COLUMN_WIDTH_58): string {
    return `[L]${'='.repeat(width)}` + NEW_LINE;
}

/** Centered title row, supports bold + double height via `big`. */
export function title(text: string, opts: { big?: boolean; bold?: boolean } = {}): string {
    const { big = true, bold = true } = opts;
    let inner = safe(text);
    if (bold) inner = `<b>${inner}</b>`;
    if (big) inner = `<font size='big'>${inner}</font>`;
    return `[C]${inner}` + NEW_LINE;
}

/** Centered header that keeps long dairy names on one row by avoiding big font. */
export function headerTitle(text: string, width: number = COLUMN_WIDTH_58): string {
    const value = safe(text).trim();
    if (!value) return '';
    const upper = value.toUpperCase();
    const useBig = upper.length <= Math.max(14, Math.floor(width * 0.55));
    const useWide = !useBig && upper.length <= Math.max(18, Math.floor(width * 0.75));
    let inner = `<b>${upper}</b>`;
    if (useBig) inner = `<font size='big'>${inner}</font>`;
    else if (useWide) inner = `<font size='wide'>${inner}</font>`;
    return `[C]${inner}` + NEW_LINE;
}

export interface ReceiptBrandingOptions {
    dairyName?: string;
    mobileNumber?: string;
    address?: string;
    showMobileOnReceipt?: boolean;
    width?: number;
}

/** Common thermal receipt top: Dairy name + optional address + mobile. */
export function brandedHeader(opts: ReceiptBrandingOptions = {}): string {
    const w = opts.width ?? COLUMN_WIDTH_58;
    let p = '';
    p += headerTitle(opts.dairyName || 'MILKEY DAIRY', w);
    if (opts.address) p += center(opts.address);
    if (opts.showMobileOnReceipt !== false && opts.mobileNumber) p += center('PH: ' + opts.mobileNumber);
    p += line(w);
    return p;
}

/**
 * Common thermal receipt bottom: a single closing note line.
 * The user-configured `extraInfo` is treated as the footer text and falls
 * back to "Thank You !" when empty, matching the Print Settings default.
 */
export function brandedFooter(extraInfo?: string, width: number = COLUMN_WIDTH_58): string {
    let p = line(width);
    const note = safe(extraInfo).trim() || 'Thank You !';
    p += center(note);
    p += feed(4);
    return p;
}

/** Centered normal-size line. */
export function center(text: string, opts: { bold?: boolean } = {}): string {
    const inner = opts.bold ? `<b>${safe(text)}</b>` : safe(text);
    return `[C]${inner}` + NEW_LINE;
}

/** Left aligned line. */
export function left(text: string, opts: { bold?: boolean } = {}): string {
    const inner = opts.bold ? `<b>${safe(text)}</b>` : safe(text);
    return `[L]${inner}` + NEW_LINE;
}

/**
 * Two-column row: left-justified label + right-justified value.
 * The DantSu library auto-aligns when both [L] and [R] are present on one line.
 */
export function twoCol(left: string, right: string, opts: { bold?: boolean } = {}): string {
    const l = opts.bold ? `<b>${safe(left)}</b>` : safe(left);
    const r = opts.bold ? `<b>${safe(right)}</b>` : safe(right);
    return `[L]${l}[R]${r}` + NEW_LINE;
}

/** Label + value row for names: uses the full line before wrapping continuation under the value. */
export function labelValueWrap(label: string, value: string, width: number = COLUMN_WIDTH_58): string {
    const prefix = `${safe(label).trim()} `;
    const text = safe(value).trim() || '-';
    const firstWidth = Math.max(1, width - prefix.length);
    const nextPrefix = ' '.repeat(prefix.length);
    const nextWidth = Math.max(1, width - nextPrefix.length);

    const takeChunk = (remaining: string, max: number): [string, string] => {
        if (remaining.length <= max) return [remaining, ''];
        const hard = remaining.slice(0, max + 1);
        const breakAt = hard.lastIndexOf(' ');
        if (breakAt > 0 && breakAt <= max) {
            return [remaining.slice(0, breakAt), remaining.slice(breakAt + 1).trimStart()];
        }
        return [remaining.slice(0, max), remaining.slice(max).trimStart()];
    };

    const lines: string[] = [];
    let rest = text;
    const [first, afterFirst] = takeChunk(rest, firstWidth);
    lines.push(`[L]${prefix}${first}`);
    rest = afterFirst;
    while (rest) {
        const [chunk, after] = takeChunk(rest, nextWidth);
        lines.push(`[L]${nextPrefix}${chunk}`);
        rest = after;
    }
    return lines.join(NEW_LINE) + NEW_LINE;
}

/** Three-column row: left + center + right. */
export function threeCol(c1: string, c2: string, c3: string, opts: { bold?: boolean } = {}): string {
    const a = opts.bold ? `<b>${safe(c1)}</b>` : safe(c1);
    const b = opts.bold ? `<b>${safe(c2)}</b>` : safe(c2);
    const c = opts.bold ? `<b>${safe(c3)}</b>` : safe(c3);
    return `[L]${a}[C]${b}[R]${c}` + NEW_LINE;
}

/** Append empty feed lines (for tear-off space). */
export function feed(lines: number = 3): string {
    return NEW_LINE.repeat(Math.max(0, lines));
}

/** ---------------------------------------------------------------- */
/** High-level builders                                                */
/** ---------------------------------------------------------------- */

export interface ReceiptOptions {
    dairyName?: string;
    ownerName?: string;
    mobile?: string;
    address?: string;
    farmerCode?: string;
    farmerName?: string;
    date?: string;
    shift?: string;
    quantity?: string | number;
    fat?: string | number;
    snf?: string | number;
    rate?: string | number;
    amount?: string | number;
    extraInfo?: string;
    width?: number;
}

/** Build a milk-collection receipt payload. */
export function buildReceiptPayload(opts: ReceiptOptions): string {
    const w = opts.width ?? COLUMN_WIDTH_58;
    // Lazy require to avoid circular import (printTranslations -> languageStore).
    const { getThermalSlipLabels } = require('./printTranslations') as typeof import('./printTranslations');
    const t = getThermalSlipLabels();
    let p = '';

    p += brandedHeader({ dairyName: opts.dairyName, address: opts.address, mobileNumber: opts.mobile, width: w });
    if (opts.ownerName) p += center(opts.ownerName);

    if (opts.farmerCode) p += twoCol(`${t.code}:`, String(opts.farmerCode));
    if (opts.farmerName) p += twoCol(`${t.name}:`, String(opts.farmerName));
    if (opts.date) p += twoCol(`${t.date}:`, String(opts.date));
    if (opts.shift) p += twoCol(`${t.shift}:`, String(opts.shift));

    p += line(w);

    if (opts.quantity !== undefined) p += twoCol(`${t.qty} (L):`, String(opts.quantity));
    if (opts.fat !== undefined) p += twoCol(`${t.fat}:`, String(opts.fat));
    if (opts.snf !== undefined) p += twoCol(`${t.snf}:`, String(opts.snf));
    if (opts.rate !== undefined) p += twoCol(`${t.rate}:`, String(opts.rate));

    p += line(w);

    if (opts.amount !== undefined) {
        p += twoCol(`${t.total}:`, 'Rs ' + String(opts.amount), { bold: true });
    }

    p += doubleLine(w);

    if (opts.extraInfo) p += center(opts.extraInfo);
    p += center(t.thankYou);
    p += feed(4);
    return p;
}

/** ---------------------------------------------------------------- */
/** HTML helpers (used by PDF / WebView slips/reports)                 */
/** ---------------------------------------------------------------- */

export interface HtmlBrandingSettings {
    dairyName?: string;
    address?: string;
    mobileNumber?: string;
    showMobileOnReceipt?: boolean;
    extraInfo?: string;
}

function escapeHtml(value: string | undefined | null): string {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * HTML branded header block (dairy name, address, mobile if enabled).
 * Use inside the <body> at the top of any printable HTML/PDF document.
 */
export function brandedHeaderHtml(settings: HtmlBrandingSettings | null | undefined, opts: { compact?: boolean } = {}): string {
    if (!settings) return '';
    const dairyName = escapeHtml((settings.dairyName || '').trim());
    const address = escapeHtml((settings.address || '').trim());
    const mobile = escapeHtml((settings.mobileNumber || '').trim());
    const showMobile = settings.showMobileOnReceipt !== false;
    const parts: string[] = [];
    if (dairyName) {
        parts.push(`<div style="text-align:center;font-weight:700;font-size:${opts.compact ? '14px' : '18px'};text-transform:uppercase;margin-bottom:4px;color:#22c55e;">${dairyName}</div>`);
    }
    if (address) {
        parts.push(`<div style="text-align:center;font-size:12px;color:#555;margin-bottom:2px;">${address}</div>`);
    }
    if (showMobile && mobile) {
        parts.push(`<div style="text-align:center;font-size:12px;color:#555;margin-bottom:6px;">📞 ${mobile}</div>`);
    }
    return parts.join('');
}

/**
 * HTML branded footer block (extra note + Thank You).
 * Use inside the <body> at the bottom of any printable HTML/PDF document.
 */
export function brandedFooterHtml(settings: HtmlBrandingSettings | null | undefined): string {
    if (!settings) return '';
    const note = escapeHtml((settings.extraInfo || '').trim() || 'Thank You !');
    const parts: string[] = [];
    if (note) {
        parts.push(`<div style="text-align:center;font-size:12px;color:#444;margin-top:14px;padding:8px;border-top:1px dashed #ccc;font-style:italic;">${note}</div>`);
    }
    return parts.join('');
}

/** Build a printer self-test payload. */
export function buildTestPayload(): string {
    const { getThermalSlipLabels } = require('./printTranslations') as typeof import('./printTranslations');
    const t = getThermalSlipLabels();
    let p = '';
    p += title('MILKEY');
    p += center(t.print + ' Test', { bold: true });
    p += line();
    p += twoCol(`${t.status}:`, 'Connected');
    p += twoCol('Width:', '58mm');
    p += twoCol('Protocol:', 'ESC/POS');
    p += line();
    p += center(t.thankYou);
    p += feed(3);
    return p;
}
