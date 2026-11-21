const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(subscriptions) {
    let query;
    const model = { find(q) {
        query = q;
        const now = q.endDate.$gt;
        return { select() { return this; }, async lean() {
            return subscriptions.filter(s => q.user.$in.includes(s.user) && s.applicableTabs.includes(q.applicableTabs)
                && s.isActive && s.paymentStatus === 'completed' && s.endDate > now && (!s.startDate || s.startDate <= now));
        } };
    } };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/portal-feature-access'), 'utf8'), { require: () => model, module, Date, Set, String });
    return { api: module.exports, get query() { return query; } };
}
test('old dairy remains eligible; new dairies require a current, completed User Login plan', async () => {
    const now = new Date('2026-11-21T00:00:00Z');
    const common = { applicableTabs: ['user_login'], isActive: true, paymentStatus: 'completed', startDate: new Date('2026-11-20T00:00:00Z'), endDate: new Date('2026-11-22T00:00:00Z') };
    const users = [{ _id: 'old' }, ...['active', 'pending', 'queued', 'expired', 'disabled', 'other'].map(_id => ({ _id, subscriptionFeatureVersion: 1 }))];
    const ctx = fixture([
        { ...common, user: 'active' }, { ...common, user: 'pending', paymentStatus: 'pending' },
        { ...common, user: 'queued', startDate: new Date('2026-11-22T00:00:00Z') },
        { ...common, user: 'expired', endDate: now }, { ...common, user: 'disabled', isActive: false },
        { ...common, user: 'other', applicableTabs: ['purchase', 'selling'] },
    ]);
    const allowed = await ctx.api.portalEligibleOwnerIds(users, now);
    assert.deepEqual(Array.from(allowed).sort(), ['active', 'old']);
    assert.equal(ctx.query.applicableTabs, 'user_login');
    assert.equal(ctx.query.paymentStatus, 'completed');
    assert.equal(ctx.query.$or[0].startDate.$lte, now);
});

test('unlinked or missing dairy owners never receive portal access', async () => {
    const ctx = fixture([]);
    assert.equal((await ctx.api.portalEligibleOwnerIds([])).size, 0);
    assert.equal(ctx.query, undefined);
});
