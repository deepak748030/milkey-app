const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const breakdown = require('../lib/collectionSettlementBreakdown');

test('split uses saved entry amounts including bonus and retains zero and negative adjustments', () => {
    const rows = [{ amount: 300 }, { amount: 390 }];
    assert.deepEqual(breakdown.createSplit(rows, 690, 12.50, 702.50), { entriesAmount: 690, extraMilkAmount: 12.50 });
    assert.deepEqual(breakdown.createSplit(rows, 690, 0, 690), { entriesAmount: 690, extraMilkAmount: 0 });
    assert.deepEqual(breakdown.createSplit(rows, 690, -10, 680), { entriesAmount: 690, extraMilkAmount: -10 });
    assert.equal(breakdown.createSplit(rows, 689, 0, 689), null);
    assert.equal(breakdown.createSplit(rows, 690, 0.001, 690.001), null);
    assert.equal(breakdown.createSplit(rows, 690, null, 690), null);
    assert.equal(breakdown.createSplit(rows, 690, -700, -10), null);
});

test('period boundaries cover both complete local dates and validate offset and dates', () => {
    assert.equal(breakdown.localDayStart('2026-11-23', 330).toISOString(), '2026-11-22T18:30:00.000Z');
    assert.equal(breakdown.localDayStart('2026-02-30', 330), null);
    assert.equal(breakdown.localDayStart('2026-11-23', 841), null);
});

