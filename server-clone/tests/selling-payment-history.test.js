const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(source) {
    const rows = structuredClone(source);
    let writes = 0;
    const handlers = {};
    const router = { get(path, ...args) { handlers[path] = args.at(-1); }, post() {}, put() {}, delete() {} };
    const model = {
        find(query) {
            let data = rows.filter(r => r.owner === query.owner && (!query.member || r.member === query.member)).map(r => ({ ...r }));
            const chain = {
                populate() { return chain; },
                sort(spec) { assert.equal(spec.date, -1); assert.equal(spec._id, -1); data.sort((a, b) => b.date - a.date || b._id.localeCompare(a._id)); return chain; },
                limit(n) { chain.n = n; return chain; }, skip(n) { chain.offset = n; return chain; },
                async lean() { return data.slice(chain.offset, chain.offset + chain.n); },
            };
            return chain;
        },
        countDocuments: async query => rows.filter(r => r.owner === query.owner && (!query.member || r.member === query.member)).length,
        bulkWrite: async () => { writes++; },
        aggregate: async pipeline => {
            const sortStages = pipeline.filter(x => x.$sort);
            for (const stage of sortStages) { assert.equal(stage.$sort.date, -1); assert.equal(stage.$sort._id, -1); }
            if (pipeline.some(x => x.$count)) return [{ total: 1 }];
            const filtered = rows.filter(r => r.owner === 'dairy').sort((a,b) => b.date - a.date || b._id.localeCompare(a._id));
            return filtered.slice(0, 1).map(x => ({ ...x }));
        },
        populate: async () => {},
    };
    const deps = { express: { Router: () => router }, mongoose: { Types: { ObjectId: function(v) { return v; } } },
        '../models/MemberPayment': model, '../models/SellingEntry': { find: () => ({ select: () => ({ lean: async () => [{ _id: 'entry', morningQuantity: 2, eveningQuantity: 3 }] }) }) },
        '../models/Member': {}, '../models/SellingAdvance': {}, '../lib/selling-advance-settlement': {}, '../middleware/auth': () => {}, '../middleware/subscription': { requireSubscription: () => () => {} } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/member-payments'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Map, parseInt });
    return { rows, writes: () => writes, async request(query) { const res = { json(body) { this.body = body; return this; }, status(n) { this.code = n; return this; } }; await handlers['/']({ userId: 'dairy', query }, res); return res; } };
}

test('history pages include all balances with stable order on identical dates and stay dairy-scoped', async () => {
    const date = new Date('2026-11-21T12:00:00Z');
    const rows = Array.from({ length: 25 }, (_, i) => ({ _id: String(i).padStart(2, '0'), date, owner: 'dairy', member: 'prem', closingBalance: [50, 0, -10][i % 3], advanceApplied: i, advanceEffect: i % 2 ? 'subtract' : 'add', totalQuantity: 1, milkRate: 10 }));
    rows.push({ ...rows[0], _id: 'other', owner: 'other' });
    rows.push({ ...rows[0], _id: 'other-customer', member: 'other' });
    const ctx = fixture(rows); const received = [];
    for (let page = 1; page <= 3; page++) {
        const result = (await ctx.request({ memberId: 'prem', page: String(page), limit: '10' })).body.response;
        assert.equal(result.count, 25); assert.equal(result.pagination.pages, 3);
        received.push(...result.data);
    }
    assert.deepEqual(received.map(r => r._id), Array.from({ length: 25 }, (_, i) => String(24-i).padStart(2,'0')));
    assert.deepEqual(new Set(received.map(r => r.closingBalance)), new Set([50, 0, -10]));
    assert.equal(received[0].advanceApplied, 24); assert.equal(ctx.writes(), 0);
});

test('latest-per-member uses the same deterministic tie breaker', async () => {
    const date = new Date('2026-11-21');
    const ctx = fixture([{ _id: '1', owner: 'dairy', member: 'prem', date }, { _id: '2', owner: 'dairy', member: 'prem', date }]);
    assert.equal((await ctx.request({ latestPerMember: 'true' })).body.response.data[0]._id, '2');
});

test('legacy quantity and rate are derived in the response, not persisted to payment history', async () => {
    const ctx = fixture([{ _id: '1', owner: 'dairy', member: 'prem', date: new Date(), totalQuantity: 0, milkRate: 0, totalSellAmount: 50, settledEntries: ['entry'] }]);
    const payment = (await ctx.request({ memberId: 'prem' })).body.response.data[0];
    assert.equal(payment.totalQuantity, 5); assert.equal(payment.milkRate, 10);
    assert.equal(ctx.rows[0].totalQuantity, 0); assert.equal(ctx.rows[0].milkRate, 0); assert.equal(ctx.writes(), 0);
});
