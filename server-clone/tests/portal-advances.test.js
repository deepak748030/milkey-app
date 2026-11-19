const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const farmer = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const otherOwner = 'cccccccccccccccccccccccc';
const id = n => n.toString(16).padStart(24, '0');
class ObjectId { constructor(value) { this.value = value; } toString() { return this.value; } }
const asValue = v => v instanceof ObjectId ? String(v) : v instanceof Date ? v.getTime() : v;
function condition(value, expected) {
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !(expected instanceof ObjectId)) {
        if ('$in' in expected) return expected.$in.some(v => asValue(value) === asValue(v));
        if ('$ne' in expected) return asValue(value) !== asValue(expected.$ne);
        if ('$lt' in expected) return value != null && asValue(value) < asValue(expected.$lt);
    }
    return expected === null ? value == null : asValue(value) === asValue(expected);
}
function matches(doc, query) {
    return Object.entries(query).every(([key, value]) => {
        if (key === '$or') return value.some(q => matches(doc, q));
        if (key === '$and') return value.every(q => matches(doc, q));
        return condition(doc[key], value);
    });
}
function fixture(docs, allowCollection = true, milkRows = []) {
    const handlers = {};
    const router = { use() {} };
    router.get = (path, ...args) => { handlers[path] = args.at(-1); };
    const identity = {
        availableModules: { collection: allowCollection, selling: true },
        collectionLinks: [{ owner, code: '1', farmerIds: [farmer], allProfileIds: [farmer], farmerDocs: [{ _id: farmer, currentBalance: 0 }] }],
        sellingLinks: [], ownerNames: { [owner]: 'My Dairy' },
    };
    let queries = [];
    const Advance = {
        find(q) {
            queries.push(q);
            let limit = 0;
            return {
                populate() { return this; }, sort() { return this; }, limit(n) { limit = n; return this; },
                async lean() {
                    return docs.filter(d => matches(d, q)).sort((a, b) => {
                        const d = (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity);
                        return d || String(b._id).localeCompare(String(a._id));
                    }).slice(0, limit).map(d => ({ ...d, farmer: { _id: d.farmer, name: d.farmer === farmer ? 'Actual Farmer' : 'Other' } }));
                },
            };
        },
        countDocuments: async q => docs.filter(d => matches(d, q)).length,
        aggregate: async pipeline => {
            const rows = docs.filter(d => matches(d, pipeline[0].$match));
            return [{ total: rows.reduce((n, d) => n + Math.max(0, (d.amount || 0) - (d.settledAmount || 0)), 0) }];
        },
    };
    const emptyQuery = () => ({ populate() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return []; } });
    const empty = { find: emptyQuery, aggregate: async () => [] };
    const deps = {
        express: { Router: () => router },
        mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': { ...empty, find: () => ({ populate() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return milkRows; } }) }, '../models/Payment': empty, '../models/Advance': Advance,
        '../models/SellingEntry': empty, '../models/MemberPayment': empty, '../models/SellingAdvance': empty,
        '../middleware/portal-auth': () => {},
        '../lib/portalIdentity': {
            findPortalProfiles: async () => identity,
            publicPortalIdentity: () => ({ name: 'First Profile', availableModules: ['collection', 'selling'] }),
            toId: v => v ? String(v) : '', escapeRegExp: v => String(v),
        },
    };
    const code = fs.readFileSync(require.resolve('../routes/portal'), 'utf8');
    vm.runInNewContext(code, { require: n => { if (!(n in deps)) throw Error(n); return deps[n]; }, module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    const request = async (path, query) => {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers[path]({ portalPhone: '7489301982', query }, res);
        return res;
    };
    return { request, queries };
}
const row = (n, opts = {}) => ({ _id: id(n), owner, farmer, amount: 10, settledAmount: 0, status: 'pending', date: new Date('2026-11-17T00:00:00Z'), ...opts });

test('collection portal matches dairy pending list, preserves settled data and scopes every row', async () => {
    const docs = [row(1, { amount: 545, note: 'Vese hi' }), row(2, { status: 'settled', settledAmount: 10 }), row(3, { status: 'partial', amount: 30, settledAmount: 10 }), row(4, { isDeleted: true }), row(5, { owner: otherOwner })];
    const { request } = fixture(docs);
    const res = await request('/dashboard', { module: 'collection', tzOffsetMinutes: '330' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.response.advances.length, 1);
    assert.equal(res.body.response.advances[0].amount, 545);
    assert.equal(res.body.response.advances[0].farmerName, 'Actual Farmer');
    assert.equal(res.body.response.advancePage.total, 1);
    assert.equal(res.body.response.summary.advancePending, 565); // includes partial remaining
    assert.equal(docs.length, 5);
    assert.equal(docs[1].status, 'settled');
});

test('advance pagination and totals do not truncate at 120 and cannot leak another owner', async () => {
    const docs = Array.from({ length: 125 }, (_, i) => row(i + 1));
    docs.push(row(200, { date: null }), row(201, { owner: otherOwner }));
    const { request } = fixture(docs);
    const first = (await request('/dashboard', { module: 'collection' })).body.response;
    assert.equal(first.advancePage.total, 126);
    assert.equal(first.advances.length, 120);
    assert.equal(first.summary.advancePending, 1260);
    const second = (await request('/advances', { module: 'collection', ...first.advancePage.nextCursor })).body.response;
    assert.equal(second.advances.length, 6);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.advances, ...second.advances].map(a => a.id)).size, 126);
    assert.ok(!second.advances.some(a => a.id === id(201)));
});

