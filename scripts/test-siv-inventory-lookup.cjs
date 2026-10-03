const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const { build } = require("esbuild");

async function loadApi(get) {
  const result = await build({
    entryPoints: [path.join(__dirname, "../src/features/inventory/siv/api/sivApi.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    plugins: [{
      name: "mock-http",
      setup(builder) {
        builder.onResolve({ filter: /api\/http$/ }, () => ({ path: "http", external: true }));
      },
    }],
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    require: () => ({ http: { get } }),
  });
  return module.exports.sivApi;
}

async function main() {
  for (const count of [0, 50, 200, 450]) {
    const catalog = Array.from({ length: count }, (_, index) => ({
      id: `item-${index}`,
      name: index % 2 ? "Semi-finished dough" : "Ingredient flour",
      isActive: true,
      uomId: "kg",
    }));
    const calls = [];
    const api = await loadApi(async (url, { params }) => {
      assert.equal(url, "/companies/company-a/inventory-items/search");
      assert.equal(params.context, "Issue");
      assert.equal(params.includeOutOfStock, true);
      assert.equal(params.branchId, "branch-a");
      assert.equal(params.locationId, "production");
      calls.push(params.skip);
      return { data: catalog.slice(params.skip, params.skip + params.pageSize) };
    });
    const items = await api.searchInventoryItems("company-a", {
      branchId: "branch-a", locationId: "production",
    });
    assert.equal(items.length, count);
    assert.equal(new Set(items.map(item => item.id)).size, count);
    assert.equal(calls.length, Math.floor(count / 200) + 1);
  }

  const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: `item-${index}` }));
  const brokenApi = await loadApi(async () => ({ data: firstPage }));
  await assert.rejects(brokenApi.searchInventoryItems("company-a"), /pagination did not advance/);

  const failingApi = await loadApi(async (_, { params }) => {
    if (params.skip) throw new Error("Lookup unavailable");
    return { data: firstPage };
  });
  await assert.rejects(failingApi.searchInventoryItems("company-a"), /Lookup unavailable/);
  console.log("SIV lookup: catalog pagination, scope, uniqueness, and failure handling passed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
