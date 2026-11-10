import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

const branch = "branch-daily";
const row = {
  id: "day1", branchId: branch, branchName: "Bole", managerEmployeeId: "manager", managerName: "Selam Bekele", businessDate: "2026-11-10",
  openedAtUtc: "2026-11-10T04:00:00Z", planDueAtUtc: "2026-11-10T05:00:00Z", explanationDueAtUtc: "2026-11-12T04:00:00Z",
  status: "Awaiting plan", late: false, planId: null, submittedAtUtc: null, salesPlan: "", foodCostPlan: "", wastePlan: "", staffingPlan: "",
  validation: [], yesterday: [{ targetId: "sales", name: "Net sales", calculation: "Net sales after discounts", unit: "money", target: 1000, actual: 500,
    from: "2026-11-09", to: "2026-11-09", status: "Missed", guidance: ["Explain the variance and plan corrective action."], evidence: [{type: "Sale", no: "S-1", label: "Verified sale"}]}],
  today: [], explanationRequired: true, explanation: null, correctivePlan: null, correctionActionId: null, canSubmit: true, canRespond: true, version: "day-v1",
};

test("Daily cycle uses Addis times and submits the reviewed plan version and recovery deadline", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.plans.manage"]);
  const submits: Record<string, unknown>[] = [], responses: Record<string, unknown>[] = [];
  await page.route("**/operations-officer/daily-cycle?**", r => r.fulfill({ json: { enabled: true, timeZone: "Africa/Addis_Ababa", opensAt: "07:00", plansDueAt: "08:00", today: "2026-11-10", branches: [{ ...row, status: submits.length ? "Validated" : row.status, version: submits.length ? "day-v2" : row.version }] } }));
  await page.route("**/operations-officer/plans?**", r => r.fulfill({ json: [{ id: "p1", branchId: branch, title: "Service plan", businessDate: row.businessDate, kind: "daily", status: "draft", versionNo: 1 }] }));
  await page.route("**/operations-officer/plans/p1", r => r.fulfill({ json: { id: "p1", version: "plan-v1", activities: [{ title: "Prepare service" }], issues: [], status: "draft" } }));
  await page.route("**/daily-cycle/day1/submit", async r => { submits.push(r.request().postDataJSON()); await r.fulfill({ status: 204, body: "" }); });
  await page.route("**/daily-cycle/day1/respond", async r => { responses.push(r.request().postDataJSON()); await r.fulfill({ status: 204, body: "" }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/daily-cycle`);
  await expect(page.getByRole("heading", { name: "Daily Cycle", exact: true })).toBeVisible();
  await expect(page.getByText(/Opened.*07:00.*Plan due.*08:00/)).toBeVisible();
  await page.getByText("Manager's daily plan", { exact: true }).click();
  await page.getByLabel("Daily plan", { exact: true }).selectOption("p1");
  await page.getByLabel("Sales actions and expected outcomes").fill("Confirm group bookings and service readiness");
  await page.getByLabel("Food-cost controls").fill("Weigh recipe portions");
  await page.getByLabel("Wastage prevention").fill("Record spoilage and use FEFO");
  await page.getByLabel("Staffing, stock readiness and constraints").fill("Roster confirmed; store issues requested");
  await page.getByRole("button", { name: "Submit for validation" }).click();
  await expect.poll(() => submits.length).toBe(1);
  expect(submits[0]).toMatchObject({ planId: "p1", planVersion: "plan-v1", version: "day-v1" });
  await expect(page.getByText("Validated", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Cause, evidence and prior blockers").fill("Group booking cancelled; revised service plan prepared");
  await page.getByLabel("Corrective actions and measurable recovery").fill("Confirm tomorrow's bookings and review the sales result");
  await page.getByLabel("Completion deadline — Addis Ababa time").fill("2026-11-11T10:00");
  await page.getByRole("button", { name: "Submit corrective plan" }).click();
  await expect.poll(() => responses.length).toBe(1);
  expect(responses[0]).toMatchObject({ dueAtUtc: "2026-11-11T07:00:00.000Z", version: "day-v2" });
  await page.screenshot({ path: `test-results/daily-cycle-${test.info().project.name}.png`, fullPage: true });
});

test("Managers cannot submit through another manager's daily card", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view"], []);
  await page.route("**/operations-officer/daily-cycle?**", r => r.fulfill({ json: { enabled: true, timeZone: "Africa/Addis_Ababa", today: row.businessDate, branches: [{ ...row, canSubmit: false, canRespond: false }] } }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/daily-cycle`);
  await expect(page.getByText("Bole", { exact: true })).toBeVisible();
  await page.getByText("Manager's daily plan", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit for validation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submit corrective plan" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enable daily cycle" })).toHaveCount(0);
});
