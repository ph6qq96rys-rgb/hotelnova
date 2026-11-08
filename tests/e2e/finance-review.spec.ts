import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

const bank = { id: "bank", code: "1130", name: "Bank", type: "Asset", accountCategory: "Bank", isActive: true, isHeader: false };

test("ledger pagination keeps the complete balance and exports all pages", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view"]);
  let exported = false;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    if (url.pathname.endsWith("/finance/accounts")) body = [bank];
    if (url.pathname.includes("/reports/account-ledger")) {
      const p = Number(url.searchParams.get("page") || 1);
      exported ||= url.searchParams.get("exportAll") === "true";
      body = { accountId: "bank", code: "1130", name: "Bank", type: "Asset", from: "2026-11-01", to: "2026-11-30", openingBalance: 0, closingBalance: 5010, totalLines: 5010, page: p, pageSize: 200,
        lines: [{ entryId: `entry-${p}`, entryNo: `JV-PAGE-${p}`, entryDate: "2026-11-07", description: "Receipt", debit: 1, credit: 0, balance: p * 200 }] };
    }
    await route.fulfill({ json: body });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/trial-balance?account=bank`);
  await expect(page.getByText("Page 1 of 26")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("JV-PAGE-2")).toBeVisible();
  await expect(page.getByText("Page 2 of 26")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await download;
  expect(exported).toBe(true);
});

test("bank statement imports quoted CSV and displays approval failures", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view", "finance.journals.create", "finance.approve"]);
  let imported: any;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/finance/accounts")) body = [bank];
    if (path.endsWith("/bank-reconciliations") && route.request().method() === "POST") { imported = route.request().postDataJSON(); body = { id: "statement" }; }
    if (path.endsWith("/bank-reconciliations/statement")) body = {
      statement: { id: "statement", reference: "BANK-1", status: "Draft", version: "version", closingBalance: 100, lines: [{ id: "line", date: "2026-11-07", reference: "Deposit, customer", amount: 100, journalLineId: "ledger" }] },
      candidates: [{ id: "ledger", date: "2026-11-07", entryNo: "JV-1", description: "Deposit", amount: 100 }], ledgerClosing: 100, outstanding: 0, difference: 0,
    };
    if (path.endsWith("/complete")) return route.fulfill({ status: 400, json: { message: "Another finance user must approve this reconciliation." } });
    await route.fulfill({ json: body });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/bank-reconciliation`);
  await page.getByRole("button", { name: "Import statement" }).click();
  await page.getByRole("combobox", { name: "Bank account", exact: true }).selectOption("bank");
  await page.getByLabel("Statement reference", { exact: true }).fill("BANK-1");
  await page.getByLabel("Closing balance", { exact: true }).fill("100");
  await page.getByLabel("Statement CSV", { exact: true }).fill('Date,Reference,Amount\n2026-11-07,"Deposit, customer",100');
  await page.getByRole("button", { name: "Save statement" }).click();
  await expect(page.getByRole("heading", { name: "BANK-1 · Draft" })).toBeVisible();
  expect(imported.lines[0]).toEqual({ date: "2026-11-07", reference: "Deposit, customer", amount: 100 });
  await page.getByRole("button", { name: "Approve reconciliation" }).click();
  await expect(page.getByText("Another finance user must approve this reconciliation.")).toBeVisible();
});

test("financial statements flag unclassified cash movements", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view"]);
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path.endsWith("/reports/statements") ? {
      profitAndLoss: [], netProfit: 0, balanceSheet: [], assets: 0, liabilitiesAndEquity: 0,
      cashFlow: [{ section: "Unclassified", code: "", name: "Unclassified", amount: 100 }], openingCash: 0, closingCash: 100, unclassifiedCashMovement: 100,
    } : [] });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/statements`);
  await page.getByRole("combobox", { name: "Report", exact: true }).selectOption("cashFlow");
  await expect(page.getByText(/Unclassified cash movement:/)).toBeVisible();
  await expect(page.getByText("Closing cash and bank", { exact: true })).toBeVisible();
});
