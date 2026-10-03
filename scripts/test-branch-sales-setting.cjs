const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const file = path.join(__dirname, "../src/features/company/onboarding/steps/BranchStep.tsx");
const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && ["toForm", "normalize"].includes(node.name?.text));
assert.equal(functions.length, 2);
const js = ts.transpileModule(functions.map(node => node.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = { trimOrNull: value => String(value ?? "").trim() || null };
vm.runInNewContext(js, scope);
for (const enabled of [true, false]) {
  const loaded = { id: "production", code: "PROD", name: "Production", hasSalesOperations: enabled };
  const form = scope.toForm(loaded);
  assert.equal(form.hasSalesOperations, enabled);
  assert.equal(scope.normalize(form).hasSalesOperations, enabled);
  const toggled = scope.normalize({ ...form, hasSalesOperations: !enabled });
  assert.equal(toggled.hasSalesOperations, !enabled);
  assert.equal(scope.toForm(JSON.parse(JSON.stringify(toggled))).hasSalesOperations, !enabled);
}
console.log("Branch sales setting: explicit false survives load, edit, payload and reload.");
