/**
 * ESC/POS command helpers for 58mm thermal printers (e.g. Shreyans SRS58B)
 * Works with BLE printers that accept raw ESC/POS bytes
 */

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Initialize printer
export const INIT = new Uint8Array([ESC, 0x40]);

// Text alignment
export const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
export const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
export const ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 0x02]);

// Text style
export const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
export const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
export const DOUBLE_HEIGHT_ON = new Uint8Array([GS, 0x21, 0x01]);
export const DOUBLE_WIDTH_ON = new Uint8Array([GS, 0x21, 0x10]);
export const DOUBLE_ON = new Uint8Array([GS, 0x21, 0x11]);
export const NORMAL_SIZE = new Uint8Array([GS, 0x21, 0x00]);

// Underline
export const UNDERLINE_ON = new Uint8Array([ESC, 0x2D, 0x01]);
export const UNDERLINE_OFF = new Uint8Array([ESC, 0x2D, 0x00]);

// Line feed
export const FEED_LINE = new Uint8Array([LF]);
export const FEED_3_LINES = new Uint8Array([ESC, 0x64, 0x03]);
export const FEED_5_LINES = new Uint8Array([ESC, 0x64, 0x05]);

// Cut paper (if supported)
export const CUT_PAPER = new Uint8Array([GS, 0x56, 0x00]);
export const PARTIAL_CUT = new Uint8Array([GS, 0x56, 0x01]);

// Separator line for 58mm (32 chars)
const LINE_WIDTH = 32;

export function textToBytes(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
}

export function lineFeed(count: number = 1): Uint8Array {
    return new Uint8Array(Array(count).fill(LF));
}

export function separator(char: string = '-'): Uint8Array {
    return textToBytes(char.repeat(LINE_WIDTH) + '\n');
}

export function doubleSeparator(): Uint8Array {
    return textToBytes('='.repeat(LINE_WIDTH) + '\n');
}

/** Pad text to fit columns: left-aligned text + right-aligned value */
export function twoColumnLine(left: string, right: string, width: number = LINE_WIDTH): string {
    const space = width - left.length - right.length;
    if (space <= 0) return left.substring(0, width - right.length - 1) + ' ' + right + '\n';
    return left + ' '.repeat(space) + right + '\n';
}

/** Three column line */
export function threeColumnLine(col1: string, col2: string, col3: string, width: number = LINE_WIDTH): string {
    const colW = Math.floor(width / 3);
    const c1 = col1.padEnd(colW);
    const c2 = col2.padEnd(colW);
    const c3 = col3.padStart(width - colW * 2);
    return c1 + c2 + c3 + '\n';
}

/** Concatenate multiple Uint8Arrays */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

/** Convert Uint8Array to Base64 string (for BLE writeCharacteristicWithResponseForService) */
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    // Use btoa if available, otherwise manual
    if (typeof btoa === 'function') {
        return btoa(binary);
    }
    // Manual base64 for React Native
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    while (i < binary.length) {
        const a = binary.charCodeAt(i++);
        const b = i < binary.length ? binary.charCodeAt(i++) : 0;
        const c = i < binary.length ? binary.charCodeAt(i++) : 0;
        const triplet = (a << 16) | (b << 8) | c;
        result += chars[(triplet >> 18) & 0x3F];
        result += chars[(triplet >> 12) & 0x3F];
        result += i - 2 < binary.length ? chars[(triplet >> 6) & 0x3F] : '=';
        result += i - 1 < binary.length ? chars[triplet & 0x3F] : '=';
    }
    return result;
}

/**
 * Build a simple receipt as ESC/POS bytes
 */
export function buildReceiptBytes(options: {
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
}): Uint8Array {
    const parts: Uint8Array[] = [INIT];

    // Header
    parts.push(ALIGN_CENTER, BOLD_ON, DOUBLE_ON);
    if (options.dairyName) parts.push(textToBytes(options.dairyName + '\n'));
    parts.push(NORMAL_SIZE, BOLD_OFF);
    if (options.ownerName) parts.push(textToBytes(options.ownerName + '\n'));
    if (options.mobile) parts.push(textToBytes('Ph: ' + options.mobile + '\n'));
    if (options.address) parts.push(textToBytes(options.address + '\n'));

    parts.push(ALIGN_LEFT);
    parts.push(doubleSeparator());

    // Details
    if (options.farmerCode) parts.push(textToBytes(twoColumnLine('Code:', options.farmerCode)));
    if (options.farmerName) parts.push(textToBytes(twoColumnLine('Name:', options.farmerName)));
    if (options.date) parts.push(textToBytes(twoColumnLine('Date:', options.date)));
    if (options.shift) parts.push(textToBytes(twoColumnLine('Shift:', options.shift)));

    parts.push(separator());

    if (options.quantity) parts.push(textToBytes(twoColumnLine('Qty (L):', String(options.quantity))));
    if (options.fat) parts.push(textToBytes(twoColumnLine('Fat:', String(options.fat))));
    if (options.snf) parts.push(textToBytes(twoColumnLine('SNF:', String(options.snf))));
    if (options.rate) parts.push(textToBytes(twoColumnLine('Rate:', String(options.rate))));

    parts.push(separator());

    // Total
    if (options.amount) {
        parts.push(BOLD_ON);
        parts.push(textToBytes(twoColumnLine('TOTAL:', '₹' + String(options.amount))));
        parts.push(BOLD_OFF);
    }

    parts.push(doubleSeparator());

    // Footer
    if (options.extraInfo) {
        parts.push(ALIGN_CENTER);
        parts.push(textToBytes(options.extraInfo + '\n'));
    }

    parts.push(ALIGN_CENTER);
    parts.push(textToBytes('Thank You!\n'));
    parts.push(FEED_5_LINES);

    return concatBytes(...parts);
}

/** Build a simple test print */
export function buildTestPrint(): Uint8Array {
    return concatBytes(
        INIT,
        ALIGN_CENTER,
        BOLD_ON, DOUBLE_ON,
        textToBytes('MILKEY\n'),
        NORMAL_SIZE, BOLD_OFF,
        textToBytes('Printer Test\n'),
        separator(),
        ALIGN_LEFT,
        textToBytes(twoColumnLine('Status:', 'Connected')),
        textToBytes(twoColumnLine('Width:', '58mm')),
        textToBytes(twoColumnLine('Protocol:', 'ESC/POS')),
        separator(),
        ALIGN_CENTER,
        textToBytes('Printer is working!\n'),
        FEED_3_LINES,
    );
}
