const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(rows) {
    const handlers = {};
    const router = { use() {} };
    for (const method of ['get', 'post', 'put', 'delete']) router[method] = (path, ...args) => { handlers[method + path] = args.at(-1); };
    const queries = [];
    const matches = (row, query) => {
        if (row.owner !== query.owner || row.isDeleted === true) return false;
        if (query.status && row.status !== query.status) return false;
        if (query.$and) {
            const [statusClause, amountClause] = query.$and;
            assert.equal(statusClause.status.$ne, 'settled');
            assert.equal(statusClause.type.$ne, 'adjusted');
            assert.equal(amountClause.$expr.$gt[0].$ifNull[0], '$amount');
            assert.equal(amountClause.$expr.$gt[1].$ifNull[0], '$settledAmount');
            return row.status !== 'settled' && row.type !== 'adjusted' && (row.amount || 0) > (row.settledAmount || 0);
        }
        return true;
    };
    const model = {
        find(query) {
            queries.push(query);
            let items = rows.filter(row => matches(row, query));
            return { populate() { return this; }, sort() { return this; }, skip(n) { items = items.slice(n); return this; }, limit(n) { items = items.slice(0, n); return this; }, async lean() { return items; } };
        },
        countDocuments: async query => rows.filter(row => matches(row, query)).length,
    };
    const deps = { express: { Router: () => router }, mongoose: { isValidObjectId: () => false },
        '../models/Member': {}, '../models/SellingAdvance': model, '../models/MemberPayment': {},
        '../middleware/auth': () => {}, '../middleware/subscription': { requireSubscription: () => () => {} } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/selling-advances'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Number, String, Math, parseInt });
    return { queries, async get(query) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['get/']({ query, userId: 'owner' }, res);
        return res.body.response;
    } };
}

test('open advances exclude settled rows before pagination while retaining partial and legacy balances', async () => {
    const rows = [
        { owner: 'owner', amount: 20, settledAmount: 20, status: 'settled', type: 'given' },
        { owner: 'owner', amount: 30, settledAmount: 10, status: 'partial', type: 'given' },
        { owner: 'owner', amount: 8, status: 'pending', type: 'given' },
        { owner: 'owner', amount: 4 },
        { owner: 'owner', amount: 8, settledAmount: 8, status: 'pending', type: 'given' },
        { owner: 'owner', amount: 2, status: 'settled', type: 'adjusted' },
        { owner: 'other', amount: 100, status: 'pending', type: 'given' },
    ];
    const ctx = fixture(rows);
    const first = await ctx.get({ status: 'open', limit: 2, page: 1 });
    const second = await ctx.get({ status: 'open', limit: 2, page: 2 });
    assert.equal(first.total, 3);
    assert.deepEqual(Array.from(first.data, r => r.amount), [30, 8]);
    assert.deepEqual(Array.from(second.data, r => r.amount), [4]);
    assert.equal(first.summary.advancePending, 30);
    const history = await ctx.get({ status: 'all', limit: 20 });
    assert.equal(history.total, 6);
    assert.equal(rows[0].status, 'settled');
});
