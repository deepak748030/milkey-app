const test = require('node:test');
const assert = require('node:assert/strict');
const { settlementCollectionEntries } = require('../lib/settlementCollectionEntries.ts');

test('snapshots take priority over live linked entries and preserve all amounts', () => {
    const result = settlementCollectionEntries({
        collectionSnapshots: [{ id: 'a', date: '2026-11-23', quantity: 5, rate: 60, amount: 300, bonusAmount: 0 }, { id: 'b', quantity: 6.5, rate: 60, amount: 390, bonusAmount: 0 }],
        settledCollections: [{ _id: 'other', quantity: 100, amount: 10000 }],
    });
    assert.equal(result.snapshot, true);
    assert.deepEqual(result.rows.map(r => r.id), ['a', 'b']);
    assert.equal(result.quantity, 11.5);
    assert.equal(result.amount, 690);
    assert.equal(result.bonus, 0);
});

test('an empty saved snapshot is a known zero, not a date-range lookup', () => {
    const result = settlementCollectionEntries({ collectionSnapshots: [], settledCollections: [{ _id: 'other', quantity: 10 }] });
    assert.equal(result.rows.length, 0);
    assert.equal(result.quantity, 0);
    assert.equal(result.amount, 0);
});

test('old payments use only available linked documents, never guess missing entries', () => {
    const linked = settlementCollectionEntries({ settledCollections: [{ _id: 'a', quantity: 2, amount: 150 }, 'missing-id'] });
    assert.equal(linked.snapshot, false);
    assert.equal(linked.rows.length, 1);
    assert.equal(linked.quantity, null);
    assert.equal(linked.amount, null);
    assert.equal(settlementCollectionEntries({ settledCollections: [] }).quantity, null);
    assert.equal(settlementCollectionEntries({}).quantity, null);
});

test('a missing value is not turned into zero', () => {
    const result = settlementCollectionEntries({ collectionSnapshots: [{ id: 'a', quantity: null, amount: 150 }] });
    assert.equal(result.quantity, null);
    assert.equal(result.amount, 150);
    assert.equal(result.bonus, null);
});
