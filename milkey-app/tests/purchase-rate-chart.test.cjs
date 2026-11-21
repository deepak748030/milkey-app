const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('node:assert/strict');
const ts = require('typescript');
const test = require('node:test');
const code = fs.readFileSync(path.join(__dirname, '../components/purchase/tabs/PurchaseCollectionTab.tsx'), 'utf8');
const transformed = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), Fragment: 'Fragment' };
const components = new Proxy({}, { get: (_, key) => key });
const mod = { exports: {} };
vm.runInNewContext(transformed, { module: mod, exports: mod.exports, require: name => name === 'react' ? React : components, Number, Object });
const styles = new Proxy({}, { get: (_, key) => key });
const colors = { primary: 'green', mutedForeground: 'gray', destructive: 'red', card: 'white', background: 'white', foreground: 'black' };
const ctx = { s: styles, colors, t: { common: { morning: 'Morning', evening: 'Evening', quantity: 'Quantity', amount: 'Amount' }, purchase: { avgRate: 'Avg Rate', enterCode: 'Enter code', cow: 'Cow', buffalo: 'Buffalo' } }, formatDate: () => '21 Nov', historyTotals: { quantity: 0, amount: 0 }, todayRate: 55, inlineSearchCode: '', inlineSearchResults: [], computeAmount: () => 0, milkType: 'cow' };
const strings = node => typeof node === 'string' ? [node] : !node || typeof node !== 'object' ? [] : (node.children || []).flat(Infinity).flatMap(strings);
const summary = node => node && typeof node === 'object' ? node.props?.style === 'summaryBar' ? node : (node.children || []).flat(Infinity).map(summary).find(Boolean) : undefined;
for (const [name, customer, searching, expected] of [
 ['no farmer', null, false, false], ['rate chart', { code: '1', name: 'Chart', priceBasis: 'fat_snf' }, false, true],
 ['fixed rate', { code: '2', name: 'Fixed', priceBasis: 'rate' }, false, false], ['fat rate', { code: '3', name: 'Fat', priceBasis: 'fat' }, false, false],
 ['searching for another code', { code: '1', name: 'Chart', priceBasis: 'fat_snf' }, true, false],
 ['legacy missing basis', { code: '4', name: 'Legacy' }, false, false],
]) test(name, () => {
 const tree = mod.exports.PurchaseCollectionTab({ ctx: { ...ctx, selectedCustomer: customer, showInlineSearch: searching } });
 const content = strings(summary(tree));
 assert.equal(content.includes('Rate Chart'), expected, name);
 assert.equal(content.includes('Quantity'), true, name + ' quantity');
 assert.equal(content.includes('Avg Rate'), true, name + ' average');
 assert.equal(content.includes('Amount'), true, name + ' amount');
 if (expected) assert.ok(content.includes('55.00'), name + ' displayed rate');
});
