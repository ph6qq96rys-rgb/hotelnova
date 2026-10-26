const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../node_modules/typescript');
const source = fs.readFileSync('src/features/operations/pages/OperationsDashboardPage.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let action;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'toggleChecklist') action = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(action, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
function fixture() {
  let resolve, reject, calls = 0;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  const original = { id: 'plan', status: 'Ready', criticalOpenCount: 1, checklistItems: [{ id: 'check', isCompleted: false, isCritical: true }] };
  const env = {
    plan: original, readOnly: false, busy: false, companyId: 'company', branchId: 'branch',
    loadVersion: { current: 1 }, checklistSaveInFlight: { current: false },
    isSavedPlan: Boolean, t: x => x, errorText: e => e.message,
    setPlan: value => { env.visible = value; },
    setNotice: value => { env.notice = value; },
    setChecklistSaving: value => { env.saving = value; },
    setPlanRegister: update => { env.register = update([{ id: 'plan' }]); },
    operationsApi: { updateChecklist: async (...args) => { calls++; env.args = args; return response; } },
    loadPlanRegister: () => { throw new Error('Unnecessary history refresh'); },
    setBusy: () => { throw new Error('Global saving state must not change'); },
  };
  const toggle = new Function('env', `with (env) { ${code}; return toggleChecklist; }`)(env);
  return { env, original, toggle, resolve, reject, calls: () => calls };
}
(async () => {
  const f = fixture();
  const pending = f.toggle(f.original.checklistItems[0], true);
  assert.equal(f.env.visible.checklistItems[0].isCompleted, true);
  assert.equal(f.env.visible.criticalOpenCount, 0);
  await f.toggle(f.original.checklistItems[0], false);
  assert.equal(f.calls(), 1);
  const saved = { ...f.env.visible, updatedAtUtc: 'new-version' };
  f.resolve({ data: saved }); await pending;
  assert.equal(f.env.visible, saved);
  assert.equal(f.env.register[0].completedChecklistCount, 1);
  assert.equal(f.env.saving, false);
  assert.deepEqual(f.env.args[3], [{ id: 'check', isCompleted: true, notes: null }]);
  const failed = fixture(); const attempt = failed.toggle(failed.original.checklistItems[0], true);
  failed.reject(new Error('Save failed')); await attempt;
  assert.equal(failed.env.visible, failed.original);
  assert.equal(failed.env.notice.tone, 'error');
  assert.equal(failed.env.saving, false);
  const stale = fixture(); const old = stale.toggle(stale.original.checklistItems[0], true);
  stale.env.loadVersion.current++; stale.env.visible = null;
  stale.resolve({ data: saved }); await old;
  assert.equal(stale.env.visible, null);
  console.log('PASS: one-request checkbox save, optimistic counts, duplicate guard, rollback, and stale response protection');
})();
