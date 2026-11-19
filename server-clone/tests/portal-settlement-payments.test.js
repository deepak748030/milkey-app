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
    _id: id(n), owner, farmer, date: new Date('2026-11-22T00:00:00Z'),
    periodStart: new Date('2026-11-21T12:00:00Z'), periodEnd: new Date('2026-11-22T12:00:00Z'),
    paymentMethod: 'cash', amount: 1000, totalMilkAmount: 575, totalAdvanceDeduction: 0,
    netPayable: 624, closingBalance: -376, createdAt: new Date('2026-11-15T12:00:00Z'), ...options,
});
function fixture(rows, options = {}) {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const identity = {
        availableModules: { collection: options.allowed !== false, selling: false }, ownerNames: { [owner]: 'My Dairy' },
        collectionLinks: [{ owner, code: '1', name: 'Actual Farmer', farmerIds: [farmer], allProfileIds: [farmer], farmerDocs: [{ _id: farmer, name: 'Actual Farmer' }] }], sellingLinks: [],
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
        '../models/MilkCollection': {}, '../models/Payment': Payment, '../models/Advance': {}, '../models/SellingEntry': {}, '../models/MemberPayment': {}, '../models/SellingAdvance': {},
        '../middleware/portal-auth': () => {}, '../lib/portalIdentity': { findPortalProfiles: async phone => { assert.equal(phone, '7489301982'); return identity; }, publicPortalIdentity: () => ({}), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    return { queries, async request(query = {}) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['/collection-payments']({ portalPhone: '7489301982', query }, res);
        return res;
    } };
}

test('first page contains only latest three scoped payments and saved settlement values', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => payment(i + 1));
    rows.push(payment(20, { owner: otherOwner }), payment(21, { farmer: otherFarmer }));
    const ctx = fixture(rows);
    const res = await ctx.request({ owner: otherOwner, farmer: otherFarmer });
    assert.equal(res.statusCode, 200);
    const data = res.body.response;
    assert.equal(data.total, 7);
    assert.deepEqual(Array.from(data.payments, p => p.id), [id(7), id(6), id(5)]);
    assert.equal(data.payments[0].totalMilkAmount, 575);
    assert.equal(data.payments[0].netPayable, 624);
    assert.equal(data.payments[0].closingBalance, -376);
    assert.equal(data.payments[0].farmerName, 'Actual Farmer');
    assert.equal(data.payments[0].dairyName, 'My Dairy');
    assert.equal(data.payments[0].periodEnd, '2026-11-22T12:00:00.000Z');
    assert.equal(rows.length, 9);
    assert.equal(rows[6].closingBalance, -376);
    assert.ok(data.nextCursor);
});

test('load more pages three at a time without duplicates on equal or null dates', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => payment(i + 1, { date: i > 4 ? null : new Date('2026-11-22T00:00:00Z') }));
    const ctx = fixture(rows);
    let data = (await ctx.request()).body.response;
    const seen = [...data.payments];
    assert.equal(data.payments.length, 3);
    data = (await ctx.request(data.nextCursor)).body.response;
    assert.equal(data.payments.length, 3);
    assert.equal(data.nextCursor.date, 'none');
    seen.push(...data.payments);
    data = (await ctx.request(data.nextCursor)).body.response;
    assert.equal(data.payments.length, 2);
    assert.equal(data.nextCursor, null);
    seen.push(...data.payments);
    assert.equal(new Set(seen.map(p => p.id)).size, 8);
});

test('empty history, bad cursor and unlinked users are handled without writes', async () => {
    let ctx = fixture([]);
    const empty = await ctx.request();
    assert.equal(empty.body.response.total, 0);
    assert.equal(empty.body.response.payments.length, 0);
    assert.equal(empty.body.response.nextCursor, null);
    assert.equal((await ctx.request({ date: 'not-date', id: id(1) })).statusCode, 400);
    assert.equal((await ctx.request({ date: '2026-11-22', id: 'bad' })).statusCode, 400);
    assert.equal((await ctx.request({ date: '2026-11-22' })).statusCode, 400);
    assert.equal((await ctx.request({ id: id(1) })).statusCode, 400);
    ctx = fixture([payment(1)], { allowed: false });
    assert.equal((await ctx.request()).statusCode, 403);
});

test('mixed legacy date formats are normalized for stable pagination', async () => {
    const rows = [payment(1, { date: '2026-11-22' }), payment(2, { date: new Date('2026-11-23T00:00:00Z') }), payment(3, { date: new Date('2026-11-21T00:00:00Z') }), payment(4, { date: null })];
    const ctx = fixture(rows);
    let data = (await ctx.request()).body.response;
    assert.deepEqual(Array.from(data.payments, p => p.id), [id(2), id(1), id(3)]);
    data = (await ctx.request(data.nextCursor)).body.response;
    assert.deepEqual(Array.from(data.payments, p => p.id), [id(4)]);
});

test('history beyond dashboard limits is reachable across all pages', async () => {
    const ctx = fixture(Array.from({ length: 127 }, (_, i) => payment(i + 1)));
    let cursor;
    const ids = [];
    do {
        const response = await ctx.request(cursor || {});
        assert.equal(response.statusCode, 200);
        const page = response.body.response;
        assert.equal(page.total, 127);
        assert.ok(page.payments.length <= 3);
        ids.push(...page.payments.map(row => row.id));
        cursor = page.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 127);
    assert.equal(new Set(ids).size, 127);
    assert.equal(ids[0], id(127));
    assert.equal(ids.at(-1), id(1));
});


test('collection portal returns the saved split without inventing it for older payments', async () => {
    const ctx = fixture([payment(1), payment(2, { entriesAmount: 690, extraMilkAmount: 0, totalMilkAmount: 690 })]);
    const res = await ctx.request();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.response.payments[0].entriesAmount, 690);
    assert.equal(res.body.response.payments[0].extraMilkAmount, 0);
    assert.equal(res.body.response.payments[1].entriesAmount, null);
    assert.equal(res.body.response.payments[1].extraMilkAmount, null);
    const projection = ctx.queries[0].find(stage => stage.$project).$project;
    assert.equal(projection.entriesAmount, 1);
    assert.equal(projection.extraMilkAmount, 1);
    assert.equal(projection.collectionSnapshots, undefined);
});
