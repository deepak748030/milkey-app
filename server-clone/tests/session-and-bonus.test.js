const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function routes(file, dependencies) {
  const handlers = {};
  const router = {};
  for (const method of ['get', 'post', 'put', 'delete']) {
    router[method] = (route, ...args) => { handlers[`${method} ${route}`] = args.at(-1); };
  }
  const code = fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');
  const auth = () => {}; auth.forDeviceRegistration = auth;
  const localRequire = name => {
    if (name === 'express') return { Router: () => router };
    if (name === '../middleware/auth') return auth;
    if (name === '../middleware/subscription') return {};
    if (name in dependencies) return dependencies[name];
    throw Error(`Unexpected module ${name}`);
  };
  vm.runInNewContext(code, { require: localRequire, module: { exports: {} }, console, Date, Number, String, RegExp, parseFloat, parseInt });
  return handlers;
}
function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
}

test('bonus collection saves amount and split for percentage, per litre and no bonus', async () => {
  let saved;
  const MilkCollection = {
    create: async data => (saved = { ...data, _id: 'entry' }),
    findById: () => ({ populate: () => ({ lean: async () => saved }) }),
  };
  const handlers = routes('milk-collections.js', {
    '../models/MilkCollection': MilkCollection,
    '../models/PurchaseFarmer': {}, '../models/Farmer': {},
  });
  for (const [bonusType, bonusRate, expected] of [['percent', 10, 90], ['perLitre', 2, 20], ['', 0, 0]]) {
    const res = response();
    await handlers['post /']({ userId: 'owner', body: { quantity: 10, rate: 90, shift: 'morning', bonusType, bonusRate } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.baseAmount, 900);
    assert.equal(saved.bonusAmount, expected);
    assert.equal(saved.amount, 900 + expected);
  }
});

test('device registration rejects stale tokens and accepts a fresh login', async () => {
  let updateCount = 0;
  const existing = { isActive: false, lastActive: new Date(1000) };
  const Device = {
    findOne: () => ({ select: () => ({ lean: async () => existing }) }),
    findOneAndUpdate: async () => { updateCount++; return { isActive: true }; },
    find: () => ({ sort: () => ({ select: async () => [] }) }),
  };
  const handlers = routes('devices.js', { '../models/Device': Device });
  for (const [issued, status] of [[500, 401], [undefined, 401], [1001, 200]]) {
    const res = response();
    await handlers['post /register']({ userId: 'u', authIssuedAtMs: issued, headers: { 'x-device-id': 'd' }, body: { deviceId: 'd' } }, res);
    assert.equal(res.statusCode, status);
  }
  assert.equal(updateCount, 1);
});

test('bonus capability is advertised and editing quantity preserves percentage bonus', async () => {
  const entry = {
    _id: 'entry', quantity: 10, rate: 90, amount: 990, baseAmount: 900,
    bonusAmount: 90, bonusRate: 10, bonusType: 'percent', purchaseFarmer: null,
    save: async function () { this.baseAmount = this.quantity * this.rate; this.amount = this.baseAmount + this.bonusAmount; },
  };
  const MilkCollection = {
    findOne: async () => entry,
    findById: () => ({ populate: () => ({ lean: async () => entry }) }),
  };
  const handlers = routes('milk-collections.js', {
    '../models/MilkCollection': MilkCollection,
    '../models/PurchaseFarmer': {}, '../models/Farmer': {},
  });
  const cap = response();
  handlers['get /bonus-capability']({}, cap);
  assert.equal(cap.body.response.bonusPersistence, true);
  const res = response();
  await handlers['put /:id']({ userId: 'owner', params: { id: 'entry' }, body: { quantity: 20 } }, res);
  assert.equal(res.body.success, true);
  assert.equal(entry.bonusAmount, 180);
  assert.equal(entry.amount, 1980);
});
