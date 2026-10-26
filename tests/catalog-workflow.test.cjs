const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/features/eventmanagment/screens/catalogWorkflowStages.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const fixture = { exports: {} };
new Function('exports', 'module', compiled)(fixture.exports, fixture);
const { packageWorkflow, itemPreparationIssues } = fixture.exports;
const item = { id: 'food', name: 'Tibs', itemType: 'Food', isActive: true, recipeId: 'recipe', consumptionLocationId: 'kitchen', estimatedUnitCost: 50, sellingPrice: 100 };
const pkg = () => ({ name: 'Lunch', isActive: true, isApproved: true, approvedVersion: 3, catalogVersion: 3, pricePerPerson: 100,
  offering: { pricingSource: 'MenuItems', pricingMode: 'PerPerson', archived: false, sections: [{ items: [{ itemId: 'food', quantity: 1 }] }] } });
const stage = (p, items = [item]) => packageWorkflow(p, items, '2026-10-22').stage;
test('complete current approved package is ready', () => assert.equal(stage(pkg()), 'ready'));
test('an old approval never makes a revised package ready', () => assert.equal(stage({ ...pkg(), approvedVersion: 2 }), 'approval'));
test('inactive and future/expired offerings are not ready', () => {
  assert.equal(stage({ ...pkg(), isActive: false }), 'availability');
  for (const dates of [{ effectiveDate: '2026-10-23' }, { expiryDate: '2026-10-21' }]) {
    const p = pkg(); Object.assign(p.offering, dates); assert.equal(stage(p), 'availability');
  }
});
test('missing or inactive items go to cost review even with approval', () => {
  assert.equal(stage(pkg(), []), 'cost');
  assert.equal(stage(pkg(), [{ ...item, isActive: false }]), 'cost');
});
test('recipes need a consumption location', () => assert.ok(itemPreparationIssues({ ...item, consumptionLocationId: null }).includes('Choose a consumption location')));
test('legacy and empty packages need composition', () => {
  assert.equal(stage({ ...pkg(), offering: null }), 'compose');
  const p = pkg(); p.offering.sections = []; assert.equal(stage(p), 'compose');
});
test('manual price packages do not depend on individual selling prices', () => {
  const p = pkg(); p.offering.pricingSource = 'Manual';
  assert.equal(stage(p, [{ ...item, sellingPrice: 0 }]), 'ready');
  p.pricePerPerson = 0; assert.equal(stage(p), 'cost');
});
test('archive takes precedence over other stage conditions', () => {
  const p = pkg(); p.offering.archived = true; assert.equal(stage(p, []), 'archived');
});
