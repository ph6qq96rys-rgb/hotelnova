import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

test("An approver records and approves overtime that was worked without a request", async ({ page }) => {
  await seedWorkspaceAuth(page, ["hr.overtime.approve", "hr.attendance.view"]);
  const row = {
    employeeId: "e1", employeeName: "Etagenghe Abate", branchId: "b1", date: "2026-11-10T00:00:00", clockIn: "2026-11-10T03:49:00Z",
    clockOut: "2026-11-10T18:33:00Z", workedHours: 14.23, clockedOvertimeHours: 6.23, maxApprovableHours: 4, category: "Workday", canDecide: true,
  };
  let waiting = [row];
  let posted: Record<string, unknown> | undefined;
  await page.route(/\/hr\/overtime(\?.*)?$/, (r) => r.fulfill({ json: [] }));
  await page.route(/\/hr\/overtime\/unrequested(\?.*)?$/, (r) => r.fulfill({ json: waiting }));
  await page.route("**/hr/overtime/unrequested/approve", async (r) => {
    posted = r.request().postDataJSON(); waiting = [];
    await r.fulfill({ json: { success: true, id: "o1" } });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/overtime/approvals`);
  await page.getByRole("button", { name: "Worked without a request" }).click();
  await expect(page.getByText("Etagenghe Abate", { exact: false })).toBeVisible();
  await expect(page.getByText("6.23 h")).toBeVisible();
  await page.getByRole("button", { name: "Record and approve" }).click();
  await page.getByLabel("Work done").fill("Received and stored the late supplier delivery");
  await page.getByLabel("Business reason").fill("Delivery arrived after closing");
  await page.getByLabel("KPI", { exact: true }).fill("Delivery received and stored");
  await page.getByLabel("KPI target").fill("All 40 cases in the cold room");
  await page.getByLabel("Result achieved").fill("40 cases received, GRN posted");
  await page.getByLabel(/Why it was not requested in advance/).fill("Supplier arrived late without notice");
  await page.getByRole("button", { name: "Approve hours" }).click();
  await expect(page.getByText("Overtime approved for payroll.")).toBeVisible();
  expect(posted).toMatchObject({ employeeId: "e1", approvedHours: 4, kpiAchieved: true, note: "Supplier arrived late without notice" });
  await page.screenshot({ path: `test-results/hr-overtime-unrequested-${test.info().project.name}.png`, fullPage: true });
});
