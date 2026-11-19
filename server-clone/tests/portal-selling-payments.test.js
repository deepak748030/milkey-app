const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const farmer = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const otherOwner = 'cccccccccccccccccccccccc';
const otherFarmer = 'dddddddddddddddddddddddd';
const id = n => n.toString(16).padStart(24, '0');
class ObjectId { constructor(v) { this.v = v; } toString() { return this.v; } }
const val = v => v instanceof ObjectId ? String(v) : v instanceof Date ? v.getTime() : v;
function matchesField(actual, expected) {
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof ObjectId)) {
        if ('$in' in expected) return expected.$in.some(v => val(v) === val(actual));
        if ('$lt' in expected) return actual != null && val(actual) < val(expected.$lt);
    }
    return expected === null ? actual == null : val(actual) === val(expected);
}
function match(row, query) {
    return Object.entries(query).every(([key, expected]) => {
        if (key === '$or') return expected.some(q => match(row, q));
        if (key === '$and') return expected.every(q => match(row, q));
        return matchesField(row[key], expected);
    });
}
const payment = (n, options = {}) => ({
    _id: id(n), owner, member: farmer, date: new Date('2026-11-22T00:00:00Z'),
    periodStart: new Date('2026-11-21T12:00:00Z'), periodEnd: new Date('2026-11-22T12:00:00Z'),
    paymentMethod: 'cash', amount: 1000, totalSellAmount: 575, advanceApplied: 55,
    netPayable: 624, closingBalance: -376, createdAt: new Date('2026-11-15T12:00:00Z'), ...options,
});
function fixture(rows, options = {}) {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const identity = {
        availableModules: { collection: false, selling: options.allowed !== false }, ownerNames: { [owner]: 'My Dairy' },
        collectionLinks: [], sellingLinks: [{ owner, memberIds: [farmer], memberDocs: [{ _id: farmer, name: 'Actual Customer' }] }],
    };
    const queries = [];
    const Payment = {
        countDocuments: async q => rows.filter(row => match(row, q)).length,
        aggregate: async pipeline => {
            queries.push(pipeline);
            let items = rows.filter(row => match(row, pipeline[0].$match));
            items = items.map(r => ({ ...r, _portalDate: r.date == null || Number.isNaN(new Date(r.date).getTime()) ? null : new Date(r.date) }));
            const cursor = pipeline.find((stage, i) => i > 0 && stage.$match);
            if (cursor) items = items.filter(row => match(row, cursor.$match));
            items.sort((a, b) => ((b._portalDate?.getTime() ?? -Infinity) - (a._portalDate?.getTime() ?? -Infinity)) || String(b._id).localeCompare(String(a._id)));
            return items.slice(0, 4);
        },
    };
    const deps = { express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': {}, '../models/Payment': {}, '../models/Advance': {}, '../models/SellingEntry': {}, '../models/MemberPayment': Payment, '../models/SellingAdvance': {},
        '../middleware/portal-auth': () => {}, '../lib/portalIdentity': { findPortalProfiles: async phone => { assert.equal(phone, '7489301982'); return identity; }, publicPortalIdentity: () => ({}), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    return { queries, async request(query = {}) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['/selling-payments']({ portalPhone: '7489301982', query }, res);
        return res;
    } };
}


test('selling payments use saved settlement values and exclude other owners and customers', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => payment(i + 1));
    rows.push(payment(20, { owner: otherOwner }), payment(21, { member: otherFarmer }));
    const data = (await fixture(rows).request({ owner: otherOwner, member: otherFarmer })).body.response;
    assert.equal(data.total, 5);
    assert.deepEqual(Array.from(data.payments, p => p.id), [id(5), id(4), id(3)]);
    assert.equal(data.payments[0].totalMilkAmount, 575);
    assert.equal(data.payments[0].totalAdvanceDeduction, 55);
    assert.equal(data.payments[0].netPayable, 624);
    assert.equal(data.payments[0].closingBalance, -376);
    assert.equal(data.payments[0].customerName, 'Actual Customer');
    assert.ok(data.nextCursor);
    assert.equal(rows.length, 7);
});
test('selling payment paging reaches all 127 records with identical and missing dates', async () => {
    const ctx = fixture(Array.from({ length: 127 }, (_, i) => payment(i + 1, { date: i > 119 ? null : new Date('2026-11-22T00:00:00Z') })));
    let data = (await ctx.request()).body.response;
    const ids = [];
    do { assert.equal(data.total, 127); assert.ok(data.payments.length <= 3); ids.push(...data.payments.map(p => p.id)); data = data.nextCursor ? (await ctx.request(data.nextCursor)).body.response : null; } while (data);
    assert.equal(ids.length, 127);
    assert.equal(new Set(ids).size, 127);
});
test('selling payments reject invalid or unlinked requests and support empty history', async () => {
    const ctx = fixture([]);
    assert.equal((await ctx.request()).body.response.total, 0);
    assert.equal((await ctx.request({ date: 'bad', id: id(1) })).statusCode, 400);
    assert.equal((await ctx.request({ date: '2026-11-22', id: 'bad' })).statusCode, 400);
    assert.equal((await fixture([], { allowed: false }).request()).statusCode, 403);
});
