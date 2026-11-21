const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../components/purchase/tabs/PurchaseReportTab.tsx'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), Fragment: 'Fragment' };
const mocks = new Proxy({}, { get: (_, key) => key });
const mod = { exports: {} };
vm.runInNewContext(output, { module: mod, exports: mod.exports, require: name => name === 'react' ? React : mocks, Object, Number, String });
const styles = new Proxy({}, { get: (_, key) => key });
const farmer = { _id: 'farmer-id-11', code: '11', name: 'Prem Singh' };
const allNodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(allNodes)];
function render(patch = {}) {
    const calls = [];
    const row = { _id: 'entry', farmerCode: '11', date: '2026-11-15', shift: 'morning', quantity: 5, amount: 220 };
    const ctx = { s: styles, colors: { primary: 'green', card: 'white', border: 'gray', foreground: 'black' },
        t: { common: { code: 'Code', milk: 'Milk', fat: 'Fat', snf: 'SNF', rate: 'Rate', amount: 'Amount', total: 'Total' }, purchase: { milk: 'Milk', fat: 'Fat', snf: 'SNF', amt: 'Amount' } },
        reportStartDate: '2026-11-11', reportEndDate: '2026-11-20', reportFarmerFilter: '', reportLoading: false,
        reportCollections: [row], filteredReportCollections: [row], filteredReportTotals: { quantity: 5, amount: 220 }, reportTotalCount: 1,
        reportFarmers: [farmer], reportFarmerCodeSearch: '11', showReportFarmerModal: true,
        setSelectedReportFarmer: value => calls.push(value), setReportFarmerCodeSearch() {}, setShowReportFarmerModal() {},
        formatDateStr: value => value, ...patch };
    return { nodes: allNodes(mod.exports.PurchaseReportTab({ ctx })), calls, ctx };
}
test('report picker selects the complete farmer and can find a searched code', () => {
    const { nodes, calls } = render();
    const list = nodes.find(node => node.type === 'FlatList');
    assert.equal(list.props.data[0], farmer);
    list.props.renderItem({ item: farmer }).props.onPress();
    assert.equal(calls[0], farmer);
});
test('empty, loading and partial reports cannot print or export unrelated entries', () => {
    for (const patch of [
        { filteredReportCollections: [], reportCollections: [], reportTotalCount: 0 },
        { reportLoading: true }, { reportError: 'Network error' },
        { reportTotalCount: 100 },
    ]) {
        const { nodes } = render(patch);
        const buttons = nodes.filter(node => node.type === 'Pressable' && node.props.disabled === true);
        assert.equal(buttons.length, 3);
    }
});
