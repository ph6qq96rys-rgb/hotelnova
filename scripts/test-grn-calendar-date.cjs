const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const dateScope = { exports: {} };
vm.runInNewContext(compile("../src/shared/datetime/dateFormat.ts"), dateScope);
const scope = { exports: {}, require: name => name.includes("datetime") ? dateScope.exports : {} };
vm.runInNewContext(compile("../src/features/inventory/grn/helpers/grn.formatters.ts"), scope);
for (const value of ["2026-09-11", "2026-09-11T00:00:00", "2026-09-11T23:59:59.9999999", "2026-09-11T23:59:59Z"]) {
  assert.equal(scope.exports.formatDate(value), "11/09/2026");
}
assert.equal(scope.exports.formatDate(null), "-");
assert.equal(scope.exports.formatDateTime("2026-09-11T23:59:59Z"), "12/09/2026, 02:59");
console.log("GRN calendar dates retain their saved day; audit timestamps retain timezone conversion.");