function fixture({ transactionUnavailable = false } = {}) {
    const handlers = {};
    const router = {};
    for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...args) => { handlers[`${method} ${url}`] = args.at(-1); };
    const state = { payment: null, paidIds: [], lastQuery: null, transactions: 0 };
    const chain = value => ({ sort() { return this; }, session() { return this; }, select() { return this; }, populate() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    const rows = [
        { _id: 'early', date: new Date('2026-11-22T18:30:00Z'), amount: 300, quantity: 5, rate: 60, shift: 'morning' },
        { _id: 'late', date: new Date('2026-11-24T18:29:59Z'), amount: 390, quantity: 6.5, rate: 60, shift: 'evening' },
        { _id: 'outside', date: new Date('2026-11-24T18:30:00Z'), amount: 100 },
    ];
    const farmer = { _id: 'farmer', code: '1', currentBalance: -376, markModified: () => {}, save: async () => {} };
    const Payment = {
        find: () => chain([]),
        findOne: query => chain(query._id ? state.payment : (state.latest || state.payment)),
        findById: () => chain(state.payment),
        create: async data => { state.payment = { ...data[0], _id: 'payment', save: async () => {} }; return [state.payment]; },
    };
    const deps = {
        express: { Router: () => router }, mongoose: { startSession: async () => ({ withTransaction: async fn => { state.transactions++; if (transactionUnavailable) throw new Error('transactions unavailable'); await fn(); }, endSession: async () => {} }) }, '../models/Payment': Payment,
        '../models/MilkCollection': { find: query => { state.lastQuery = query; return chain(rows.filter(row => row.date >= query.date.$gte && row.date < query.date.$lt)); }, updateMany: async filter => { state.paidIds = filter._id.$in; } },
        '../models/Advance': { find: () => chain([{ _id: 'adv', amount: 767, settledAmount: 0, save: async () => {} }]) },
        '../models/Farmer': { findOne: () => chain(farmer), findById: () => chain(farmer) },
        '../models/PurchaseFarmer': { findOne: () => chain(null) }, '../middleware/auth': () => {},
        '../middleware/subscription': { requireSubscription: () => () => {} },
        '../lib/collectionSettlementBreakdown': breakdown,
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/payments'), 'utf8'), { require: name => { if (!(name in deps)) throw Error(name); return deps[name]; }, module: { exports: {} }, console, Date, Number, String, Math, RegExp, parseFloat });
    return { state, async call(method, body) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
        await handlers[method]({ userId: 'owner', params: { id: 'payment' }, body, query: {} }, res);
        return res;
    } };
}
const base = { farmerCode: '1', amount: 0, totalMilkAmount: 690, entriesAmount: 690, extraMilkAmount: 0, tzOffsetMinutes: 330, expectedAdvance: 767, expectedBalance: -376, periodStart: '2026-11-23', periodEnd: '2026-11-24' };

test('creation snapshots exact local-period entries and preserves collection calculation', async () => {
    const ctx = fixture();
    const res = await ctx.call('post /', base);
    assert.equal(res.statusCode, 201);
    assert.equal(ctx.state.transactions, 1);
    assert.equal(ctx.state.payment.entriesAmount, 690);
    assert.equal(ctx.state.payment.extraMilkAmount, 0);
    assert.equal(ctx.state.payment.netPayable, -453);
    assert.equal(ctx.state.payment.closingBalance, -453);
    assert.deepEqual(Array.from(ctx.state.paidIds), ['early', 'late']);
    assert.deepEqual(Array.from(ctx.state.payment.collectionSnapshots, r => r.id), ['early', 'late']);
    assert.equal(ctx.state.lastQuery.date.$lt.toISOString(), '2026-11-24T18:30:00.000Z');
});

test('stale and invalid splits never save or mark entries paid', async () => {
    for (const patch of [{ entriesAmount: 689, totalMilkAmount: 689 }, { extraMilkAmount: null }, { tzOffsetMinutes: 900 }, { expectedAdvance: 766 }, { expectedBalance: -375 }]) {
        const ctx = fixture();
        const res = await ctx.call('post /', { ...base, ...patch });
        assert.ok(res.statusCode >= 400);
        assert.equal(ctx.state.payment, null);
        assert.equal(ctx.state.paidIds.length, 0);
    }
});

test('edit updates extra but rejects changed linked period or inconsistent split', async () => {
    const ctx = fixture();
    await ctx.call('post /', base);
    let result = await ctx.call('put /:id', { amount: 0, totalMilkAmount: 700, extraMilkAmount: 10, periodStart: base.periodStart, periodEnd: base.periodEnd });
    assert.equal(result.statusCode, 200);
    assert.equal(ctx.state.payment.entriesAmount, 690);
    assert.equal(ctx.state.payment.extraMilkAmount, 10);
    assert.equal(ctx.state.payment.totalMilkAmount, 700);
    result = await ctx.call('put /:id', { totalMilkAmount: 700, extraMilkAmount: 9 });
    assert.equal(result.statusCode, 400);
    result = await ctx.call('put /:id', { periodEnd: '2026-11-25' });
    assert.equal(result.statusCode, 409);
    assert.equal(ctx.state.payment.periodEnd.toISOString().slice(0, 10), base.periodEnd);
});

test('older clients changing the total invalidate the split without changing snapshots', async () => {
    const ctx = fixture();
    await ctx.call('post /', base);
    const result = await ctx.call('put /:id', { totalMilkAmount: 700 });
    assert.equal(result.statusCode, 200);
    assert.equal(ctx.state.payment.entriesAmount, undefined);
    assert.equal(ctx.state.payment.extraMilkAmount, undefined);
    assert.equal(ctx.state.payment.collectionSnapshots.length, 2);
});


test('older settlement amount edits are rejected rather than corrupting later balances', async () => {
    const ctx = fixture();
    await ctx.call('post /', base);
    ctx.state.latest = { _id: 'later', closingBalance: 100 };
    const res = await ctx.call('put /:id', { amount: 10, totalMilkAmount: 690, extraMilkAmount: 0 });
    assert.equal(res.statusCode, 409);
    assert.equal(ctx.state.payment.amount, 0);
    assert.equal(ctx.state.payment.closingBalance, -453);
});


test('transaction unavailable fails closed before saving a settlement', async () => {
    const ctx = fixture({ transactionUnavailable: true });
    const res = await ctx.call('post /', base);
    assert.equal(res.statusCode, 500);
    assert.equal(ctx.state.payment, null);
    assert.equal(ctx.state.paidIds.length, 0);
});
