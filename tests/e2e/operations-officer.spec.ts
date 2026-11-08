import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

const BRANCH = "b-main";
const finding = {
  id: "f1", ruleKey: "unpaid-orders", kind: "exception", severity: "high", priority: 72, evidenceQuality: "strong",
  title: "3 unpaid order(s) older than 4 h at Bole", detail: "Orders worth 1,250.00 are confirmed but not fully paid.",
  branchId: BRANCH, branchName: "Bole", evidence: [{ type: "Sale", id: "s1", no: "S-1001", label: "450.00 · Hana" }],
  dataAsOfUtc: "2026-11-08T07:00:00Z", occurrences: 3, firstDetectedAtUtc: "2026-11-08T05:00:00Z", lastDetectedAtUtc: "2026-11-08T07:00:00Z",
  status: "open", ownerEmployeeId: "e1", ownerName: "Selam Bekele", ownerRole: "Branch manager", impact: 1250, version: "v1",
};
const action = {
  id: "a1", actionType: "finding.assign", actionLabel: "Assign a finding to its owner", executable: true, branchId: BRANCH, branchName: "Bole",
  title: "Assign \"3 unpaid order(s)\" to its owner", mode: "prepareForApproval", status: "pendingApproval", trigger: "Finding", authorityNote: "It needs approval before it runs.",
  requestedByName: "Operations Officer", requestedAtUtc: "2026-11-08T05:00:00Z", attempts: 0, maxAttempts: 3, policyVersion: 3, evidence: [], payloadJson: "{\"findingId\":\"f1\"}",
  version: "v1", canDecide: true,
};
const briefing = {
  id: "br1", branchId: null, scopeName: "Company", businessDate: "2026-11-08", generatedAtUtc: "2026-11-08T06:00:00Z", dataAsOfUtc: "2026-11-08T05:58:00Z",
  dataStale: false, enabled: true, automationPaused: false, policyVersion: 3,
  targets: [
    { targetId: "t1", name: "Daily net sales", metricLabel: "Net sales", unit: "money", direction: "atLeast", targetValue: 60000, branchId: BRANCH, branchName: "Bole",
      accountableRole: "Branch manager", accountableName: "Selam Bekele", periodStart: "2026-11-08", periodEnd: "2026-11-08", value: 18000, projected: 47000, status: "atRisk",
      quality: "strong", limitations: [], lastPeriodStart: "2026-11-07", lastPeriodEnd: "2026-11-07", lastValue: 52000, lastStatus: "missed" },
    { targetId: "t2", name: "Food cost", metricLabel: "Food cost %", unit: "percent", direction: "atMost", targetValue: 32, branchId: BRANCH, branchName: "Bole",
      accountableRole: "Executive chef", periodStart: "2026-11-01", periodEnd: "2026-11-30", value: 30.4, projected: 30.4, status: "onTrack", quality: "partial",
      limitations: ["4 of 212 sale(s) have no stock posting yet."], lastPeriodStart: "2026-10-01", lastPeriodEnd: "2026-10-31", lastValue: 33.1, lastStatus: "missed" },
  ],
  priorities: [finding], dataQuality: [{ ...finding, id: "f2", kind: "dataQuality", severity: "medium", title: "4 sale(s) without stock posting at Bole" }],
  unacknowledged: [], decisions: [action], targetsAwaitingApproval: [],
  upcoming: [{ type: "CateringEvent", id: "ev1", reference: "EV-0042", label: "180 guests at Skylight (Confirmed)", dueUtc: "2026-11-10T09:00:00Z", branchName: "Bole" }],
  configuration: [{ severity: "Warning", message: "Kitchen (Bole) has no escalation contact." }],
  branches: [
    { branchId: BRANCH, branchName: "Bole", critical: 0, high: 1, open: 2, targetsAtRisk: 1, targetsMissed: 2 },
    { branchId: "b-2", branchName: "Piassa", critical: 1, high: 0, open: 1, targetsAtRisk: 0, targetsMissed: 0 },
  ],
  notes: ["Instructions, acknowledgments and blockers arrive with Release 2; follow-ups here are findings and officer actions."],
};
const refs = {
  branches: [{ id: BRANCH, name: "Bole", isActive: true }, { id: "b-2", name: "Piassa", isActive: true }], departments: [], locations: [],
  employees: [{ id: "e1", name: "Selam Bekele", branchId: BRANCH, isActive: true }, { id: "e2", name: "Dawit Alemu", branchId: BRANCH, isActive: true }],
  actionTypes: [{ key: "finding.assign", group: "Follow-up", label: "Assign a finding to its owner", description: "", executable: true }],
  metrics: [{ metric: "netSales", label: "Net sales", unit: "money", defaultDirection: "atLeast", calculation: "Sum of sales.", dataSource: "POS sales", pointInTime: false, additive: true }],
};

