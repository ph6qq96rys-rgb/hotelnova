const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.join(__dirname, '../src/features/pos/pages/PosSalesPage.tsx');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['round2', 'buildTotals', 'toCartItem']);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(functions.length, names.size);
const scope = {};
vm.runInNewContext(ts.transpileModule(functions.map(node => node.getText(source)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const pricing = { vatRate: 15, serviceChargeRate: 10, contingencyRate: 10, pricesIncludeVat: false };
const cart = [{ price: 100, qty: 1, lineTotal: 100, pricing }];
assert.equal(scope.buildTotals(cart).total, 125);
assert.equal(scope.buildTotals(cart).tax, 15);
assert.equal(scope.buildTotals(cart).serviceCharge, 10);
assert.equal(scope.toCartItem({ id: '1', sellingPrice: 100, pricing }).pricing, pricing);
assert.equal(scope.buildTotals([{ lineTotal: 115, pricing: { ...pricing, pricesIncludeVat: true } }]).total, 125);
assert.equal(scope.buildTotals([{ lineTotal: 100, pricing: { ...pricing, vatRate: 0, serviceChargeRate: 0 } }]).total, 100);
assert.equal(scope.buildTotals([...cart, { lineTotal: 100, pricing: { ...pricing, vatRate: 0, serviceChargeRate: 0 } }]).total, 225);
assert.equal(scope.round2(1.005), 1.01);
assert.equal(scope.round2(0.075), 0.08);
assert.equal(scope.buildTotals([{ lineTotal: 0.5, pricing }]).tax, 0.08);
assert.equal(scope.buildTotals([]).total, 0);
console.log('POS pricing: separate VAT/service, no contingency charge, inclusive prices, mixed overrides and rounding passed.');
