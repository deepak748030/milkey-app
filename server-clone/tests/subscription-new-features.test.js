const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(user, sub = null) {
    const handlers = {};
    const router = { get(path, ...a) { handlers['get ' + path] = a.at(-1); }, post(path, ...a) { handlers['post ' + path] = a.at(-1); } };
    const chain = data => ({ populate() { return this; }, sort() { return this; }, select() { return this; }, async lean() { return data; } });
    let query;
    const deps = { express: { Router: () => router }, '../models/Subscription': { find: () => chain([]) },
        '../models/UserSubscription': { findOne: q => { query = q; return chain(sub); }, find: () => chain(sub ? [sub] : []) },
        '../models/User': { findById: () => chain(user) }, '../models/Referral': {}, '../middleware/auth': () => {},
        '../lib/pushNotifications': {}, axios: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../routes/user-subscriptions'), 'utf8'), { require: n => deps[n], module: { exports: {} }, console, Date, Number, String, Math, Set, Array });
    return { get query() { return query; }, async call(path, params = {}) {
        const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
        await handlers['get ' + path]({ userId: 'owner', user, params }, res);
        return res.body.response;
    } };
}
test('legacy accounts keep Inventory and User Login, new accounts need a current subscription', async () => {
    const old = fixture({ createdAt: new Date('2020-01-01') });
    assert.equal((await old.call('/check/:tab', { tab: 'inventory' })).hasValidSubscription, true);
    assert.equal((await old.call('/check/:tab', { tab: 'user_login' })).hasValidSubscription, true);
    const modern = fixture({ createdAt: new Date(), subscriptionFeatureVersion: 1 });
    assert.equal((await modern.call('/check/:tab', { tab: 'inventory' })).hasValidSubscription, false);
    assert.ok(modern.query.$or[0].startDate.$lte);
    const active = fixture({ subscriptionFeatureVersion: 1 }, { endDate: new Date('2099-01-01'), applicableTabs: ['inventory'] });
    assert.equal((await active.call('/check/:tab', { tab: 'inventory' })).hasValidSubscription, true);
});
test('status does not report queued new features as unlocked', async () => {
    const user = { subscriptionFeatureVersion: 1 };
    const future = { startDate: new Date('2099-01-01'), endDate: new Date('2099-02-01'), applicableTabs: ['inventory', 'user_login'] };
    const data = await fixture(user, future).call('/status');
    assert.equal(data.hasInventory, false);
    assert.equal(data.hasUserLogin, false);
    const old = await fixture({}).call('/status');
    assert.equal(old.hasInventory, true);
    assert.equal(old.hasUserLogin, true);
});
