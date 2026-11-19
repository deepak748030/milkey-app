// Values in a saved split are snapshots, not a reconstruction from entries that
// may have been edited or deleted after settlement.
const cents = (value) => {
    if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && value.trim() === '')) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || Math.abs(number * 100 - Math.round(number * 100)) > 1e-6) return null;
    const result = Math.round(number * 100);
    return Number.isSafeInteger(result) ? result : null;
};

const localDayStart = (key, offset) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match || !Number.isInteger(offset) || offset < -720 || offset > 840) return null;
    const utc = Date.UTC(+match[1], +match[2] - 1, +match[3]);
    if (new Date(utc).toISOString().slice(0, 10) !== key) return null;
    return new Date(utc - offset * 60000);
};

const createSplit = (rows, expectedEntries, extra, total) => {
    const entryCents = rows.reduce((sum, row) => {
        const amount = cents(row.amount);
        return sum === null || amount === null ? null : sum + amount;
    }, 0);
    const expectedCents = cents(expectedEntries);
    const extraCents = cents(extra);
    const totalCents = cents(total);
    if (entryCents === null || !Number.isSafeInteger(entryCents) || expectedCents === null || extraCents === null || totalCents === null || totalCents < 0 || entryCents !== expectedCents || entryCents + extraCents !== totalCents) return null;
    return { entriesAmount: entryCents / 100, extraMilkAmount: extraCents / 100 };
};
module.exports = { cents, localDayStart, createSplit };
