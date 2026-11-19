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
const entry = (n, options = {}) => ({ _id: id(n), owner, member: farmer, date: new Date('2026-11-22T00:00:00.000Z'), morningQuantity: 5, eveningQuantity: 2, amount: 350, rate: 50, isPaid: false, ...options });
function fixture(rows, permitted = true) {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const identity = { availableModules: { collection: false, selling: permitted }, ownerNames: { [owner]: 'Dairy' }, collectionLinks: [], sellingLinks: [{ owner, memberIds: [farmer], memberDocs: [{ _id: farmer, name: 'Customer' }] }] };
    const queries = [];
    const MilkCollection = { aggregate: async (pipeline) => {
        queries.push(pipeline);
        let items = rows.filter(row => match(row, pipeline[0].$match));
        if (pipeline[1].$group) return items.length ? [{ count: items.length, quantity: items.reduce((s, r) => s + (Number(r.morningQuantity || 0) + Number(r.eveningQuantity || 0)), 0), amount: items.reduce((s, r) => s + Number(r.amount || 0), 0), bonus: items.reduce((s, r) => s + Number(r.bonusAmount || 0), 0) }] : [];
        items = items.map(r => ({ ...r, _portalDate: r.date == null || Number.isNaN(new Date(r.date).getTime()) ? null : new Date(r.date) }));
        const cursorMatch = pipeline.find((stage, index) => index > 0 && stage.$match);
        if (cursorMatch) items = items.filter(r => match(r, cursorMatch.$match));
        items.sort((a, b) => ((b._portalDate?.getTime() ?? -Infinity) - (a._portalDate?.getTime() ?? -Infinity)) || String(b._id).localeCompare(String(a._id)));
        return items.slice(0, 61);
    } };
    const deps = { express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': {}, '../models/Payment': {}, '../models/Advance': {}, '../models/SellingEntry': MilkCollection, '../models/MemberPayment': {}, '../models/SellingAdvance': {},
        '../middleware/portal-auth': () => {}, '../lib/portalIdentity': { findPortalProfiles: async () => identity, publicPortalIdentity: () => ({}), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    return { queries, async request(query = {}) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['/selling-entries']({ portalPhone: '7489301982', query }, res);
        return res;
    } };
}


test('selling entries are scoped and include both shifts, saved paid status and full totals', async () => {
    const data = (await fixture([entry(1, { morningQuantity: 5.125, eveningQuantity: 5, isPaid: true }), entry(2, { morningQuantity: 0, eveningQuantity: 3 }), entry(3, { owner: otherOwner }), entry(4, { member: 'dddddddddddddddddddddddd' })]).request()).body.response;
    assert.equal(data.summary.count, 2);
    assert.equal(data.summary.quantity, 13.125);
    assert.equal(data.summary.amount, 700);
    assert.equal(data.entries.find(r => r.id === id(1)).status, 'Paid');
    assert.equal(data.entries.find(r => r.id === id(1)).morningQuantity, 5.125);
    assert.equal(data.entries.find(r => r.id === id(1)).eveningQuantity, 5);
    assert.equal(data.entries.find(r => r.id === id(2)).status, 'Pending');
    assert.equal(data.entries.find(r => r.id === id(1)).customerName, 'Customer');
});
test('selling UTC calendar date range and legacy string date', async () => {
    const data = (await fixture([entry(1, { date: new Date('2026-11-21T00:00:00Z') }), entry(2, { date: '2026-11-22' }), entry(3, { date: new Date('2026-11-23T00:00:00Z') })]).request({ startDate: '2026-11-21', endDate: '2026-11-22', tzOffsetMinutes: '330' })).body.response;
    assert.equal(data.summary.count, 2);
    assert.deepEqual(Array.from(data.entries, r => r.id).sort(), [id(1), id(2)]);
});
test('selling entries paging is stable beyond 120 records including null dates', async () => {
    const ctx = fixture(Array.from({ length: 125 }, (_, i) => entry(i + 1, { date: i > 119 ? null : new Date('2026-11-22T00:00:00Z') })));
    let data = (await ctx.request()).body.response;
    const ids = [];
    do { ids.push(...data.entries.map(e => e.id)); data = data.nextCursor ? (await ctx.request(data.nextCursor)).body.response : null; } while (data);
    assert.equal(ids.length, 125);
    assert.equal(new Set(ids).size, 125);
});
test('selling entries reject invalid dates and cursors and require linked module', async () => {
    const ctx = fixture([]);
    assert.equal((await ctx.request({ startDate: '2026-02-30' })).statusCode, 400);
    assert.equal((await ctx.request({ startDate: '2026-11-23', endDate: '2026-11-22' })).statusCode, 400);
    assert.equal((await ctx.request({ date: 'invalid', id: id(1) })).statusCode, 400);
    assert.equal((await fixture([], false).request()).statusCode, 403);
});

test('selling dashboard exposes shift quantities, paid flag and stored payment details', async () => {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const identity = { availableModules: { collection: false, selling: true }, ownerNames: { [owner]: 'Dairy' }, collectionLinks: [], sellingLinks: [{ owner, memberIds: [farmer], memberDocs: [] }] };
    const chain = rows => ({ populate() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return rows; } });
    const sellingRows = [entry(1, { morningQuantity: 5.125, eveningQuantity: 3.25, isPaid: true }), entry(2, { morningQuantity: 0, eveningQuantity: 1, isPaid: false })];
    const sellingEntry = { find: () => chain(sellingRows), aggregate: async () => [{ all: [{}], today: [{}] }] };
    const memberPayment = { find: () => chain([{ _id: id(3), owner, member: farmer, date: new Date('2026-11-22'), totalSellAmount: 400, advanceApplied: 80, netPayable: 320, amount: 150, closingBalance: 170, periodStart: new Date('2026-11-01'), periodEnd: new Date('2026-11-21') }]) };
    const advances = { find: () => chain([]), countDocuments: async () => 0, aggregate: async () => [] };
    const deps = { express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) }, '../models/MilkCollection': {}, '../models/Payment': {}, '../models/Advance': {}, '../models/SellingEntry': sellingEntry, '../models/MemberPayment': memberPayment, '../models/SellingAdvance': advances, '../middleware/portal-auth': () => {}, '../lib/portalIdentity': { findPortalProfiles: async () => identity, publicPortalIdentity: () => ({ name: 'Customer', availableModules: ['selling'] }), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
    await handlers['/dashboard']({ portalPhone: '7489301982', query: { module: 'selling' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.response.entries[0].morningQuantity, 5.125);
    assert.equal(res.body.response.entries[0].eveningQuantity, 3.25);
    assert.equal(res.body.response.entries[0].status, 'Paid');
    assert.equal(res.body.response.entries[1].status, 'Pending');
    assert.equal(res.body.response.payments[0].totalMilkAmount, 400);
    assert.equal(res.body.response.payments[0].totalAdvanceDeduction, 80);
    assert.equal(res.body.response.payments[0].netPayable, 320);
    assert.equal(res.body.response.payments[0].closingBalance, 170);
});
