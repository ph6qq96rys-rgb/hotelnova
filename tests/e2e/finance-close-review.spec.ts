import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

test("Month-end review shows differences and submits source evidence with the reviewed fingerprint", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view", "finance.journals.create", "finance.period.close"]);
  const period = { id: "p1", fiscalYearId: "fy", name: "October", startDate: "2026-10-01", endDate: "2026-10-31", status: "open", version: "p-v1", draftJournals: 0, postingExceptions: 0 };
  await page.route("**/finance/fiscal-years", r => r.fulfill({ json: [{ id: "fy", name: "FY 2026", status: "open", startDate: "2026-01-01", endDate: "2026-12-31", periods: [period] }] }));
  await page.route("**/periods/p1/close-review", r => r.fulfill({ json: { periodId: "p1", asOf: "2026-10-31", currency: "ETB", fingerprint: "review-v1", ready: false, blockers: ["Accounts payable: Difference"], controls: [
    { key: "ap", name: "2100 Accounts payable", ledgerBalance: -1000, supportingBalance: -900, difference: -100, status: "Difference", method: "Supporting schedule", reference: "AP-OCT" },
    { key: "inventory", name: "Inventory", ledgerBalance: 500, supportingBalance: 500, difference: 0, status: "Matched", method: "Posted inventory ledger" },
  ] } }));
  let saved: Record<string, unknown> | undefined;
  await page.route("**/periods/p1/close-evidence", async r => { saved = r.request().postDataJSON(); await r.fulfill({ status: 204, body: "" }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/periods`);
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await expect(page.getByText("Closing is blocked", { exact: false })).toBeVisible();
  await expect(page.getByRole("cell", { name: "-100.00", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Provide schedule" })).toHaveCount(1);
  await page.getByRole("button", { name: "Provide schedule" }).click();
  await page.getByLabel("Supporting balance", { exact: true }).fill("-900");
  await page.getByLabel("Report or document reference").fill("AP-OCT-REVISED");
  await page.getByLabel("Source, cutoff and reconciliation explanation").fill("Supplier ageing at October 31; investigate the remaining difference.");
  await page.getByRole("button", { name: "Save supporting evidence" }).click();
  await expect.poll(() => saved?.fingerprint).toBe("review-v1");
  expect(saved).toMatchObject({ key: "ap", balance: -900, reference: "AP-OCT-REVISED" });
  await page.screenshot({ path: `test-results/finance-close-${test.info().project.name}.png`, fullPage: true });
});

test("Read-only finance user can inspect reconciliation without preparing evidence", async ({ page }) => {
  await seedWorkspaceAuth(page, ["finance.view"], []);
  await page.route("**/finance/fiscal-years", r => r.fulfill({ json: [{ id: "fy", name: "FY", status: "open", periods: [{ id: "p1", name: "October", status: "open", startDate: "2026-10-01", endDate: "2026-10-31" }] }] }));
  await page.route("**/periods/p1/close-review", r => r.fulfill({ json: { currency: "ETB", ready: false, blockers: ["Schedule required"], controls: [{ key: "ap", name: "Payables", ledgerBalance: -100, supportingBalance: null, difference: null, status: "Schedule required", method: "Supporting schedule" }] } }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/finance/periods`);
  await page.getByRole("button", { name: "Close review", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Payables", exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Provide schedule" })).toHaveCount(0);
});
