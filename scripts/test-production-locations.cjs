const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const file = path.join(__dirname, "../src/features/production/pages/ProductionBatchPage.tsx");
const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["text", "locationIdOf", "locationTypeOf", "isIssueLocation", "isOutputLocation"]);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(functions.length, names.size);
const js = ts.transpileModule(functions.map(node => node.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = {};
vm.runInNewContext(js, scope);

const production = { id: "production", locationType: "Production", isProductionCenter: true,
  isConsumptionLocation: true, isActive: true, canConsumeFrom: true, canIssue: true, canReceive: true };
const warehouse = { id: "warehouse", locationType: "Warehouse", isMainWarehouse: true,
  isActive: true, canIssue: true, canReceive: true };
assert.equal(scope.isIssueLocation(production), true);
assert.equal(scope.isOutputLocation(warehouse), true);
assert.equal(scope.isIssueLocation({ ...production, canIssue: false }), false);
assert.equal(scope.isOutputLocation({ ...warehouse, canReceive: false }), false);
for (const locationType of ["Waste", "Transit", 6, 7]) {
  assert.equal(scope.isIssueLocation({ ...production, locationType }), false);
  assert.equal(scope.isOutputLocation({ ...warehouse, locationType }), false);
}
for (const invalid of [{ isActive: false }, { id: "" }]) {
  assert.equal(scope.isIssueLocation({ ...production, ...invalid }), false);
  assert.equal(scope.isOutputLocation({ ...warehouse, ...invalid }), false);
}
console.log("Production location filters: production consumption, warehouse receipt, capabilities and exclusions passed.");
