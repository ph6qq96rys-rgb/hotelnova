const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const file = path.join(__dirname, "../src/features/company/onboarding/steps/StockLocationsStep.tsx");
const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["activeOf", "activeBranchAssignments", "boolOf", "branchEligibleLocations"]);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(functions.length, names.size);
const js = ts.transpileModule(functions.map(node => node.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = {};
vm.runInNewContext(js, scope);
const rows = [
  { stockLocationId: "warehouse", isActive: true },
  { stockLocationId: "removed", isActive: false },
  { stockLocationId: "removed-legacy", IsActive: false },
];
assert.deepEqual(scope.activeBranchAssignments(rows).map(row => row.stockLocationId), ["warehouse"]);
rows[1].isActive = true;
assert.deepEqual(scope.activeBranchAssignments(rows).map(row => row.stockLocationId), ["warehouse", "removed"]);
assert.equal(scope.activeBranchAssignments(null).length, 0);
const locations = [{ id: "prod", canSell: false }, { id: "sales", canSell: true }, { id: "legacy", CanSell: true }];
assert.deepEqual(scope.branchEligibleLocations(locations, false).map(x => x.id), ["prod"]);
assert.equal(scope.branchEligibleLocations(locations, true).length, 3);
console.log("Branch assignments: inactive rows stay unselected; explicitly reassigned rows return.");
