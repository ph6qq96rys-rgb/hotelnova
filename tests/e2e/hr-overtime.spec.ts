import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockAttendanceReport } from "../fixtures/hr";

test.describe("QAE HR overtime governance smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockAttendanceReport(page);
  });

  test("overtime governance requires KPI-backed manager approval before payroll", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/hr/overtime`);

    await expect(page.getByText("Overtime Approval & ROI", { exact: true })).toBeVisible();
    await expect(page.getByText("Overtime must have business justification")).toBeVisible();
    await expect(page.getByText("Approval rule", { exact: true })).toBeVisible();
    await expect(page.getByText("Work above 8 hours cannot flow to payroll")).toBeVisible();
    await expect(page.getByText("Catering", { exact: true })).toBeVisible();
    await expect(page.getByText("Banquet prep overrun", { exact: true })).toBeVisible();
    await expect(page.getByText(/Finish 120 plated desserts/)).toBeVisible();
    await expect(page.getByText("Manager Action", { exact: true })).toBeVisible();
    await expect(page.getByText("Manager: Pending | HR: Pending", { exact: true })).toBeVisible();
  });
});
