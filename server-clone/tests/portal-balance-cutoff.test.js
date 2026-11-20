const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const id = n => n.toString(16).padStart(24, '0');
const A = id(1), B = id(2), OTHER = id(3), f1 = id(11), f2 = id(12), m1 = id(21), m2 = id(22);
const day = n => new Date(`2026-11-${n}T00:00:00.000Z`);
class ObjectId { constructor(v) { this.v = v; } toString() { return this.v; } }
const val = v => v instanceof Date ? v.getTime() : v instanceof ObjectId ? String(v) : v;
function matches(doc, query) {
    return Object.entries(query).every(([key, condition]) => {
        if (key === '$or') return condition.some(q => matches(doc, q));
        if (key === '$and') return condition.every(q => matches(doc, q));
        const actual = doc[key];
        if (!condition || typeof condition !== 'object' || condition instanceof Date || condition instanceof ObjectId) return val(actual) === val(condition);
        return Object.entries(condition).every(([op, expected]) => {
            if (op === '$in') return expected.some(v => val(v) === val(actual));
            if (op === '$ne') return val(actual) !== val(expected);
            if (op === '$gte') return actual != null && val(actual) >= val(expected);
            if (op === '$lt') return actual != null && val(actual) < val(expected);
            if (op === '$type') return expected === 'string' && typeof actual === 'string';
            if (op === '$regex') return new RegExp(expected, condition.$options || '').test(actual || '');
            if (op === '$options') return true;
            if (op === '$exists') return expected ? actual !== undefined : actual === undefined;
            throw Error(`Unexpected operator: ${op}`);
        });
    });
}
function model(rows, aggregate) {
    return {
        find(query) {
            let sort = {}, limit = Infinity;
            return {
                populate() { return this; },
                sort(spec) { sort = spec; return this; },
                limit(n) { limit = n; return this; },
                async lean() {
                    return rows.filter(r => matches(r, query)).sort((a, b) => {
                        for (const [key, direction] of Object.entries(sort)) {
                            const x = val(a[key]) ?? -Infinity, y = val(b[key]) ?? -Infinity;
                            if (x !== y) return (x < y ? -1 : 1) * direction;
                        }
                        return 0;
                    }).slice(0, limit);
                },
            };
        },
        countDocuments: async q => rows.filter(r => matches(r, q)).length,
        aggregate: aggregate || (async pipeline => {
            const selected = rows.filter(r => matches(r, pipeline[0].$match));
            const total = selected.reduce((sum, r) => sum + Number(r.amount || 0), 0);
            return pipeline[1].$facet ? [{ all: [{ amount: total }], today: [{}] }] : [{ total }];
        }),
    };
}
const collectionLink = (owner, farmer, code = '1') => ({ owner, code, farmerIds: [farmer], allProfileIds: [farmer], farmerDocs: [{ _id: farmer, currentBalance: 0 }] });
const sellingLink = (owner, members) => ({ owner, memberIds: members.map(m => m._id), memberDocs: members });
function fixture({ module, links, entries, payments, advances = [] }) {
    const handlers = {};
    const router = { use() {}, get(path, ...args) { handlers[path] = args.at(-1); } };
    const identity = { availableModules: { collection: module === 'collection', selling: module === 'selling' }, collectionLinks: module === 'collection' ? links : [], sellingLinks: module === 'selling' ? links : [], ownerNames: { [A]: 'A', [B]: 'B' } };
    const entriesModel = model(entries), paymentModel = model(payments), empty = model([]);
    const advanceModel = model(advances, async pipeline => {
        const selected = advances.filter(r => matches(r, pipeline[0].$match));
        if (module === 'collection') return [{ total: selected.reduce((sum, r) => sum + Math.max(0, r.amount - (r.settledAmount || 0)), 0) }];
        const groups = new Map();
        for (const row of selected) {
            const key = `${row.owner}:${row.member}`;
            const group = groups.get(key) || { given: 0, adjusted: 0 };
            if (row.type === 'adjusted') group.adjusted += row.amount;
            else if (row.status !== 'settled') group.given += Math.max(0, row.amount - (row.settledAmount || 0));
            groups.set(key, group);
        }
        return [...groups.values()];
    });
    const deps = {
        express: { Router: () => router }, mongoose: { Types: { ObjectId }, isValidObjectId: s => /^[a-f0-9]{24}$/.test(String(s)) },
        '../models/MilkCollection': module === 'collection' ? entriesModel : empty,
        '../models/SellingEntry': module === 'selling' ? entriesModel : empty,
        '../models/Payment': module === 'collection' ? paymentModel : empty,
        '../models/MemberPayment': module === 'selling' ? paymentModel : empty,
        '../models/Advance': module === 'collection' ? advanceModel : empty,
        '../models/SellingAdvance': module === 'selling' ? advanceModel : empty,
        '../middleware/portal-auth': () => {},
        '../lib/portalIdentity': { findPortalProfiles: async () => identity, publicPortalIdentity: () => ({ name: 'User', availableModules: [module] }), toId: v => v ? String(v) : '', escapeRegExp: v => String(v) },
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/portal'), 'utf8'), { require: n => { if (!(n in deps)) throw Error(n); return deps[n]; }, module: { exports: {} }, console, Date, Number, String, Math, Set, Map, RegExp });
    return async () => {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.body = data; return this; } };
        await handlers['/dashboard']({ portalPhone: 'verified', query: { module, tzOffsetMinutes: '330' } }, res);
        assert.equal(res.statusCode, 200);
        return res.body.response;
    };
}

