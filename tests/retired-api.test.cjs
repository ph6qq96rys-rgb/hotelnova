const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('organization lookups use scoped routes and never retry a 404 on retired APIs', async () => {
  const calls = [];
  let fail = false;
  const http = async (url) => {
    calls.push(url);
    if (fail) throw Object.assign(new Error('not found'), { response: { status: 404 } });
    return { data: { items: [{ id: 'branch', name: 'Main' }] } };
  };
  const source = fs.readFileSync('src/features/org/api/orgApi.ts', 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, URLSearchParams, require: () => ({ http }) });
  const api = exports.orgApi;
  await api.listCompanies();
  await api.listBranches('company');
  await api.listStores('company', 'branch');
  await api.listStores('company');
  assert.deepEqual(calls.map(x => x.split('?')[0]), [
    '/api/companies', '/api/companies/company/branches',
    '/api/companies/company/branches/branch/stock-locations',
    '/api/companies/company/stock-locations',
  ]);
  fail = true;
  calls.length = 0;
  await assert.rejects(api.listBranches('company'), /not found/);
  assert.equal(calls.length, 1);
  assert.equal(api.get, undefined);
  assert.equal(api.setActive, undefined);
});
