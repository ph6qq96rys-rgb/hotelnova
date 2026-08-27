import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockSalesRegister } from "../fixtures/sales";

test.describe("QAE sales register smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockSalesRegister(page);
  });

  test("loads sales register metrics and rows", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/list`);

    await expect(page.getByRole("heading", { level: 1, name: "Sales Register" })).toBeVisible();
    await expect(page.getByText("Page Sales")).toBeVisible();
    await expect(page.getByText("Gross Profit")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Sale No" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Menu Items" })).toBeVisible();
    const saleRow = page.getByRole("row", { name: /QAE-SALE-001/ });
    await expect(saleRow).toBeVisible();
    await expect(saleRow.getByText("Doro Tibs Signature", { exact: true })).toBeVisible();
    await expect(saleRow.getByText("Posted", { exact: true })).toBeVisible();
    await expect(saleRow.getByText("Paid", { exact: true })).toBeVisible();

    await page.getByPlaceholder("Sale number or source...").fill("QAE-SALE");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(saleRow).toBeVisible();
  });

  test("shows business-facing audit information on sale detail", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/details/sale-qae-1`);

    await expect(page.getByRole("heading", { level: 1, name: "QAE-SALE-001" })).toBeVisible();
    const auditCard = page.locator(".erp-doc-side").filter({
      has: page.getByRole("heading", { name: "Audit Information" }),
    });
    await expect(auditCard.getByText("MAIN - Main Branch", { exact: true })).toBeVisible();
    await expect(auditCard.getByText("Marta Alemu", { exact: true })).toBeVisible();
    await expect(auditCard.getByText("POS-01", { exact: true })).toBeVisible();
    await expect(auditCard.getByText("POS-01 / SESSION-QAE", { exact: true })).toBeVisible();
    await expect(auditCard.getByText("POS Sale", { exact: true })).toBeVisible();
    await expect(auditCard.getByText("QAE-SALE-001", { exact: true })).toBeVisible();
    await expect(auditCard.getByText("Document ID", { exact: true })).toHaveCount(0);
    await expect(auditCard.getByText("sale-qae-1", { exact: true })).toHaveCount(0);
  });
});