test('collection uses settlement end rather than payment date or paid tick, and subtracts only pending advances', async () => {
    const entries = [
        { _id: id(101), owner: A, purchaseFarmer: f1, farmerCode: '1', date: day('23'), amount: 350, isPaid: false },
        { _id: id(102), owner: A, purchaseFarmer: f1, farmerCode: '1', date: day('24'), amount: 625, isPaid: true },
        { _id: id(103), owner: OTHER, purchaseFarmer: f1, farmerCode: '1', date: day('24'), amount: 9000 },
    ];
    const payments = [{ _id: id(201), owner: A, farmer: f1, date: day('19'), periodEnd: day('23'), closingBalance: -900 }];
    const advances = [
        { _id: id(301), owner: A, farmer: f1, date: day('20'), amount: 500, status: 'pending' },
        { _id: id(302), owner: A, farmer: f1, date: day('19'), amount: 767, settledAmount: 767, status: 'settled' },
    ];
    const result = await fixture({ module: 'collection', links: [collectionLink(A, f1)], entries, payments, advances })();
    assert.equal(result.summary.currentBalance, -775);
    assert.equal(result.summary.advancePending, 500);
    assert.equal(result.entries.find(e => e.id === id(101)).status, 'Pending');
    assert.equal(result.entries.find(e => e.id === id(102)).status, 'Paid');
    assert.equal(entries[0].isPaid, false);
    assert.equal(entries[1].isPaid, true);
});

test('selling examples add advance and signed closing balance', async () => {
    const entries = [
        { _id: id(1), owner: A, member: m1, date: day('20'), amount: 300, isPaid: false },
        { _id: id(2), owner: A, member: m1, date: day('21'), amount: 500, isPaid: true },
    ];
    const advances = [{ _id: id(3), owner: A, member: m1, date: day('21'), amount: 650, type: 'given', status: 'pending' }];
    for (const [closingBalance, expected] of [[100, 1250], [-100, 1050]]) {
        const payments = [{ _id: id(4), owner: A, member: m1, date: day('22'), periodEnd: day('20'), closingBalance }];
        const response = await fixture({ module: 'selling', links: [sellingLink(A, [{ _id: m1 }])], entries, payments, advances })();
        assert.equal(response.summary.currentBalance, expected);
    }
});

