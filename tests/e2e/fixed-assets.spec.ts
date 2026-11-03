import { expect, test, type Page } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID, TEST_BRANCH_ID } from "../fixtures/auth";

const url = `/companies/${TEST_COMPANY_ID}/procurement/assets`;
async function setup(page: Page, total = 1) {
  await seedWorkspaceAuth(page, ["fixedassets.view", "fixedassets.register", "fixedassets.edit", "fixedassets.reports"]);
  const created: Record<string, unknown>[] = [];
  const category = { id: "equipment", code: "EQ", name: "Equipment", isActive: true, depreciationMethod: "straightLine",
    usefulLifeMonths: 60, residualValuePercent: 0, capitalizationThreshold: 0, inspectionIntervalDays: 180,
    requiresSerialNumber: false, requiresTagBeforeActivation: true, requiresCustodianOnActivation: true };
  const asset = { id: "asset-one", companyId: TEST_COMPANY_ID, assetNo: "FA-001", name: "Kitchen oven", assetTagNumber: "OVEN-1",
    categoryId: "equipment", categoryName: "Equipment", status: "draft", condition: "new", acquisitionMethod: "purchase",
    acquisitionDateUtc: "2026-01-01T00:00:00Z", acquisitionCost: 12000, residualValue: 0, accumulatedDepreciation: 0,
    netBookValue: 12000, usefulLifeMonths: 60, depreciationMethod: "straightLine", currentBranchId: TEST_BRANCH_ID,
    branchName: "Main branch", assignments: [], events: [] };
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/fixed-assets/register")) body = { items: [asset], totalCount: total, page: 1, pageSize: 50 };
    else if (path.endsWith("/fixed-assets/summary")) body = { total, draft: total, disposed: 0, inUse: 0, underMaintenance: 0,
      outOfService: 0, inspectionDue: 0, missingOrStolen: 0, totalCost: 0, accumulatedDepreciation: 0, netBookValue: 0, depreciationBehind: 0 };
    else if (path.endsWith("/fixed-assets/categories")) body = [category];
    else if (path.endsWith("/fixed-assets/lookups")) body = { branches: [{ id: TEST_BRANCH_ID, name: "Main branch" }, { id: "second", name: "Second branch" }],
      locations: [], departments: [], employees: [{ id: "employee", name: "Hana" }] };
    else if (path.endsWith("/fixed-assets") && request.method() === "POST") { created.push(request.postDataJSON()); body = { ...asset, ...request.postDataJSON() }; }
    else if (path.endsWith("/fixed-assets/asset-one")) body = asset;
    else if (path.endsWith("/depreciation-schedule")) body = { rows: [] };
    else if (path.endsWith("/companies")) body = [{ id: TEST_COMPANY_ID, legalName: "Test company", name: "Test company" }];
    else if (path.endsWith("/branches")) body = [{ id: TEST_BRANCH_ID, companyId: TEST_COMPANY_ID, name: "Main branch", isActive: true }];
    else if (path.endsWith("/settings")) body = {};
    await route.fulfill({ json: body });
  });
  await page.goto(url);
  return { created };
}

test("register shows reliable totals and names its page-only export", async ({ page }) => {
  await setup(page, 50);
  await expect(page.getByText("50 assets · Page 1 of 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Export this page" })).toBeVisible();
});

test("registration guides the user through review before saving a draft", async ({ page }, testInfo) => {
  const { created } = await setup(page);
  await page.getByRole("button", { name: "Register asset", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Asset name", { exact: true }).fill("Coffee machine");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Cost", { exact: true }).fill("12000");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Coffee machine" })).toBeVisible();
  await page.screenshot({ path: `artifacts/fixed-assets-review-${testInfo.project.name}.png`, fullPage: true });
  expect(created).toHaveLength(0);
  await dialog.getByRole("button", { name: "Register draft", exact: true }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0]).toMatchObject({ name: "Coffee machine", acquisitionCost: 12000, usefulLifeMonths: 60 });
});

test("switching the registration branch clears the previous custodian", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Register asset", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "3. Location and custody" }).click();
  await dialog.getByRole("combobox", { name: "Custodian", exact: true }).selectOption("employee");
  await dialog.getByRole("combobox", { name: "Branch", exact: true }).selectOption("second");
  await expect(dialog.getByRole("combobox", { name: "Custodian", exact: true })).toHaveValue("");
});

test("invalid depreciation life cannot be registered", async ({ page }) => {
  const { created } = await setup(page);
  await page.getByRole("button", { name: "Register asset", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Asset name", { exact: true }).fill("Oven");
  await dialog.getByRole("button", { name: "2. Value and depreciation" }).click();
  await dialog.getByLabel("Cost", { exact: true }).fill("1000");
  await dialog.getByLabel("Useful life (months)").fill("0");
  await dialog.getByRole("button", { name: "4. Review" }).click();
  await expect(dialog.getByRole("button", { name: "Register draft", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("at least one month");
  expect(created).toHaveLength(0);
});
