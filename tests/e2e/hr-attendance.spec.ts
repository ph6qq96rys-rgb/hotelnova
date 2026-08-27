import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockAttendanceReport } from "../fixtures/hr";

test.describe("QAE HR workforce attendance smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockAttendanceReport(page);
  });

  test("attendance command center exposes payroll readiness and KPI-backed overtime approval", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/hr/attendance`);

    await expect(page.getByText("Attendance Command Center", { exact: true })).toBeVisible();
    await expect(page.getByText("Attendance is the payroll source of truth.")).toBeVisible();
    await expect(page.getByText("Payroll Readiness", { exact: true })).toBeVisible();
    await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
    await expect(page.getByText("Manager approval required", { exact: true })).toBeVisible();
    await expect(page.getByText(/Finish 120 plated desserts/)).toBeVisible();
    await expect(page.getByText("Geofence failed", { exact: true })).toBeVisible();
  });
});
