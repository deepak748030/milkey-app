const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeSellingMobile, sellingMobilePattern } = require('../lib/selling-mobile');

function fixture(initial = [], legacy = [], options = {}) {
    const state = { farmers: initial.map(f => ({ ...f })), legacy: legacy.map(f => ({ ...f })), reservations: [] };
    let sequence = 0;
    const matches = (row, query) => Object.entries(query).every(([key, expected]) => {
        const actual = row[key];
        if (expected instanceof RegExp) return expected.test(String(actual || ''));
        if (expected && typeof expected === 'object' && '$ne' in expected) return String(actual) !== String(expected.$ne);
        if (expected && typeof expected === 'object' && '$not' in expected) return !expected.$not.test(String(actual || ''));
        return String(actual) === String(expected);
    });
    const find = (rows, query) => {
        let session;
        const get = () => {
            const found = rows().find(row => matches(row, query));
            return found ? { ...found, async save() { Object.assign(found, this); return this; } } : null;
        };
        return { session(s) { session = s; return this; }, async lean() { return get(); }, then(resolve, reject) { return Promise.resolve(get()).then(resolve, reject); } };
    };
    const Farmer = {
        findOne: q => find(() => state.farmers, q),
        create: async rows => { const item = { ...rows[0], _id: String(rows[0]._id), isActive: true }; state.farmers.push(item); return [item]; },
        findOneAndUpdate: async (q, update) => { const doc = state.farmers.find(f => matches(f, q)); if (doc) Object.assign(doc, update); return doc || null; },
    };
    const PurchaseFarmer = { findOne: q => find(() => state.legacy, q) };
    const Reservation = {
        createCollection: async () => {},
        findOne: q => find(() => state.reservations, q),
        create: async rows => { if (state.reservations.some(r => r._id === rows[0]._id)) throw Object.assign(new Error('duplicate'), { code: 11000 }); state.reservations.push({ ...rows[0], farmer: String(rows[0].farmer) }); return rows; },
        deleteOne: async q => { state.reservations = state.reservations.filter(r => !matches(r, q)); },
    };
    const mongoose = {
        Types: { ObjectId: class { constructor() { this.id = `new-${++sequence}`; } toString() { return this.id; } } },
        startSession: async () => ({
            async withTransaction(fn) {
                const before = JSON.stringify(state);
                try { await fn(); if (options.failCommit) throw new Error('transaction unavailable'); }
                catch (error) { Object.assign(state, JSON.parse(before)); throw error; }
            },
            async endSession() {},
        }),
    };
    const helperDeps = { mongoose, '../models/Farmer': Farmer, '../models/PurchaseFarmer': PurchaseFarmer, '../models/CollectionMobileReservation': Reservation, './selling-mobile': { normalizeSellingMobile, sellingMobilePattern } };
    const helper = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/collection-mobile'), 'utf8'), { require: name => { if (!(name in helperDeps)) throw Error(name); return helperDeps[name]; }, module: helper, RegExp, String, Error, Object });
    const handlers = {};
    for (const name of ['farmers', 'purchase-farmers']) {
        const router = {};
        for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...args) => { handlers[`${name} ${method} ${url}`] = args.at(-1); };
        const deps = { express: { Router: () => router }, mongoose, '../models/Farmer': Farmer, '../lib/collection-mobile': helper.exports, '../middleware/auth': () => {}, '../middleware/subscription': { requireSubscription: () => () => {} } };
        vm.runInNewContext(fs.readFileSync(require.resolve(`../routes/${name}`), 'utf8'), { require: n => { if (!(n in deps)) throw Error(n); return deps[n]; }, module: { exports: {} }, console, RegExp, String, Number, Math, Error, Object, parseFloat });
    }
    const request = async (name, method, body, owner = 'dairy1', id = '') => {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
        await handlers[`${name} ${method} ${method === 'post' ? '/' : '/:id'}`]({ body, userId: owner, params: { id } }, res);
        return res;
    };
    return { state, request };
}
const row = (id, code, mobile, owner = 'dairy1', extra = {}) => ({ _id: id, code, mobile, owner, name: id, isActive: true, ...extra });

test('both collection endpoints block same-dairy duplicate on create and edit, including formatted and inactive records', async () => {
    for (const route of ['farmers', 'purchase-farmers']) {
        const ctx = fixture([row('a', '1', '+91 74893-01982', 'dairy1', { isActive: false }), row('b', '11', '9000000000')]);
        let res = await ctx.request(route, 'post', { code: '12', name: 'New', mobile: '7489301982' });
        assert.equal(res.statusCode, 409);
        assert.match(res.body.message, /another farmer in this dairy/);
        res = await ctx.request(route, 'put', { mobile: '7489301982', name: 'Changed' }, 'dairy1', 'b');
        assert.equal(res.statusCode, 409);
        assert.equal(ctx.state.farmers[1].name, 'b');
        assert.equal(ctx.state.farmers[1].mobile, '9000000000');
        assert.equal(ctx.state.reservations.length, 0);
        assert.equal((await ctx.request(route, 'post', { code: '12', name: 'Other dairy', mobile: '7489301982' }, 'dairy2')).statusCode, 201);
    }
});

