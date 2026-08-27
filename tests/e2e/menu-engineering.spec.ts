import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockMenuEngineering } from "../fixtures/menuEngineering";

test.describe("QAE menu engineering smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockMenuEngineering(page);
  });

  test("renders ERP-grade menu engineering metrics with mocked data", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/production/menu-engineering`);

    await expect(page.getByRole("heading", { name: "Menu Engineering Dashboard" })).toBeVisible();
    const summary = page.locator(".p-menu-summary-bar");
    await expect(summary.getByText("Quantity Sold", { exact: true })).toBeVisible();
    await expect(summary.getByText("Revenue", { exact: true })).toBeVisible();
    await expect(summary.getByText("Food Cost", { exact: true })).toBeVisible();
    await expect(summary.getByText("Gross Profit", { exact: true })).toBeVisible();
    await expect(page.getByText("Beyond Boston Matrix")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "AI Recommendation" })).toBeVisible();
    const itemRow = page.getByRole("row", { name: /Doro Tibs Signature/ });
    await expect(itemRow).toBeVisible();
    await expect(itemRow.getByText("Negotiate ingredient costs while protecting demand.")).toBeVisible();
  });
});
