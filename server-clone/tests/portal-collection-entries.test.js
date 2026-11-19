const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const farmer = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const otherOwner = 'cccccccccccccccccccccccc';
const id = n => n.toString(16).padStart(24, '0');
class ObjectId { constructor(v) { this.v = v; } toString() { return this.v; } }
const valueOf = v => v instanceof ObjectId ? String(v) : v instanceof Date ? v.getTime() : v;
function fieldMatch(actual, condition) {
    if (condition && typeof condition === 'object' && !(condition instanceof Date) && !(condition instanceof ObjectId)) {
        if ('$regex' in condition) return new RegExp(condition.$regex, condition.$options || '').test(String(actual || ''));
        if ('$in' in condition) return condition.$in.some(v => valueOf(v) === valueOf(actual));
        if ('$type' in condition && condition.$type === 'string' && typeof actual !== 'string') return false;
        if ('$gte' in condition && (actual == null || typeof valueOf(actual) !== typeof valueOf(condition.$gte) || valueOf(actual) < valueOf(condition.$gte))) return false;
        if ('$lt' in condition && (actual == null || typeof valueOf(actual) !== typeof valueOf(condition.$lt) || valueOf(actual) >= valueOf(condition.$lt))) return false;
        return true;
    }
    return condition === null ? actual == null : valueOf(actual) === valueOf(condition);
}
function match(row, query) {
    return Object.entries(query).every(([key, expected]) => {
        if (key === '$or') return expected.some(q => match(row, q));
        if (key === '$and') return expected.every(q => match(row, q));
        return fieldMatch(row[key], expected);
    });
}
const collection = (n, options = {}) => ({ _id: id(n), owner, purchaseFarmer: farmer, farmerCode: '1', date: new Date('2026-11-22T00:00:00.000Z'), shift: 'morning', quantity: 5, amount: 350, bonusAmount: 0, rate: 70, isPaid: false, ...options });
function fixture(rows, permitted = true) {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const identity = { availableModules: { collection: permitted, selling: false }, ownerNames: { [owner]: 'Dairy' }, collectionLinks: [{ owner, code: '1', allProfileIds: [farmer] }], sellingLinks: [] };
    const queries = [];
    const MilkCollection = { aggregate: async (pipeline) => {
        queries.push(pipeline);
        let items = rows.filter(row => match(row, pipeline[0].$match));
        if (pipeline[1].$group) return items.length ? [{ count: items.length, quantity: items.reduce((s, r) => s + Number(r.quantity || 0), 0), amount: items.reduce((s, r) => s + Number(r.amount || 0), 0), bonus: items.reduce((s, r) => s + Number(r.bonusAmount || 0), 0) }] : [];
        items = items.map(r => ({ ...r, _portalDate: r.date == null || Number.isNaN(new Date(r.date).getTime()) ? null : new Date(r.date) }));
        const cursorMatch = pipeline.find((stage, index) => index > 0 && stage.$match);
        if (cursorMatch) items = items.filter(r => match(r, cursorMatch.$match));
        items.sort((a, b) => ((b._portalDate?.getTime() ?? -Infinity) - (a._portalDate?.getTime() ?? -Infinity)) || String(b._id).localeCompare(String(a._id)));
        return items.slice(0, 61);
    } };
    const deps = { express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': MilkCollection, '../models/Payment': {}, '../models/Advance': {}, '../models/SellingEntry': {}, '../models/MemberPayment': {}, '../models/SellingAdvance': {},
        '../middleware/portal-auth': () => {}, '../lib/portalIdentity': { findPortalProfiles: async () => identity, publicPortalIdentity: () => ({}), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    return { queries, async request(query = {}) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['/collection-entries']({ portalPhone: '7489301982', query }, res);
        return res;
    } };
}

test('all records use scoped totals, weighted rate including bonus and saved paid status', async () => {
    const rows = [collection(1, { quantity: 5, amount: 375, bonusAmount: 25, bonusType: 'perLitre', bonusRate: 5, isPaid: true }), collection(2, { quantity: 10, amount: 700 }), collection(3, { owner: otherOwner, amount: 10000 }), collection(4, { purchaseFarmer: 'dddddddddddddddddddddddd', farmerCode: 'other', amount: 20000 })];
    const response = await fixture(rows).request();
    assert.equal(response.statusCode, 200);
    const data = response.body.response;
    assert.equal(data.summary.count, 2);
    assert.equal(data.summary.quantity, 15);
    assert.equal(data.summary.amount, 1075);
    assert.equal(data.summary.bonus, 25);
    assert.equal(data.summary.avgRate, 71.67);
    assert.equal(data.entries.find(r => r.id === id(1)).status, 'Paid');
    assert.equal(data.entries.find(r => r.id === id(2)).status, 'Pending');
    assert.equal(rows.length, 4);
});

test('inclusive local date range covers both shifts and legacy string dates', async () => {
    const rows = [collection(1, { date: new Date('2026-11-20T18:30:00Z'), shift: 'morning' }), collection(2, { date: new Date('2026-11-22T18:29:59Z'), shift: 'evening' }), collection(3, { date: new Date('2026-11-22T18:30:00Z') }), collection(4, { date: '2026-11-22' }), collection(5, { date: '2026-11-23' })];
    const data = (await fixture(rows).request({ startDate: '2026-11-21', endDate: '2026-11-22', tzOffsetMinutes: '330' })).body.response;
    assert.equal(data.summary.count, 3);
    assert.deepEqual(Array.from(data.entries, r => r.id).sort(), [id(1), id(2), id(4)].sort());
});

test('paging is stable with matching dates, null dates and more than 120 records', async () => {
    const rows = Array.from({ length: 125 }, (_, i) => collection(i + 1, { date: i > 119 ? null : new Date('2026-11-22T00:00:00Z') }));
    const ctx = fixture(rows);
    let data = (await ctx.request()).body.response;
    assert.equal(data.summary.count, 125);
    const seen = [...data.entries];
    while (data.nextCursor) {
        data = (await ctx.request(data.nextCursor)).body.response;
        seen.push(...data.entries);
    }
    assert.equal(seen.length, 125);
    assert.equal(new Set(seen.map(r => r.id)).size, 125);
});

test('one-sided dates, empty results and invalid/unlinked requests fail safely', async () => {
    let ctx = fixture([collection(1), collection(2, { date: new Date('2026-11-23T00:00:00Z') })]);
    assert.equal((await ctx.request({ startDate: '2026-11-23', tzOffsetMinutes: '330' })).body.response.summary.count, 1);
    assert.equal((await ctx.request({ endDate: '2026-11-20', tzOffsetMinutes: '330' })).body.response.summary.count, 0);
    assert.equal((await ctx.request({ startDate: '2026-02-30' })).statusCode, 400);
    assert.equal((await ctx.request({ startDate: '2026-11-23', endDate: '2026-11-22' })).statusCode, 400);
    assert.equal((await ctx.request({ date: 'not-date', id: id(1) })).statusCode, 400);
    ctx = fixture([], false);
    assert.equal((await ctx.request()).statusCode, 403);
});

test('collection report returns the saved bonus amount for per-litre and percent entries', async () => {
    const rows = [
        collection(1, { quantity: 5, amount: 375, bonusAmount: 25, bonusType: 'perLitre', bonusRate: 5 }),
        collection(2, { quantity: 1, amount: 77, bonusAmount: 7, bonusType: 'percent', bonusRate: 10 }),
        collection(3, { quantity: 1, amount: 70, bonusAmount: 0 }),
    ];
    const data = (await fixture(rows).request()).body.response;
    assert.equal(data.entries.find(row => row.id === id(1)).bonusAmount, 25);
    assert.equal(data.entries.find(row => row.id === id(2)).bonusAmount, 7);
    assert.equal(data.entries.find(row => row.id === id(3)).bonusAmount, 0);
    assert.equal(data.summary.bonus, 32);
    assert.equal(data.summary.amount, 522);
    assert.equal(rows[0].bonusRate, 5);
    assert.equal(rows[1].bonusRate, 10);
});