test('blank mobiles are optional and same farmer can edit unchanged legacy duplicate number', async () => {
    const ctx = fixture([row('a', '1', '7489301982'), row('b', '2', '7489301982')]);
    assert.equal((await ctx.request('purchase-farmers', 'put', { name: 'Edited', mobile: '+91 74893 01982' }, 'dairy1', 'a')).statusCode, 200);
    assert.equal((await ctx.request('farmers', 'put', { name: 'Edited too' }, 'dairy1', 'b')).statusCode, 200);
    assert.equal((await ctx.request('purchase-farmers', 'post', { code: '3', name: 'No phone', mobile: '' })).statusCode, 201);
    assert.equal((await ctx.request('farmers', 'post', { code: '4', name: 'No phone either', mobile: '' })).statusCode, 201);
    assert.equal(ctx.state.farmers.length, 4);
});

test('legacy PurchaseFarmer is checked across codes without blocking the same-code companion', async () => {
    const ctx = fixture([row('f1', '1', '')], [row('p1', '1', '+91 7489301982'), row('p2', '2', '9988776655')]);
    assert.equal((await ctx.request('purchase-farmers', 'put', { mobile: '7489301982' }, 'dairy1', 'f1')).statusCode, 200);
    assert.equal((await ctx.request('farmers', 'post', { code: '3', name: 'New', mobile: '9988776655' })).statusCode, 409);
    assert.equal((await ctx.request('farmers', 'post', { code: '3', name: 'Another dairy', mobile: '9988776655' }, 'dairy2')).statusCode, 201);
});

test('new reservations work across both collection endpoints and are moved or released atomically', async () => {
    const ctx = fixture();
    let res = await ctx.request('farmers', 'post', { code: '1', name: 'One', mobile: '9876543210' });
    assert.equal(res.statusCode, 201);
    const farmerId = res.body.response._id;
    assert.equal((await ctx.request('purchase-farmers', 'post', { code: '2', name: 'Two', mobile: '+91 98765-43210' })).statusCode, 409);
    assert.equal((await ctx.request('purchase-farmers', 'put', { mobile: '9876543211' }, 'dairy1', farmerId)).statusCode, 200);
    assert.equal((await ctx.request('farmers', 'post', { code: '2', name: 'Two', mobile: '9876543210' })).statusCode, 201);
    assert.equal((await ctx.request('purchase-farmers', 'put', { mobile: '' }, 'dairy1', farmerId)).statusCode, 200);
    assert.equal((await ctx.request('farmers', 'post', { code: '3', name: 'Three', mobile: '9876543211' })).statusCode, 201);
});

test('inactive restoration with changed number is checked before any fields change', async () => {
    for (const route of ['farmers', 'purchase-farmers']) {
        const ctx = fixture([row('a', '1', '1111111111', 'dairy1', { isActive: false }), row('b', '2', '2222222222')]);
        const res = await ctx.request(route, 'post', { code: '1', name: 'Replacement', mobile: '2222222222' });
        assert.equal(res.statusCode, 409);
        assert.equal(ctx.state.farmers[0].name, 'a');
        assert.equal(ctx.state.farmers[0].isActive, false);
    }
});

test('missing owner record, invalid new phone and failed transaction do not write anything', async () => {
    const ctx = fixture([row('a', '1', '1111111111')]);
    assert.equal((await ctx.request('purchase-farmers', 'put', { mobile: '2222222222' }, 'dairy2', 'a')).statusCode, 404);
    assert.equal((await ctx.request('farmers', 'post', { code: '2', name: 'Invalid', mobile: 'not a number' })).statusCode, 400);
    assert.equal(ctx.state.farmers.length, 1);
    assert.equal(ctx.state.reservations.length, 0);
    const broken = fixture([], [], { failCommit: true });
    const res = await broken.request('purchase-farmers', 'post', { code: '1', name: 'Fail', mobile: '2222222222' });
    assert.equal(res.statusCode, 500);
    assert.equal(broken.state.farmers.length, 0);
    assert.equal(broken.state.reservations.length, 0);
});

test('stale reservations from an out-of-band change or hard deletion can be reclaimed safely', async () => {
    const ctx = fixture([row('a', '1', '1111111111')]);
    ctx.state.reservations.push({ _id: 'dairy1:2222222222', owner: 'dairy1', farmer: 'a' });
    ctx.state.reservations.push({ _id: 'dairy1:3333333333', owner: 'dairy1', farmer: 'missing' });
    assert.equal((await ctx.request('farmers', 'post', { code: '2', name: 'Two', mobile: '2222222222' })).statusCode, 201);
    assert.equal((await ctx.request('purchase-farmers', 'post', { code: '3', name: 'Three', mobile: '3333333333' })).statusCode, 201);
    assert.equal((await ctx.request('farmers', 'post', { code: '4', name: 'Four', mobile: '3333333333' })).statusCode, 409);
});
