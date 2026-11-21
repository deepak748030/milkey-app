const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/selling.tsx'), 'utf8');
const start = source.indexOf('            {(() => {', source.indexOf('{/* Payment History */}'));
const end = source.indexOf('            })()}', start) + '            })()}'.length;
assert.ok(start > 0 && end > start);
const jsx = source.slice(start, end);
const js = ts.transpileModule(`export function render() { return <View>${jsx}</View>; }`, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
const helper = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/sellingPayment.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const helperMod = { exports: {} }; vm.runInNewContext(helper, { module: helperMod, exports: helperMod.exports });
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : !node || typeof node !== 'object' ? '' : (node.children || []).flat(Infinity).map(text).join(' ');
function render(patch = {}) {
    const mod = { exports: {} };
    const context = { module: mod, exports: mod.exports, React, View:'View', Text:'Text', Pressable:'Pressable', ActivityIndicator:'ActivityIndicator', Printer:'Printer', Edit2:'Edit2',
        styles: new Proxy({}, { get: (_, k) => k }), colors: {}, selectedPaymentMember: { _id:'prem', name:'Prem' }, memberPayments: [], recentPayments: [], memberPaymentsLoading:false, memberPaymentsError:'', memberPaymentsHasMore:false, memberPaymentsLoadingMore:false, paymentsHasMore:false, paymentsLoadingMore:false,
        formatDateDDMMYYYY: x => x, formatSellingAdvance: helperMod.exports.formatSellingAdvance, loadMemberPaymentHistory(){}, loadMoreMemberPayments(){}, loadMorePayments(){}, handlePrintSellingPaymentSlip(){}, handleEditPayment(){}, ...patch };
    vm.runInNewContext(js, context); return mod.exports.render();
}
const payment = (id, balance, advance, effect) => ({ _id:id, member:{ _id:'prem', name:'Prem' }, date:'today', amount:10, totalSellAmount:50, closingBalance:balance, advanceApplied:advance, advanceEffect:effect });
test('selected history shows positive, zero and negative closing balances and their saved advance rules', () => {
    const content = text(render({ memberPayments:[payment('1',50,20,'add'),payment('2',0,5,'subtract'),payment('3',-10,undefined,undefined)] }));
    assert.equal((content.match(/Selling Advance:/g) || []).length, 3);
    assert.match(content, /₹\+20\.00/); assert.match(content, /₹-5\.00/); assert.match(content, /Not recorded/);
    assert.match(content, /₹ 50\.00/); assert.match(content, /₹ 0\.00/); assert.match(content, /- ₹ 10\.00/);
});
test('selected history is separate from global latest list and displays load more', () => {
    const content = text(render({ memberPayments: [payment('a',0,0,'add')], recentPayments: [payment('b',0,99,'add')], memberPaymentsHasMore:true }));
    assert.match(content, /Load More/); assert.doesNotMatch(content, /99\.00/);
});
test('loading and failure are not falsely shown as no payments', () => {
    assert.doesNotMatch(text(render({ memberPaymentsLoading:true })), /No payments/);
    const content = text(render({ memberPaymentsError:'Network error' }));
    assert.match(content, /Network error/); assert.match(content, /Retry/); assert.doesNotMatch(content, /No payments/);
});

function historyLoader() {
    const begin = source.indexOf('    const loadMemberPaymentHistory = async');
    const finish = source.indexOf('    const loadMoreMemberPayments =', begin);
    assert.ok(begin > 0 && finish > begin);
    const loader = source.slice(begin, finish);
    const code = ts.transpileModule(`export function setup(env: any) { const { memberPaymentsRequest, memberPaymentsApi, setMemberPayments, setMemberPaymentsLoading, setMemberPaymentsLoadingMore, setMemberPaymentsHasMore, setMemberPaymentsError, setMemberPaymentsPage } = env; ${loader} return loadMemberPaymentHistory; }`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const mod = { exports: {} }; vm.runInNewContext(code, { module: mod, exports: mod.exports, Set, Error });
    const state = { memberPayments:[], loading:false, loadingMore:false, hasMore:false, error:'', page:1 };
    const pending = [];
    const env = { memberPaymentsRequest: { current:0 }, memberPaymentsApi: { getAll(args) { return new Promise((resolve,reject) => pending.push({ args, resolve, reject })); } },
        setMemberPayments(v) { state.memberPayments = typeof v === 'function' ? v(state.memberPayments) : v; }, setMemberPaymentsLoading(v) { state.loading = v; }, setMemberPaymentsLoadingMore(v) { state.loadingMore = v; }, setMemberPaymentsHasMore(v) { state.hasMore = v; }, setMemberPaymentsError(v) { state.error = v; }, setMemberPaymentsPage(v) { state.page = v; } };
    return { state, pending, env, load: mod.exports.setup(env) };
}
test('history requests ignore stale customer responses and append later pages without duplicates', async () => {
    const ctx = historyLoader();
    const first = ctx.load('first'); const second = ctx.load('second');
    ctx.pending[1].resolve({ success:true, response:{ data:[payment('new',0,0,'add')], pagination:{pages:2} } }); await second;
    ctx.pending[0].resolve({ success:true, response:{ data:[payment('stale',50,1,'add')], pagination:{pages:1} } }); await first;
    assert.equal(ctx.state.memberPayments[0]._id, 'new'); assert.equal(ctx.state.hasMore, true);
    const more = ctx.load('second',2,true);
    ctx.pending[2].resolve({ success:true, response:{ data:[payment('new',0,0,'add'),payment('older',-1,2,'subtract')], pagination:{pages:2} } }); await more;
    assert.equal(ctx.state.memberPayments.map(p => p._id).join(','), 'new,older');
    assert.equal(ctx.state.page, 2); assert.equal(ctx.state.hasMore, false);
});
test('failed load-more keeps previous rows and retry available', async () => {
    const ctx = historyLoader(); const first = ctx.load('prem');
    ctx.pending[0].resolve({ success:true, response:{ data:[payment('one',0,0,'add')], pagination:{pages:2} } }); await first;
    const more = ctx.load('prem', 2, true); ctx.pending[1].reject(new Error('Network error')); await more;
    assert.equal(ctx.state.memberPayments[0]._id, 'one'); assert.equal(ctx.state.hasMore,true); assert.equal(ctx.state.error,'Network error');
});
