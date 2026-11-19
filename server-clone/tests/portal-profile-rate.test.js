const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function identityModule() {
    const module = { exports: {} };
    const dependencies = {
        mongoose: {}, '../models/Member': {}, '../models/PurchaseFarmer': {}, '../models/Farmer': {}, '../models/User': {}, '../lib/ninzaSms': {}, './ninzaSms': {},
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/portalIdentity'), 'utf8'), { require: n => dependencies[n], module, Number, String, Object, Array, Set, Map, RegExp });
    return module.exports;
}
function fixture(rate) {
    return {
        phone: '7489301982', dairyNames: ['Dairy'], availableModules: { selling: true, collection: true },
        collectionLinks: [{ name: 'Farmer', code: 'F01', dairyName: 'Dairy' }],
        sellingLinks: [{ name: 'Customer', code: 'C01', dairyName: 'Dairy', memberDocs: [{ ratePerLiter: rate }, { ratePerLiter: 99 }] }],
    };
}
test('selling profile exposes configured rate of the displayed customer', () => {
    const { publicPortalIdentity } = identityModule();
    const selling = publicPortalIdentity(fixture(52.75), 'selling');
    assert.equal(selling.name, 'Customer');
    assert.equal(selling.milkRate, 52.75);
    assert.equal(selling.moduleProfiles.selling.milkRate, 52.75);
    const collection = publicPortalIdentity(fixture(52.75), 'collection');
    assert.equal(collection.name, 'Farmer');
    assert.equal(collection.milkRate, null);
    assert.equal(collection.moduleProfiles.collection.milkRate, undefined);
});
test('zero rate is retained and missing or invalid rates are not invented', () => {
    const { publicPortalIdentity } = identityModule();
    assert.equal(publicPortalIdentity(fixture(0), 'selling').milkRate, 0);
    assert.equal(publicPortalIdentity(fixture(undefined), 'selling').milkRate, null);
    assert.equal(publicPortalIdentity(fixture('not-a-number'), 'selling').milkRate, null);
    assert.equal(publicPortalIdentity(fixture(-5), 'selling').milkRate, null);
});
