const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('F&B filters populate items and categories through supported inventory master routes', async () => {
  const state = [];
  let effect;
  const routes = {
    '/companies/company/inventory-master/items': [{ id: 'flour', sku: 'FL', name: 'Flour' }],
    '/companies/company/inventory-master/categories': [{ id: 'ingredients', name: 'Ingredients', isActive: true }],
  };
  const source = fs.readFileSync('src/features/reports/fnb/hooks/useReportLookups.ts', 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, AbortController,
    require: (name) => {
      if (name === 'react') return {
        useState: (initial) => {
          const index = state.length;
          state.push(initial);
          return [initial, value => { state[index] = value; }];
        },
        useEffect: fn => { effect = fn; },
      };
      if (name.endsWith('/http')) return { http: { get: async url => {
        if (!(url in routes)) throw new Error(`404: ${url}`);
        return { data: routes[url] };
      } } };
      return { requestErrorMessage: error => error.message };
    },
  });
  exports.useReportLookups('company');
  const cleanup = effect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state[2], null);
  assert.equal(state[0][0]?.label, 'FL - Flour');
  assert.equal(state[1][0]?.label, 'Ingredients');
  cleanup();
});
