const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const phone = '7489301982';
const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const records = [
    { _id: '111111111111111111111111', owner, mobile: '74893 01982', name: 'Formatted' },
    { _id: '222222222222222222222222', owner, mobile: '+91 (748) 930-1982', name: 'Country' },
    { _id: '333333333333333333333333', owner, mobile: '997489301982', name: 'Wrong prefix' },
    { _id: '444444444444444444444444', owner, mobile: '74893 01983', name: 'Other phone' },
    { _id: '555555555555555555555555', owner, mobile: phone, isActive: false },
];
function normalize(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits) ? { ok: true, tenDigit: digits } : { ok: false };
}
const chain = data => ({ select() { return this; }, async lean() { return data; } });

test('portal discovers formatted linked mobiles but never links a different prefix or phone', async () => {
    let memberQuery;
    const deps = {
        mongoose: { isValidObjectId: () => true },
        '../models/Member': { find(query) {
            memberQuery = query;
            return chain(records.filter(row => row.isActive !== false && query.$or.some(condition =>
                condition.mobile.$in ? condition.mobile.$in.includes(row.mobile) : new RegExp(condition.mobile.$regex).test(row.mobile))));
        } },
        '../models/PurchaseFarmer': { find: () => chain([]) }, '../models/Farmer': { find: () => chain([]) },
        '../models/User': { find: () => chain([{ _id: owner, name: 'Dairy' }]) },
        '../models/PrintSettings': { find: () => chain([]) },
        './portal-feature-access': { portalEligibleOwnerIds: async users => new Set(users.map(user => String(user._id))) },
        './ninzaSms': { normalizeIndianMobile: normalize },
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/portalIdentity'), 'utf8'), { require: n => deps[n], module, Number, String, Object, Array, Set, Map, RegExp });
    const identity = await module.exports.findPortalProfiles(phone);
    assert.ok(new RegExp(memberQuery.$or[1].mobile.$regex).test('74893 01982'));
    assert.deepEqual(Array.from(identity.sellingLinks[0].memberIds), [records[0]._id, records[1]._id]);
    assert.equal(identity.availableModules.selling, true);
});
