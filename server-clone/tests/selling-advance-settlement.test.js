const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { planSellingAdvance } = require('../lib/selling-advance-settlement');

const given = (amount, settledAmount = 0, status = 'pending') => ({ type: 'given', amount, settledAmount, status });
const adjustment = amount => ({ type: 'adjusted', amount, status: 'settled' });

test('pending advance uses all rows, partial settlements, manual adjustments and cents', () => {
    const rows = [given(100, 20, 'partial'), given(12.35), adjustment(10.15), given(99, 99, 'settled'), { ...given(500), isDeleted: true }];
    const plan = planSellingAdvance(rows);
    assert.equal(plan.amount, 82.2);
    assert.deepEqual(plan.allocations.map(a => a.amount), [80, 2.2]);
    assert.equal(planSellingAdvance([given(4), adjustment(10)]).amount, 0);
    assert.equal(planSellingAdvance([]).amount, 0);
});

test('applying advance once leaves only manual-offset amount and future advances remain available', () => {
    const rows = [given(100), adjustment(20)];
    const plan = planSellingAdvance(rows);
    for (const { doc, amount } of plan.allocations) {
        doc.settledAmount += amount;
        doc.status = doc.settledAmount >= doc.amount ? 'settled' : 'partial';
    }
    assert.equal(plan.amount, 80);
    assert.equal(planSellingAdvance(rows).amount, 0);
    rows.push(given(50));
    assert.equal(planSellingAdvance(rows).amount, 50);
});

function makeRoute({ expectedMilk = 100, ledgerAmount = 30, latest = null } = {}) {
    const handlers = {};
    const router = {};
    for (const method of ['get', 'post', 'put']) router[method] = (url, ...args) => { handlers[`${method} ${url}`] = args.at(-1); };
    const state = { payment: null, entryPaid: false, memberBalance: 10, ledger: given(ledgerAmount), transactions: 0 };
    state.ledger._id = 'advance1';
    state.ledger.save = async () => {};
    const chain = value => ({ sort() { return this; }, select() { return this; }, session() { return this; }, populate() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
    class MemberPayment {
        constructor(fields) { Object.assign(this, fields); this._id = 'payment1'; }
        async save() { state.payment = this; }
        static findOne() { return chain(latest); }
        static findById() { return chain(state.payment); }
    }
    const member = { _id: 'customer1', sellingPaymentBalance: 10, ratePerLiter: 10, save: async function() { state.memberBalance = this.sellingPaymentBalance; } };
    const deps = {
        express: { Router: () => router },
        mongoose: { startSession: async () => ({ withTransaction: async fn => { state.transactions++; await fn(); }, endSession: async () => {} }) },
        '../models/MemberPayment': MemberPayment,
        '../models/Member': { findOne: () => chain(member) },
        '../models/SellingEntry': { find: () => chain([{ _id: 'entry1', amount: expectedMilk, morningQuantity: 10 }]), updateMany: async () => { state.entryPaid = true; } },
        '../models/SellingAdvance': { find: () => chain([state.ledger]) },
        '../lib/selling-advance-settlement': { planSellingAdvance },
        '../middleware/auth': () => {},
        '../middleware/subscription': { requireSubscription: () => () => {} },
    };
    const code = fs.readFileSync(require.resolve('../routes/member-payments'), 'utf8');
    vm.runInNewContext(code, { require: name => { if (!(name in deps)) throw Error(name); return deps[name]; }, module: { exports: {} }, console, Date, Number, Math, String, parseFloat });
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
    return { run: body => handlers['post /']({ body, userId: 'owner1' }, res), res, state };
}

test('payment saves deduction, audit allocation, closing balance and entry in transaction', async () => {
    const { run, res, state } = makeRoute();
    await run({ memberId: 'customer1', periodEnd: '2026-11-19', amount: 20, milkAmount: 100, expectedAdvance: 30, expectedBalance: 10 });
    assert.equal(res.statusCode, 201);
    assert.equal(state.transactions, 1);
    assert.equal(state.payment.advanceApplied, 30);
    assert.equal(state.payment.netPayable, 80);
    assert.equal(state.memberBalance, 60);
    assert.equal(state.ledger.settledAmount, 30);
    assert.equal(state.ledger.status, 'settled');
    assert.equal(state.payment.settledSellingAdvances[0].advance, 'advance1');
    assert.equal(state.entryPaid, true);
});

test('stale advance, milk or balance cannot save or consume anything', async () => {
    for (const patch of [{ expectedAdvance: 29 }, { milkAmount: 99 }, { expectedBalance: 9 }]) {
        const { run, res, state } = makeRoute();
        await run({ memberId: 'customer1', periodEnd: '2026-11-19', amount: 20, milkAmount: 100, expectedAdvance: 30, expectedBalance: 10, ...patch });
        assert.equal(res.statusCode, 409);
        assert.equal(state.payment, null);
        assert.equal(state.entryPaid, false);
        assert.equal(state.ledger.settledAmount, 0);
    }
});

test('advance can settle milk with zero cash and legacy payment does not consume advances', async () => {
    let ctx = makeRoute();
    await ctx.run({ memberId: 'customer1', periodEnd: '2026-11-19', amount: 0, milkAmount: 100, expectedAdvance: 30, expectedBalance: 10 });
    assert.equal(ctx.res.statusCode, 201);
    assert.equal(ctx.state.payment.closingBalance, 80);
    ctx = makeRoute();
    await ctx.run({ memberId: 'customer1', amount: 20, milkAmount: 100 });
    assert.equal(ctx.res.statusCode, 201);
    assert.equal(ctx.state.transactions, 0);
    assert.equal(ctx.state.payment.advanceApplied, 0);
    assert.equal(ctx.state.ledger.settledAmount, 0);
});

test('invalid period, backdated settlement and fractions of a paisa are rejected', async () => {
    const base = { memberId: 'customer1', periodEnd: '2026-11-19', amount: 20, milkAmount: 100, expectedAdvance: 30, expectedBalance: 10 };
    let ctx = makeRoute();
    await ctx.run({ ...base, periodEnd: '2026-02-30' });
    assert.equal(ctx.res.statusCode, 400);
    ctx = makeRoute();
    await ctx.run({ ...base, amount: 1.001 });
    assert.equal(ctx.res.statusCode, 400);
    ctx = makeRoute({ latest: { closingBalance: 10, periodEnd: new Date('2026-11-20') } });
    await ctx.run(base);
    assert.equal(ctx.res.statusCode, 409);
    assert.equal(ctx.state.payment, null);
});
