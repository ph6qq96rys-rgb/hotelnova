import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

const slip = {
  id: "s1", employeeNo: "EMP-202608-000003", employeeName: "Jalene Amene Chalawork", periodName: "October 2026",
  basicSalary: 20000, totalAllowances: 0, overtimePay: 0, bonusPay: 0, grossPay: 15555.56, incomeTax: 3394.45,
  employeePension: 1088.89, employerPension: 1711.11, otherDeductions: 0, totalDeductions: 4483.34, netPay: 11072.22,
  daysWorked: 7, workingDays: 9, status: "Draft", lines: [], periodStart: "2026-10-22T00:00:00", periodEnd: "2026-10-31T00:00:00",
  absentDays: 2, taxableIncome: 15555.56, taxTableCode: "ET-PAYE-2025", taxOnGross: true,
};

test("The payslip shows the unpaid days, the tax base, and warns when the run is not a whole month", async ({ page }) => {
  await seedWorkspaceAuth(page, ["hr.payroll.view", "hr.payroll.manage"]);
  await page.route("**/api/companies/*/hr/payroll/payslips/s1", (r) => r.fulfill({ json: slip }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/payroll/payslips/s1`);
  await expect(page.getByText("Days not paid: 2 of 9 working days")).toBeVisible();
  await expect(page.getByText("(ETB 4,444.44)")).toBeVisible();
  await expect(page.getByText(/Income Tax \(on taxable ETB 15,555.56\)/)).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("not a whole month");
  await page.screenshot({ path: `test-results/hr-payslip-${test.info().project.name}.png`, fullPage: true });
});

test("A payroll run is created for a whole month", async ({ page }) => {
  await seedWorkspaceAuth(page, ["hr.payroll.view", "hr.payroll.manage"]);
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/companies/*/hr/payroll/runs", async (r) => {
    if (r.request().method() === "POST") { body = r.request().postDataJSON(); return r.fulfill({ json: { success: true } }); }
    return r.fulfill({ json: [] });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/payroll/new`);
  await page.getByLabel("Payroll month").fill("2026-10");
  await expect(page.getByText("2026-10-01 to 2026-10-31")).toBeVisible();
});
