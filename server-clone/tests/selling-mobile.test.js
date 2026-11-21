const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeSellingMobile, sellingMobilePattern } = require('../lib/selling-mobile');

test('Indian prefixes and phone formatting resolve to the same number', () => {
    const variants = ['7489301982', '74893 01982', '+91 74893-01982', '0917489301982', '(74893) 01982', '0091 7489301982', '74+89301982'];
    const normalized = variants.map(normalizeSellingMobile);
    assert.deepEqual(normalized, variants.map(() => '7489301982'));
    for (const variant of variants) assert.match(variant, sellingMobilePattern(normalized[0]));
    assert.equal(normalizeSellingMobile('no number'), null);
    assert.equal(normalizeSellingMobile('---'), null);
    assert.doesNotMatch('17489301982', sellingMobilePattern('7489301982'));
    assert.equal(normalizeSellingMobile('+1 212 555 1234'), '12125551234');
    assert.match('+1 212 555 1234', sellingMobilePattern('12125551234'));
});

function fixture(initial = [], options = {}) {
    let sequence = 0;
    const state = { members: initial.map(m => ({ ...m })), reservations: [] };
    const handlers = {};
    const router = {};
    for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...args) => { handlers[`${method} ${url}`] = args.at(-1); };
    const match = (item, q) => Object.entries(q).every(([key, value]) => {
        if (value instanceof RegExp) return value.test(item[key]);
        if (value && typeof value === 'object' && '$ne' in value) return String(item[key]) !== String(value.$ne);
        return String(item[key]) === String(value);
    });
    const chain = value => ({ session() { return this; }, lean: async () => value });
    const Member = {
        findOne: q => chain(state.members.find(m => match(m, q)) || null),
        create: async rows => { const member = { ...rows[0], _id: String(rows[0]._id) }; state.members.push(member); return [member]; },
        findOneAndUpdate: (q, update) => {
            const run = () => {
                const member = state.members.find(m => match(m, q));
                if (member) Object.assign(member, update);
                return member || null;
            };
            return { populate: async () => run(), then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject) };
        },
    };
    const Reservations = {
        createCollection: async () => {},
        findOne: q => chain(state.reservations.find(r => match(r, q)) || null),
        create: async rows => {
            if (state.reservations.some(r => r._id === rows[0]._id)) throw Object.assign(new Error('duplicate key'), { code: 11000 });
            state.reservations.push({ ...rows[0], member: String(rows[0].member) });
            return rows;
        },
        deleteOne: async q => { state.reservations = state.reservations.filter(r => !match(r, q)); },
    };
    const mongoose = {
        Types: { ObjectId: class { constructor() { this.value = `new-${++sequence}`; } toString() { return this.value; } } },
        startSession: async () => ({
            withTransaction: async fn => {
                const snapshot = JSON.stringify(state);
                try {
                    await fn();
                    if (options.failCommit) throw new Error('transaction unavailable');
                } catch (e) { Object.assign(state, JSON.parse(snapshot)); throw e; }
            },
            endSession: async () => {},
        }),
    };
    const guardDeps = { mongoose, '../models/Member': Member, '../models/SellingMobileReservation': Reservations, './selling-mobile': { normalizeSellingMobile, sellingMobilePattern } };
    const guard = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/selling-mobile-guard'), 'utf8'), { require: name => { if (!(name in guardDeps)) throw Error(name); return guardDeps[name]; }, module: guard, String, Number, Error, Object });
    const deps = {
        express: { Router: () => router }, mongoose,
        '../lib/selling-mobile-guard': guard.exports,
        '../models/Member': Member,
        '../models/SellingMobileReservation': Reservations,
        '../lib/selling-mobile': { normalizeSellingMobile, sellingMobilePattern },
        '../models/SellingEntry': {}, '../models/MemberPayment': {},
        '../middleware/auth': () => {},
        '../middleware/subscription': { requireSubscription: () => () => {} },
        '../lib/whatsappZyptos': { sendMemberWelcome: async () => {} },
    };
    const code = fs.readFileSync(require.resolve('../routes/members'), 'utf8');
    vm.runInNewContext(code, { require: name => { if (!(name in deps)) throw Error(name); return deps[name]; }, module: { exports: {} }, console, String, Number, Math, Error, Object, parseFloat });
    const adminRouter = {};
    for (const method of ['get', 'post', 'put', 'delete']) adminRouter[method] = (url, ...args) => { handlers[`admin ${method} ${url}`] = args.at(-1); };
    const adminDeps = { express: { Router: () => adminRouter }, '../models/Member': Member, '../lib/selling-mobile-guard': guard.exports };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/admin'), 'utf8'), { require: name => adminDeps[name] || {}, module: { exports: {} }, console, String, Number, Math, Error, Object, parseFloat });
    async function request(method, body, owner = 'dairy1', id = '') {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers[method]({ body, userId: owner, params: { id }, query: {} }, res);
        return res;
    }
    return { state, request };
}

test('create rejects same-dairy legacy or inactive phone, but permits another dairy', async () => {
    const ctx = fixture([{ _id: 'old', owner: 'dairy1', mobile: '+91 74893 01982', name: 'Old', isActive: false }]);
    let res = await ctx.request('post /', { name: 'New', mobile: '7489301982' });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'Phone number already registered');
    assert.equal(ctx.state.reservations.length, 0); // failed transaction did not keep a reservation
    assert.equal(ctx.state.members.length, 1);
    res = await ctx.request('post /', { name: 'Other dairy', mobile: '7489301982' }, 'dairy2');
    assert.equal(res.statusCode, 201);
    assert.equal(ctx.state.members.length, 2);
});

