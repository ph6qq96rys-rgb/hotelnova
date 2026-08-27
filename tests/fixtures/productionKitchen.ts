import type { Page, Route } from "@playwright/test";
import { TEST_BRANCH_ID, TEST_COMPANY_ID } from "./auth";

export const KITCHEN_MENU_ITEM_ID = "menu-qae-doro-wot";
export const KITCHEN_RECIPE_ID = "recipe-qae-doro-wot";
export const KITCHEN_BATCH_ID = "batch-qae-001";

const uomEachId = "uom-each";
const uomKgId = "uom-kg";
const rawChickenId = "item-raw-chicken";
const outputStewId = "item-output-stew";
const issueLocationId = "loc-main-store";
const outputLocationId = "loc-production";

const menuItems = [
  {
    id: KITCHEN_MENU_ITEM_ID,
    name: "Doro Wot",
    code: "DW-01",
    isActive: true,
  },
];

const inventoryItems = [
  {
    id: rawChickenId,
    name: "Chicken",
    sku: "RAW-CHK",
    code: "RAW-CHK",
    isActive: true,
    itemType: "rawmaterial",
    baseUomId: uomKgId,
    baseUomCode: "KG",
    baseUomName: "Kilogram",
    uoms: [{ uomId: uomKgId, code: "KG", name: "Kilogram", isRecipe: true, isConsume: true, isActive: true, toBaseFactor: 1 }],
  },
  {
    id: outputStewId,
    name: "Prepared Doro Wot",
    sku: "FG-DW",
    code: "FG-DW",
    isActive: true,
    itemType: "finishedgood",
    baseUomId: uomEachId,
    baseUomCode: "EA",
    baseUomName: "Each",
    uoms: [{ uomId: uomEachId, code: "EA", name: "Each", isRecipe: true, isConsume: true, isActive: true, toBaseFactor: 1 }],
  },
];

const uoms = [
  { id: uomEachId, code: "EA", name: "Each", isActive: true },
  { id: uomKgId, code: "KG", name: "Kilogram", isActive: true },
];

const locations = [
  {
    id: issueLocationId,
    stockLocationId: issueLocationId,
    name: "Main Store",
    code: "MAIN",
    isActive: true,
    canIssue: true,
    isMainWarehouse: true,
    locationType: "Warehouse",
  },
  {
    id: outputLocationId,
    stockLocationId: outputLocationId,
    name: "Hot Kitchen",
    code: "KITCH",
    isActive: true,
    canProduce: true,
    isProductionCenter: true,
    locationType: "Production",
  },
];

const productionRecipe = {
  id: KITCHEN_RECIPE_ID,
  menuItemId: KITCHEN_MENU_ITEM_ID,
  mode: "production",
  isActive: true,
  notes: null,
  outputItemId: outputStewId,
  outputUomId: uomEachId,
  lines: [
    {
      id: "recipe-line-1",
      itemId: rawChickenId,
      uomId: uomKgId,
      uomName: "Kilogram",
      qty: 1.5,
      qtyPerMenuUnit: 1.5,
      wastePct: 3,
      isActive: true,
      notes: null,
    },
  ],
};

const draftBatch = {
  id: KITCHEN_BATCH_ID,
  companyId: TEST_COMPANY_ID,
  branchId: TEST_BRANCH_ID,
  batchNo: "PB-QAE-001",
  status: 2,
  issueLocationId,
  outputLocationId,
  producedAtUtc: new Date().toISOString(),
  recipeId: KITCHEN_RECIPE_ID,
  inputs: [
    {
      id: "batch-input-1",
      lineNo: 1,
      itemId: rawChickenId,
      uomId: uomKgId,
      qty: 1.5,
      qtyBase: 1.5,
      unitCost: 0,
      lineAmount: 0,
      source: 2,
      recipeLineId: "recipe-line-1",
    },
  ],
  outputs: [
    {
      id: "batch-output-1",
      lineNo: 1,
      itemId: outputStewId,
      uomId: uomEachId,
      qty: 1,
      qtyBase: 1,
      unitCost: 0,
      lineAmount: 0,
    },
  ],
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function mockKitchenProduction(page: Page): Promise<void> {
  await page.route("**/companies/*/branches/*/menu/items**", (route) => json(route, menuItems));
  await page.route("**/companies/*/inventory-master/items**", (route) => json(route, inventoryItems));
  await page.route("**/companies/*/inventory-master/uoms**", (route) => json(route, uoms));
  await page.route("**/companies/*/branches/*/stock-locations**", (route) => json(route, locations));
  await page.route("**/companies/*/production/recipes/by-menu-item/*", (route) => json(route, productionRecipe));
  await page.route("**/companies/*/branches/*/production/batches/*", (route) => json(route, draftBatch));
}
