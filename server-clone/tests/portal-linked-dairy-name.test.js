const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ownerA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ownerB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ownerC = 'cccccccccccccccccccccccc';
const outsider = 'dddddddddddddddddddddddd';
const phone = '7489301982';

function fixture({ noProfiles = false } = {}) {
    const queries = [];
    const settings = [
        { owner: ownerA, dairyName: '  Madhusudan  ', digitalSlipName: 'Not the receipt name', mobileNumber: 'private' },
        { owner: ownerB, dairyName: '   ' },
        { owner: ownerC, dairyName: 'Customer Dairy' },
        { owner: outsider, dairyName: 'Not linked' },
    ];
    const members = noProfiles ? [] : [
        { _id: '111111111111111111111111', owner: ownerA, mobile: phone, code: 'C1', name: 'Customer A', ratePerLiter: 50 },
        { _id: '222222222222222222222222', owner: ownerC, mobile: phone, code: 'C2', name: 'Customer C' },
    ];
    const purchases = noProfiles ? [] : [
        { _id: '333333333333333333333333', owner: ownerA, mobile: phone, code: '1', name: 'Farmer A' },
        { _id: '444444444444444444444444', owner: ownerB, mobile: phone, code: '2', name: 'Farmer B' },
    ];
    const chain = rows => ({ select() { return this; }, lean: async () => rows });
    const users = [
        { _id: ownerA, name: 'Owner A' }, { _id: ownerB, name: 'Owner B' },
        { _id: ownerC, name: 'Owner C' }, { _id: outsider, name: 'Other Owner' },
    ];
    const deps = {
        mongoose: { isValidObjectId: value => /^[a-f0-9]{24}$/.test(String(value)) },
        '../models/Member': { find: () => chain(members) },
        '../models/PurchaseFarmer': { find: () => chain(purchases) },
        '../models/Farmer': { find: () => chain([]) },
        '../models/User': { find: query => chain(users.filter(row => query._id.$in.includes(row._id))) },
        '../models/PrintSettings': { find: query => {
            queries.push(query);
            // Include an out-of-scope row too, to test the defensive owner check.
            return chain(settings.filter(row => query.owner.$in.includes(row.owner) || row.owner === outsider));
        } },
        './ninzaSms': { normalizeIndianMobile: value => ({ ok: true, tenDigit: value }) },
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/portalIdentity'), 'utf8'), {
        require: name => { if (!(name in deps)) throw new Error(name); return deps[name]; },
        module, Number, String, Object, Array, Set, Map, RegExp,
    });
    return { api: module.exports, settings, queries };
}

test('linked by uses receipt dairy name for each module and leaves owner labels intact', async () => {
    const { api, queries } = fixture();
    const identity = await api.findPortalProfiles(phone);
    assert.deepEqual(Array.from(queries[0].owner.$in).sort(), [ownerA, ownerB, ownerC].sort());
    assert.equal(identity.ownerNames[ownerA], 'Owner A');
    assert.equal(identity.collectionLinks[0].dairyName, 'Owner A');
    assert.equal(identity.collectionLinks[0].linkedDairyName, 'Madhusudan');
    const collection = api.publicPortalIdentity(identity, 'collection');
    const selling = api.publicPortalIdentity(identity, 'selling');
    assert.deepEqual(Array.from(collection.linkedDairyNames), ['Madhusudan', 'Owner B']);
    assert.deepEqual(Array.from(selling.linkedDairyNames), ['Madhusudan', 'Customer Dairy']);
    assert.deepEqual(Array.from(collection.moduleProfiles.selling.linkedDairyNames), ['Madhusudan', 'Customer Dairy']);
    assert.equal(selling.milkRate, 50);
    assert.ok(!JSON.stringify(collection).includes('Not linked'));
    assert.ok(!JSON.stringify(collection).includes('private'));
});

test('missing settings fall back to owner name and setting edits are picked up on refresh', async () => {
    const ctx = fixture();
    ctx.settings.splice(0, ctx.settings.length, { owner: ownerA, dairyName: '' });
    let identity = await ctx.api.findPortalProfiles(phone);
    assert.deepEqual(Array.from(ctx.api.publicPortalIdentity(identity, 'collection').linkedDairyNames), ['Owner A', 'Owner B']);
    ctx.settings[0].dairyName = 'Updated Dairy';
    identity = await ctx.api.findPortalProfiles(phone);
    assert.equal(ctx.api.publicPortalIdentity(identity, 'collection').linkedDairyNames[0], 'Updated Dairy');
});

test('unlinked portal identity never queries dairy settings', async () => {
    const ctx = fixture({ noProfiles: true });
    const identity = await ctx.api.findPortalProfiles(phone);
    assert.equal(ctx.queries.length, 0);
    assert.equal(identity.availableModules.collection, false);
    assert.equal(identity.availableModules.selling, false);
});
