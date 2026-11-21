const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function match(row, query) {
    return Object.entries(query).every(([key, condition]) => {
        if (key === '$and') return condition.every(part => match(row, part));
        if (key === '$or') return condition.some(part => match(row, part));
        const actual = row[key];
        if (condition instanceof RegExp || Object.prototype.toString.call(condition) === '[object RegExp]') return condition.test(String(actual || ''));
        if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
            const convert = value => value instanceof Date ? value.getTime() : value;
            const value = convert(actual);
            return Object.entries(condition).every(([op, bound]) => {
                const other = convert(bound);
                if (typeof value !== typeof other) return false;
                if (op === '$gte') return value >= other;
                if (op === '$lte') return value <= other;
                if (op === '$lt') return value < other;
                return false;
            });
        }
        return actual === condition;
    });
}
function fixture(rows) {
    const handlers = {};
    const router = { use() {} };
    for (const method of ['get', 'post', 'put', 'delete']) router[method] = (path, ...args) => { handlers[method + path] = args.at(-1); };
    let usedQuery;
    const collections = {
        find(query) {
            usedQuery = query;
            let results = rows.filter(row => match(row, query));
            return { populate() { return this; }, sort() { return this; }, limit(n) { this.n = n; return this; }, skip(n) { results = results.slice(n, n + this.n); return this; }, async lean() { return results; } };
        },
        aggregate: async pipeline => {
            const result = rows.filter(row => match(row, pipeline[0].$match));
            return [{ totalQuantity: result.reduce((sum, row) => sum + row.quantity, 0), totalAmount: result.reduce((sum, row) => sum + row.amount, 0) }];
        },
        countDocuments: async query => rows.filter(row => match(row, query)).length,
    };
    const deps = { express: { Router: () => router }, '../models/MilkCollection': collections,
        '../models/PurchaseFarmer': { findOne: async () => ({ _id: 'purchase-11' }) },
        '../models/Farmer': { findOne: async () => ({ _id: 'legacy-11' }) },
        '../middleware/auth': () => {}, '../middleware/subscription': { requireSubscription: () => () => {} } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/milk-collections'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Object, RegExp, parseInt });
    return { get query() { return usedQuery; }, async get(query) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['get/']({ query, userId: 'owner' }, res);
        assert.equal(res.statusCode, 200);
        return res.body.response;
    } };
}
const rows = [
    { owner: 'owner', farmerCode: '11', date: '2026-11-15', quantity: 5, amount: 220, isPaid: true },
    { owner: 'owner', farmerCode: ' 11 ', date: '2026-11-16', quantity: 8.5, amount: 282 },
    { owner: 'owner', purchaseFarmer: 'purchase-11', date: '2026-11-14', quantity: 2, amount: 110, isPaid: false },
    { owner: 'owner', farmer: 'legacy-11', date: '2026-11-14', quantity: 5.1, amount: 612, isPaid: true },
    { owner: 'owner', farmerCode: '111', date: '2026-11-15', quantity: 10, amount: 999, isPaid: true },
    { owner: 'other', farmerCode: '11', date: '2026-11-15', quantity: 20, amount: 1000, isPaid: true },
    { owner: 'owner', farmerCode: '11', date: '2026-11-25', quantity: 30, amount: 1000, isPaid: true },
];

test('code report matches paid, unpaid, code-only and legacy IDs, before paging and within date and owner scope', async () => {
    const ctx = fixture(rows);
    const params = { farmerCode: '11', isPaid: 'all', startDate: '2026-11-11', endDate: '2026-11-20', limit: '2' };
    const first = await ctx.get({ ...params, page: '1' });
    assert.equal(first.count, 4);
    assert.equal(first.data.length, 2);
    assert.equal(first.totals.quantity, 20.6);
    assert.equal(first.totals.amount, 1224);
    const second = await ctx.get({ ...params, page: '2' });
    assert.equal(second.data.length, 2);
    assert.equal(second.data[0].purchaseFarmer, 'purchase-11');
    assert.equal('isPaid' in ctx.query, false);
});

test('settlement default remains unpaid and explicit paid filters remain intact', async () => {
    const ctx = fixture(rows);
    const unpaid = await ctx.get({ farmerCode: '11', startDate: '2026-11-11', endDate: '2026-11-20' });
    assert.equal(unpaid.count, 1);
    assert.equal(ctx.query.isPaid, false);
    const paid = await ctx.get({ farmerCode: '11', isPaid: 'true', startDate: '2026-11-11', endDate: '2026-11-20' });
    assert.equal(paid.count, 2);
});