test('create blocks a second normalized reservation without changing the first customer', async () => {
    const ctx = fixture();
    assert.equal((await ctx.request('post /', { name: 'One', mobile: '7489301982' })).statusCode, 201);
    const res = await ctx.request('post /', { name: 'Two', mobile: '+91 74893-01982' });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'Phone number already registered');
    assert.equal(ctx.state.members.length, 1);
    assert.equal(ctx.state.reservations.length, 1);
});

test('edit prevents conflicts and keeps all fields on failure, but permits unchanged old duplicates', async () => {
    const ctx = fixture([
        { _id: 'one', owner: 'dairy1', mobile: '7489301982', name: 'One', isActive: true },
        { _id: 'two', owner: 'dairy1', mobile: '9999999999', name: 'Two', isActive: true },
        { _id: 'legacy-duplicate', owner: 'dairy1', mobile: '+91 7489301982', name: 'Old', isActive: true },
    ]);
    let res = await ctx.request('put /:id', { name: 'Wrong edit', mobile: '74893 01982' }, 'dairy1', 'two');
    assert.equal(res.statusCode, 409);
    assert.equal(ctx.state.members[1].name, 'Two');
    assert.equal(ctx.state.members[1].mobile, '9999999999');
    assert.equal(ctx.state.reservations.length, 0);
    res = await ctx.request('put /:id', { name: 'Updated', mobile: '7489301982' }, 'dairy1', 'one');
    assert.equal(res.statusCode, 200);
    assert.equal(ctx.state.members[0].name, 'Updated');
    assert.equal(ctx.state.members.length, 3);
});

test('changing phone moves reservation atomically and allows re-use of the old number', async () => {
    const ctx = fixture();
    let res = await ctx.request('post /', { name: 'One', mobile: '7489301982' });
    const id = res.body.response._id;
    res = await ctx.request('put /:id', { mobile: '9999999999' }, 'dairy1', id);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(ctx.state.reservations.map(r => r._id), ['dairy1:9999999999']);
    assert.equal((await ctx.request('post /', { name: 'Two', mobile: '7489301982' })).statusCode, 201);
    assert.equal((await ctx.request('post /', { name: 'Three', mobile: '9999999999' })).statusCode, 409);
});

test('missing or malformed mobile and unknown customer fail without changing data', async () => {
    const ctx = fixture([{ _id: 'one', owner: 'dairy1', mobile: '1234', name: 'One' }]);
    assert.equal((await ctx.request('post /', { name: 'New', mobile: 'abc' })).statusCode, 400);
    assert.equal((await ctx.request('put /:id', { mobile: 'abc' }, 'dairy1', 'one')).statusCode, 400);
    assert.equal((await ctx.request('put /:id', { mobile: '1234' }, 'dairy2', 'one')).statusCode, 404);
    assert.equal(ctx.state.members[0].mobile, '1234');
    assert.equal(ctx.state.reservations.length, 0);
});

test('transaction failure leaves customer and reservation unchanged', async () => {
    const ctx = fixture([{ _id: 'one', owner: 'dairy1', mobile: '7489301982', name: 'One' }], { failCommit: true });
    const res = await ctx.request('put /:id', { name: 'Changed', mobile: '9999999999' }, 'dairy1', 'one');
    assert.equal(res.statusCode, 500);
    assert.equal(ctx.state.members[0].name, 'One');
    assert.equal(ctx.state.members[0].mobile, '7489301982');
    assert.equal(ctx.state.reservations.length, 0);
});

test('admin customer edits enforce the same dairy-scoped rule and preserve unchanged legacy duplicates', async () => {
    const ctx = fixture([
        { _id: 'one', owner: 'dairy1', mobile: '7489301982', name: 'One' },
        { _id: 'two', owner: 'dairy1', mobile: '9999999999', name: 'Two' },
        { _id: 'other', owner: 'dairy2', mobile: '8888888888', name: 'Other' },
    ]);
    let res = await ctx.request('admin put /selling-members/:id', { name: 'Changed', mobile: '+91 74893 01982' }, 'unused', 'two');
    assert.equal(res.statusCode, 409);
    assert.equal(ctx.state.members[1].name, 'Two');
    assert.equal(ctx.state.members[1].mobile, '9999999999');
    res = await ctx.request('admin put /selling-members/:id', { mobile: '7489301982' }, 'unused', 'other');
    assert.equal(res.statusCode, 200);
    assert.equal(ctx.state.members[2].mobile, '7489301982');
    res = await ctx.request('admin put /selling-members/:id', { name: 'Edit', mobile: '+91 7489301982' }, 'unused', 'one');
    assert.equal(res.statusCode, 200);
    assert.equal(ctx.state.members[0].name, 'Edit');
    assert.equal(ctx.state.members.length, 3);
});

test('orphan reservations can be reclaimed without releasing a live or inactive customer number', async () => {
    const ctx = fixture([{ _id: 'old', owner: 'dairy1', mobile: '9999999999', isActive: false }]);
    ctx.state.reservations.push({ _id: 'dairy1:7489301982', owner: 'dairy1', member: 'missing' });
    ctx.state.reservations.push({ _id: 'dairy1:9999999999', owner: 'dairy1', member: 'old' });
    assert.equal((await ctx.request('post /', { name: 'New', mobile: '7489301982' })).statusCode, 201);
    assert.equal((await ctx.request('post /', { name: 'Duplicate', mobile: '9999999999' })).statusCode, 409);
    assert.equal(ctx.state.members.length, 2);
});