test('invalid or unauthorized advance cursor is rejected', async () => {
    let ctx = fixture([]);
    assert.equal((await ctx.request('/advances', { module: 'collection', date: 'nope', id: id(1) })).statusCode, 400);
    assert.equal((await ctx.request('/advances', { module: 'collection', date: '2026-11-17', id: 'bad' })).statusCode, 400);
    ctx = fixture([], false);
    assert.equal((await ctx.request('/advances', { module: 'collection', date: '2026-11-17', id: id(1) })).statusCode, 403);
});

test('null-date legacy rows continue across cursor pages', async () => {
    const docs = Array.from({ length: 125 }, (_, i) => row(i + 1, { date: null }));
    const { request } = fixture(docs);
    const first = (await request('/dashboard', { module: 'collection' })).body.response;
    assert.equal(first.advancePage.nextCursor.date, 'none');
    const second = (await request('/advances', { module: 'collection', ...first.advancePage.nextCursor })).body.response;
    assert.equal(second.advances.length, 5);
    assert.equal(new Set([...first.advances, ...second.advances].map(a => a.id)).size, 125);
});

test('selling portal retains settled history and computes pending per customer, not across customers', async () => {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const member1 = 'dddddddddddddddddddddddd';
    const member2 = 'eeeeeeeeeeeeeeeeeeeeeeee';
    const identity = {
        availableModules: { collection: false, selling: true }, ownerNames: { [owner]: 'Dairy' },
        collectionLinks: [], sellingLinks: [{ owner, memberIds: [member1, member2], memberDocs: [] }],
    };
    const chain = data => ({ populate() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return data; } });
    const empty = { find: () => chain([]), aggregate: async () => [] };
    let aggregateMatch;
    const selling = {
        find: () => chain([
            { _id: id(1), owner, member: { _id: member1, name: 'Customer One' }, type: 'adjusted', status: 'settled', amount: 100 },
            { _id: id(2), owner, member: { _id: member2, name: 'Customer Two' }, type: 'given', status: 'pending', amount: 200 },
        ]),
        countDocuments: async () => 2,
        aggregate: async pipeline => { aggregateMatch = pipeline[0].$match; return [{ given: 0, adjusted: 100 }, { given: 200, adjusted: 0 }]; },
    };
    const deps = {
        express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': empty, '../models/Payment': empty, '../models/Advance': empty,
        '../models/SellingEntry': empty, '../models/MemberPayment': empty, '../models/SellingAdvance': selling,
        '../middleware/portal-auth': () => {},
        '../lib/portalIdentity': { findPortalProfiles: async () => identity, publicPortalIdentity: () => ({ name: 'First', availableModules: ['selling'] }), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) },
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
    await handlers['/dashboard']({ portalPhone: '7489301982', query: { module: 'selling' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.response.summary.advancePending, 200);
    assert.equal(res.body.response.advances[0].type, 'Adjusted');
    assert.equal(res.body.response.advances[1].customerName, 'Customer Two');
    assert.equal(res.body.response.advancePage.total, 2);
    assert.equal(aggregateMatch.isDeleted.$ne, true);
});

test('selling advance page uses the authenticated member scope and includes settled rows', async () => {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const member = 'dddddddddddddddddddddddd';
    const identity = { availableModules: { collection: false, selling: true }, ownerNames: { [owner]: 'Dairy' }, collectionLinks: [], sellingLinks: [{ owner, memberIds: [member], memberDocs: [] }] };
    let usedQuery;
    const selling = { find(q) { usedQuery = q; return { populate() { return this; }, sort() { return this; }, limit() { return this; }, async lean() { return [{ _id: id(1), owner, member: { name: 'Customer' }, status: 'settled', type: 'given', amount: 10 }]; } }; } };
    const deps = { express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': {}, '../models/Payment': {}, '../models/Advance': {}, '../models/SellingEntry': {}, '../models/MemberPayment': {}, '../models/SellingAdvance': selling,
        '../middleware/portal-auth': () => {}, '../lib/portalIdentity': { findPortalProfiles: async () => identity, publicPortalIdentity: () => ({ name: 'Customer' }), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
    await handlers['/advances']({ portalPhone: '7489301982', query: { module: 'selling', date: '2026-11-17T00:00:00.000Z', id: id(2), owner: otherOwner } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.response.advances[0].type, 'Settled');
    assert.equal(usedQuery.$and[0].$or[0].owner, owner);
    assert.equal(usedQuery.$and[0].$or[0].member.$in[0], member);
});

test('collection entries use each saved paid status, including both shifts and later unpaid entries', async () => {
    const makeEntry = (n, date, shift, isPaid) => ({ _id: id(n), owner, date: new Date(date), shift, farmerCode: '1', quantity: 5, amount: 250, ...(isPaid === undefined ? {} : { isPaid }) });
    const entries = [
        makeEntry(1, '2026-11-21T00:00:00Z', 'morning', true),
        makeEntry(2, '2026-11-21T00:00:00Z', 'evening', true),
        makeEntry(3, '2026-11-22T00:00:00Z', 'morning', true),
        makeEntry(4, '2026-11-22T00:00:00Z', 'evening', true),
        makeEntry(5, '2026-11-22T00:00:00Z', 'evening', false),
        makeEntry(6, '2026-11-23T00:00:00Z', 'morning', false),
        makeEntry(7, '2026-11-22T00:00:00Z', 'morning', undefined),
    ];
    const ctx = fixture([], true, entries);
    const res = await ctx.request('/dashboard', { module: 'collection' });
    assert.deepEqual(Array.from(res.body.response.entries, entry => entry.status), ['Paid', 'Paid', 'Paid', 'Paid', 'Pending', 'Pending', 'Pending']);
    assert.equal(entries[4].isPaid, false);
    assert.equal(entries[6].isPaid, undefined);
});
