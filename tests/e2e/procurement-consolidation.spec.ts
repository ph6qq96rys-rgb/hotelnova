import { test, expect, type Page } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

async function setup(page: Page, failOnce = false, singleMainAssignment = false) {
  await seedWorkspaceAuth(page, ["purchasing.view", "purchasing.create"], []);
  const requests: Record<string, unknown>[] = [];
  const requirements = [
    { lineId: "l1", requisitionId: "r1", requisitionNo: "PR-001", branchId: "b1", branchName: "4-KILLO", inventoryItemId: "onion", itemName: "Onion", uomId: "kg", uomName: "KG", quantity: 10, estimatedUnitPrice: 80, locationId: "main", requiredByDateUtc: "2030-06-01T00:00:00Z" },
    { lineId: "l2", requisitionId: "r2", requisitionNo: "PR-002", branchId: "b2", branchName: "KAIZEN", inventoryItemId: "onion", itemName: "Onion", uomId: "kg", uomName: "KG", quantity: 20, estimatedUnitPrice: 80, locationId: "bar", requiredByDateUtc: "2030-06-02T00:00:00Z" },
    { lineId: "l3", requisitionId: "r3", requisitionNo: "PR-003", branchId: "b2", branchName: "KAIZEN", inventoryItemId: "onion", itemName: "Onion", uomId: "pcs", uomName: "PCS", quantity: 5, estimatedUnitPrice: 5, locationId: "bar", requiredByDateUtc: "2030-06-02T00:00:00Z" },
  ];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/consolidation/requirements")) body = requirements;
    else if (path.endsWith("/consolidation/destinations")) body = [
      { branchId: "b1", branchName: "4-KILLO", locationId: "main", locationName: "Main Warehouse", isMainWarehouse: true },
      ...singleMainAssignment ? [] : [{ branchId: "b2", branchName: "KAIZEN", locationId: "main", locationName: "Main Warehouse", isMainWarehouse: true }],
      { branchId: "b2", branchName: "KAIZEN", locationId: "bar", locationName: "Bar Store" },
    ];
    else if (path.endsWith("/suppliers/lookup")) body = [{ id: "s1", name: "Fresh Produce" }, { id: "s2", name: "Market Supplier" }];
    else if (path.endsWith("/consolidation") && route.request().method() === "POST") {
      requests.push(route.request().postDataJSON());
      if (failOnce && requests.length === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Response interrupted" }) });
      body = [{ id: "po1", poNo: "PO-001" }, { id: "po2", poNo: "PO-002" }];
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/procurement/consolidation`);
  await page.getByRole("button", { name: "Select visible requirements" }).click();
  await page.getByRole("button", { name: "Plan selected purchases" }).click();
  await page.getByRole("combobox", { name: "Default supplier", exact: true }).selectOption("s1");
  const receiving = page.getByRole("combobox", { name: "Receiving branch and destination", exact: true });
  await expect(receiving).toHaveValue(singleMainAssignment ? "b1:main" : "");
  if (!singleMainAssignment) await receiving.selectOption("b1:main");
  await page.getByLabel("Expected delivery date").fill("2030-06-01");
  await page.getByLabel("Business reason").fill("Weekly supplies for both branches");
  return requests;
}

test("groups matching items and units while preserving branch quantities and suppliers", async ({ page }) => {
  const requests = await setup(page, false, true);
  await expect(page.getByText("30 KG", { exact: true })).toBeVisible();
  await expect(page.getByText("5 PCS", { exact: true }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Supplier for Onion PCS", exact: true }).selectOption("s2");
  await page.screenshot({ path: "artifacts/consolidation-planning.png", fullPage: true });
  await page.getByRole("button", { name: "Review orders", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Main Warehouse · 4-KILLO", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Create draft orders", exact: true }).click();
  await expect(page.getByText("Draft orders created", { exact: true })).toBeVisible();
  expect(requests[0]).toMatchObject({ mode: "Central", centralBranchId: "b1", centralLocationId: "main", lines: [
    { requisitionLineId: "l1", quantity: 10, supplierId: "s1" },
    { requisitionLineId: "l2", quantity: 20, supplierId: "s1" },
    { requisitionLineId: "l3", quantity: 5, supplierId: "s2" },
  ] });
  await expect(page.getByRole("link", { name: "PO-001" })).toHaveAttribute("href", `/companies/${TEST_COMPANY_ID}/procurement/purchase-orders/po1`);
});

test("rejects an excessive purchase quantity before sending", async ({ page }) => {
  const requests = await setup(page);
  await page.getByLabel("Purchase quantity PR-001 KG", { exact: true }).fill("11");
  await page.getByRole("button", { name: "Review orders", exact: true }).click();
  await expect(page.getByText("Purchase quantities must be positive and cannot exceed the remaining approved quantities.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft orders" })).toBeDisabled();
  expect(requests).toHaveLength(0);
});

test("recovers an uncertain submission after reload with exactly the same request identity", async ({ page }) => {
  const requests = await setup(page, true);
  await page.getByRole("button", { name: "Review orders", exact: true }).click();
  await page.getByRole("button", { name: "Create draft orders" }).click();
  await expect(page.getByRole("button", { name: "Retry unchanged plan" })).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Retry unchanged plan" }).click();
  await expect(page.getByText("Draft orders created", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

test("direct delivery previews separate branch destinations", async ({ page }) => {
  await setup(page);
  await page.getByRole("combobox", { name: "Receiving method", exact: true }).selectOption("Direct");
  await page.getByRole("button", { name: "Review orders", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Main Warehouse · 4-KILLO", exact: true })).toHaveCount(1);
  await expect(page.getByRole("cell", { name: "Bar Store · KAIZEN", exact: true })).toHaveCount(1);
});
