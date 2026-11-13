import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

test("Receivables read-only users see ageing differences without posting controls", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view"], []);
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/receivables/customers")) body = [{ id: "c1", code: "HOTEL", name: "Test Hotel", kind: "Hotel", balance: 1150, overdue: 1150, creditLimit: 2000, isActive: true, paymentTermsDays: 30, version: "v1" }];
    if (path.endsWith("/receivables/ageing")) body = { asOf: "2026-11-13", rows: [], total: 1150, ledgerBalance: 1100, difference: 50 };
    await route.fulfill({ json: body });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/receivables`);
  await expect(page.getByRole("heading", { name: "Accounts receivable", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Test Hotel", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New customer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByRole("button", { name: "New invoice" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ageing", exact: true }).click();
  await expect(page.getByText(/^(ETB\s*)?50\.00$/)).toBeVisible();
});

test("VAT report includes account customers and highlights a ledger difference", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view"], []);
  await page.route("**/finance/reports/vat-return?**", route => route.fulfill({ json: {
    from: "2026-11-01", to: "2026-11-13", currency: "ETB", companyName: "Test company",
    output: [{ key: "ar-invoices", label: "Account customer invoices", taxable: 1000, vat: 150, documents: 1 }], input: [],
    outputVat: 150, inputVat: 0, netVatPayable: 150, withheldTotal: 0, withholding: [], notes: [],
    tieOut: [{ key: "output", label: "Output VAT", return: 150, ledger: 140, difference: 10 }],
  } }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/vat-return`);
  await expect(page.getByRole("cell", { name: "Account customer invoices" })).toBeVisible();
  await expect(page.getByText("The return and the VAT accounts differ.", { exact: false })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await download;
});
