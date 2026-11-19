// The existing ledger treats manual adjustments as offsets against all pending
// given advances. Apply only the net pending amount; leave the offset in place.
const cents = value => Math.round((Number(value) || 0) * 100);

function planSellingAdvance(docs) {
    let given = 0;
    let adjusted = 0;
    const eligible = [];
    for (const doc of docs) {
        if (doc.isDeleted) continue;
        if (doc.type === 'adjusted') {
            adjusted += cents(doc.amount);
        } else if (doc.status !== 'settled') {
            const remaining = Math.max(0, cents(doc.amount) - cents(doc.settledAmount));
            given += remaining;
            if (remaining) eligible.push({ doc, remaining });
        }
    }
    let left = Math.max(0, given - adjusted);
    const amount = left;
    const allocations = [];
    for (const item of eligible) {
        const applied = Math.min(item.remaining, left);
        if (applied) allocations.push({ doc: item.doc, amount: applied / 100 });
        left -= applied;
    }
    return { amount: amount / 100, allocations };
}

module.exports = { planSellingAdvance };