test('each linked dairy and each selling customer uses its own settlement cutoff', async () => {
    const entries = [
        { _id: id(1), owner: A, member: m1, date: day('21'), amount: 500 },
        { _id: id(2), owner: A, member: m2, date: day('21'), amount: 100 },
        { _id: id(3), owner: A, member: m2, date: '2026-11-23', amount: 50 },
        { _id: id(4), owner: B, member: m1, date: day('21'), amount: 80 },
        { _id: id(5), owner: OTHER, member: m1, date: day('25'), amount: 9000 },
    ];
    const payments = [
        { _id: id(10), owner: A, member: m1, periodEnd: day('20'), closingBalance: -100 },
        { _id: id(11), owner: A, member: m2, periodEnd: day('22'), closingBalance: 20 },
        { _id: id(12), owner: B, member: m1, periodEnd: day('20'), closingBalance: 0 },
    ];
    const links = [sellingLink(A, [{ _id: m1 }, { _id: m2 }]), sellingLink(B, [{ _id: m1 }])];
    const result = await fixture({ module: 'selling', links, entries, payments })();
    assert.equal(result.summary.currentBalance, 550); // 500-100 + 50+20 + 80
});

test('legacy records without period and accounts without payments keep previous unpaid fallback', async () => {
    const entries = [
        { _id: id(1), owner: A, member: m1, date: day('20'), amount: 50, isPaid: false },
        { _id: id(2), owner: A, member: m1, date: day('21'), amount: 500, isPaid: true },
    ];
    const links = [sellingLink(A, [{ _id: m1, sellingPaymentBalance: 10 }])];
    const options = { module: 'selling', links, entries };
    assert.equal((await fixture({ ...options, payments: [] })()).summary.currentBalance, 60);
    const payments = [{ _id: id(3), owner: A, member: m1, date: day('22'), closingBalance: -100 }];
    assert.equal((await fixture({ ...options, payments })()).summary.currentBalance, -50);
});

test('uses full ledger, latest period rather than display page and local collection midnight', async () => {
    const entries = [
        { _id: id(1), owner: A, purchaseFarmer: f1, farmerCode: '1', date: new Date('2026-11-23T18:29:59Z'), amount: 900 },
        { _id: id(2), owner: A, purchaseFarmer: f1, farmerCode: '1', date: new Date('2026-11-23T18:30:00Z'), amount: 1 },
    ];
    for (let i = 0; i < 130; i++) entries.push({ _id: id(100 + i), owner: A, purchaseFarmer: f1, farmerCode: '1', date: day('24'), amount: 1 });
    const payments = [{ _id: id(500), owner: A, farmer: f1, date: day('01'), periodEnd: day('23'), closingBalance: 0 }];
    for (let i = 0; i < 125; i++) payments.push({ _id: id(600 + i), owner: A, farmer: f1, date: day('25'), periodEnd: day('20'), closingBalance: 999 });
    const result = await fixture({ module: 'collection', links: [collectionLink(A, f1)], entries, payments })();
    assert.equal(result.entries.length, 120);
    assert.equal(result.payments.length, 120);
    assert.equal(result.summary.currentBalance, 131);
});

test('collection entries use each linked dairy cutoff, not a shared date', async () => {
    const entries = [
        { _id: id(1), owner: A, purchaseFarmer: f1, farmerCode: '1', date: day('21'), amount: 10 },
        { _id: id(2), owner: B, purchaseFarmer: f2, farmerCode: '1', date: day('21'), amount: 20 },
        { _id: id(3), owner: B, purchaseFarmer: f2, farmerCode: '1', date: day('23'), amount: 30 },
    ];
    const payments = [
        { _id: id(11), owner: A, farmer: f1, periodEnd: day('20'), closingBalance: 5 },
        { _id: id(12), owner: B, farmer: f2, periodEnd: day('22'), closingBalance: -3 },
    ];
    const result = await fixture({ module: 'collection', links: [collectionLink(A, f1), collectionLink(B, f2)], entries, payments })();
    assert.equal(result.summary.currentBalance, 42);
});
