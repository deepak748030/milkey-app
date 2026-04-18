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
export function line(width: number = COLUMN_WIDTH_58, char: string = '-'): string {
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
    let p = '';

    if (opts.dairyName) p += title(opts.dairyName);
    if (opts.ownerName) p += center(opts.ownerName);
    if (opts.mobile) p += center('Ph: ' + opts.mobile);
    if (opts.address) p += center(opts.address);

    p += doubleLine(w);

    if (opts.farmerCode) p += twoCol('Code:', String(opts.farmerCode));
    if (opts.farmerName) p += twoCol('Name:', String(opts.farmerName));
    if (opts.date) p += twoCol('Date:', String(opts.date));
    if (opts.shift) p += twoCol('Shift:', String(opts.shift));

    p += line(w);

    if (opts.quantity !== undefined) p += twoCol('Qty (L):', String(opts.quantity));
    if (opts.fat !== undefined) p += twoCol('Fat:', String(opts.fat));
    if (opts.snf !== undefined) p += twoCol('SNF:', String(opts.snf));
    if (opts.rate !== undefined) p += twoCol('Rate:', String(opts.rate));

    p += line(w);

    if (opts.amount !== undefined) {
        p += twoCol('TOTAL:', 'Rs ' + String(opts.amount), { bold: true });
    }

    p += doubleLine(w);

    if (opts.extraInfo) p += center(opts.extraInfo);
    p += center('Thank You!');
    p += feed(4);
    return p;
}

/** Build a printer self-test payload. */
export function buildTestPayload(): string {
    let p = '';
    p += title('MILKEY');
    p += center('Printer Test', { bold: true });
    p += line();
    p += twoCol('Status:', 'Connected');
    p += twoCol('Width:', '58mm');
    p += twoCol('Protocol:', 'ESC/POS');
    p += line();
    p += center('Printer is working!');
    p += feed(3);
    return p;
}