async function mock(page: import("@playwright/test").Page) {
  const base = `**/companies/${TEST_COMPANY_ID}/operations-officer`;
  await page.route(`${base}/references`, (r) => r.fulfill({ json: refs }));
  await page.route(`${base}/briefing**`, (r) => r.fulfill({ json: briefing }));
  await page.route(`${base}/briefings**`, (r) => r.fulfill({ json: [{ id: "br1", businessDate: "2026-11-08", generatedAtUtc: "2026-11-08T06:00:00Z" }] }));
}

test("Operations Officer briefing shows priorities, targets and decisions", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.view.company", "aiops.findings.manage", "aiops.actions.approve"]);
  await mock(page);
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer`);
  await expect(page.getByRole("heading", { name: "Operations Officer", exact: true })).toBeVisible();
  await expect(page.getByText("3 unpaid order(s) older than 4 h at Bole").first()).toBeVisible();
  await expect(page.getByText("At risk").first()).toBeVisible();
  await expect(page.getByText("EV-0042")).toBeVisible();
  await page.getByRole("button", { name: "3 unpaid order(s) older than 4 h at Bole" }).click();
  await expect(page.getByText("S-1001")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-briefing-${test.info().project.name}.png`, fullPage: true });
});

test("A finding is resolved with a note", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.view.company", "aiops.findings.manage"]);
  await mock(page);
  const posts: unknown[] = [];
  await page.route(`**/operations-officer/findings?**`, (r) => r.fulfill({ json: posts.length ? [] : [finding] }));
  await page.route(`**/operations-officer/findings/f1/resolve`, async (r) => { posts.push(r.request().postDataJSON()); await r.fulfill({ status: 204, body: "" }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/findings`);
  await page.getByText("3 unpaid order(s) older than 4 h at Bole").click();
  await page.getByRole("button", { name: "Resolve" }).click();
  await page.getByLabel("What was done").fill("Collected from the waiter at shift close");
  await page.screenshot({ path: "test-results/officer-resolve.png" });
  await page.getByRole("button", { name: "Resolve" }).last().click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual({ reason: "Collected from the waiter at shift close", version: "v1" });
  await expect(page.getByText("No findings match.")).toBeVisible();
});

test("Officer actions can be approved", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.actions.approve", "aiops.audit.view"]);
  await mock(page);
  let approved = false;
  await page.route(`**/operations-officer/actions?**`, (r) => r.fulfill({ json: approved ? [] : [action] }));
  await page.route(`**/operations-officer/actions/a1`, (r) => r.fulfill({ json: { action: approved ? { ...action, status: "executed", canDecide: false, resultReference: "f1" } : action,
    attempts: approved ? [{ attemptNo: 1, startedAtUtc: "2026-11-08T07:01:00Z", outcome: "Executed", message: "Assigned to Selam Bekele.", checks: [{ name: "Authority", passed: true, detail: "Approved by QAE." }] }] : [] } }));
  await page.route(`**/operations-officer/actions/a1/approve`, async (r) => { approved = true; await r.fulfill({ json: { ...action, status: "executed" } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/actions`);
  await page.getByText("Assign \"3 unpaid order(s)\" to its owner").click();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Approve" }).last().click();
  await expect(page.getByText("Assigned to Selam Bekele.")).toBeVisible();
  await page.screenshot({ path: "test-results/officer-action.png" });
});
