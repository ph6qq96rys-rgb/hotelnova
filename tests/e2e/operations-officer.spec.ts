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
  notes: [],
  overdueInstructions: [{ id: "i9", title: "Count the bar stock", ownerName: "Dawit Alemu", dueAtUtc: "2026-11-08T05:00:00Z", status: "issued", overdue: true }],
  blockers: [],
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
  await expect(page.getByText("Count the bar stock")).toBeVisible();
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

test("The AI COO subscription shows the package, usage and branches", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.subscription.manage"]);
  await mock(page);
  const subscription = {
    package: "insights", status: "active", active: true, startsOn: "2026-11-01", includedUnitsPerMonth: 3000, monthlyPrice: 4500, currency: "ETB",
    overageAuthorized: false, warningPercent: 80, chargesAcceptedByName: "QAE", chargesAcceptedAtUtc: "2026-11-01T08:00:00Z", version: "v1", period: 202611,
    usedUnits: 2600, remainingUnits: 400, warning: true, exhausted: false,
    usage: [{ kind: "MonitorRun", count: 2400, units: 2400 }, { kind: "Briefing", count: 200, units: 200 }],
    capabilities: ["monitoring", "briefings", "questions", "recommendations"],
    branches: [{ branchId: "b-main", branchName: "Bole", active: true, activatedByName: "QAE", activatedAtUtc: "2026-11-01T08:00:00Z" }, { branchId: "b-2", branchName: "Piassa", active: false }],
    packages: [
      { package: "insights", label: "AI COO Insights", description: "Monitoring, briefings, questions and recommendations.", capabilities: [], defaultIncludedUnits: 3000, dependencies: ["Sales & POS", "Inventory"] },
      { package: "leadership", label: "AI COO Leadership", description: "Adds targets.", capabilities: [], defaultIncludedUnits: 10000, dependencies: ["Purchasing"] },
    ],
    issues: ["2600 of 3000 units used this month."],
  };
  const saved: unknown[] = [];
  await page.route(`**/operations-officer/subscription`, (r) => r.request().resourceType() === "document" ? r.fallback()
    : r.request().method() === "GET" ? r.fulfill({ json: subscription }) : r.fulfill({ status: 204, body: "" }));
  await page.route(`**/operations-officer/subscription/branches`, async (r) => { saved.push(r.request().postDataJSON()); await r.fulfill({ status: 204, body: "" }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/subscription`);
  await expect(page.getByText("2600 of 3000 units used this month.").first()).toBeVisible();
  await page.locator("label", { hasText: "Piassa" }).click();
  await page.getByRole("button", { name: "Save branches" }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toEqual({ branchIds: ["b-main", "b-2"] });
  await page.screenshot({ path: `test-results/officer-subscription-${test.info().project.name}.png`, fullPage: true });
});

const instruction = {
  id: "i1", branchId: BRANCH, branchName: "Bole", kind: "mandatory", priority: "high", title: "Fix the walk-in cooler", actionText: "Call the technician and move stock to the reach-in.",
  reason: "Food safety", authority: "Within delegated authority (policy v3).", ownerEmployeeId: "e1", ownerName: "Selam Bekele", ownerRole: "Branch manager",
  dueAtUtc: "2026-11-08T15:00:00Z", acknowledgeByUtc: "2026-11-08T09:00:00Z", requiredEvidence: "Technician report", completionMode: "evidence", status: "issued",
  overdue: false, acknowledgementOverdue: false, progressPercent: 0, remindersSent: 0, issuedByName: "Operations Officer", issuedAtUtc: "2026-11-08T07:00:00Z",
  version: "v1", isMine: true, blockers: [], exceptions: [], history: [{ event: "Issued", note: "Mandatory.", actorName: "Operations Officer", atUtc: "2026-11-08T07:00:00Z" }],
};

test("An employee acknowledges an instruction and reports a blocker", async ({ page }) => {
  await seedWorkspaceAuth(page, []);
  let current: Record<string, unknown> = { ...instruction };
  const posts: { url: string; body: unknown }[] = [];
  await page.route(`**/operations-officer/instructions/mine**`, (r) => r.fulfill({ json: [current] }));
  await page.route(`**/operations-officer/instructions/mine/changes`, (r) => r.fulfill({ json: [] }));
  await page.route(`**/operations-officer/instructions/i1`, (r) => r.fulfill({ json: current }));
  await page.route(`**/operations-officer/instructions/i1/*`, async (r) => {
    posts.push({ url: r.request().url(), body: r.request().postDataJSON() });
    current = r.request().url().endsWith("/acknowledge") ? { ...current, status: "acknowledged" }
      : { ...current, status: "blocked", blockers: [{ id: "bl1", instructionId: "i1", cause: "Spare part not in stock", assignedRole: "Escalation contact", assignedName: "Dawit Alemu",
          status: "open", reportedByName: "Selam", reportedAtUtc: "2026-11-08T08:00:00Z", reportedBeforeDue: true }] };
    await r.fulfill({ json: current });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/instructions`);
  await expect(page.getByRole("heading", { name: "Officer Instructions" })).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect.poll(() => posts.length).toBe(1);
  await page.getByRole("button", { name: "Fix the walk-in cooler" }).click();
  await page.getByRole("button", { name: "Report blocker" }).click();
  await page.getByLabel("What is blocking the work").fill("Spare part not in stock");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].body).toEqual({ cause: "Spare part not in stock", impact: "", assistanceRequired: "" });
  await expect(page.getByText("Blocker reported. The deadline stays unless an exception is approved.")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-instructions-${test.info().project.name}.png`, fullPage: true });
});

test("A daily plan is prepared and activated", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.plans.manage"]);
  await mock(page);
  const plan = {
    id: "p1", branchId: BRANCH, branchName: "Bole", kind: "daily", businessDate: "2026-11-08", title: "Daily plan Sun 8 Nov", planGroupId: "g1", versionNo: 1, status: "draft",
    assumptions: "Expected net sales about 58,000 (average of 4 previous Sundays).\nStaffing rosters are not used in this release.", createdByName: "QAE",
    createdAtUtc: "2026-11-08T06:00:00Z", version: "v1", issues: [],
    activities: [{ id: "x1", activityKey: "po:1", sortOrder: 1, title: "Receive PO-0107", detail: "Expected today.", ownerEmployeeId: "e1", ownerName: "Selam Bekele",
      ownerRole: "Branch manager", dueAtUtc: "2026-11-08T15:00:00Z", completionCriteria: "The goods receipt is posted.", completionMode: "transaction", status: "planned" }],
  };
  let activated = false;
  await page.route(`**/operations-officer/plans?**`, (r) => r.fulfill({ json: activated ? [{ ...plan, status: "active", activities: 1, done: 0 }] : [] }));
  await page.route(`**/operations-officer/plans/daily`, (r) => r.fulfill({ json: plan }));
  await page.route(`**/operations-officer/plans/p1/activate`, (r) => { activated = true;
    return r.fulfill({ json: { ...plan, status: "active", activities: [{ ...plan.activities[0], status: "instructed", instructionStatus: "issued" }] } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/plans`);
  await page.getByRole("button", { name: "Daily plan" }).click();
  await page.getByRole("button", { name: "Prepare" }).click();
  await expect(page.getByText("Receive PO-0107")).toBeVisible();
  await expect(page.getByText("Staffing rosters are not used in this release.")).toBeVisible();
  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Plan active. Instructions were issued to the owners.")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-plan-${test.info().project.name}.png`, fullPage: true });
});

test("A production plan shows batches, ingredients and blocked recipes before it is prepared", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.plans.manage"]);
  await mock(page);
  const requirements = {
    branchId: BRANCH, branchName: "Bole", businessDate: "2026-11-09", calculatedAtUtc: "2026-11-09T05:00:00Z",
    assumptions: ["Expected sales are the average of the last 4 Mondays."], blocked: ["Tomato sauce: the recipe has no yield"],
    lines: [{ itemId: "i1", itemName: "Injera dough", baseUnit: "kg", recipeId: "r1", recipeVersion: 2, demand: 42, usableStock: 6, required: 36, yieldPerBatch: 10,
      batches: 4, plannedQuantity: 40, locationId: "l1", locationName: "Main kitchen", supervisorEmployeeId: "e1", supervisorName: "Selam Bekele",
      readyByUtc: "2026-11-09T07:00:00Z", demandFrom: ["Firfir", "Combo"], ingredients: [{ itemId: "t1", itemName: "Teff flour", baseUnit: "kg", needed: 20, onHand: 12, short: 8 }] }],
  };
  const plan = { id: "p2", branchId: BRANCH, branchName: "Bole", kind: "production", businessDate: "2026-11-09", title: "Production plan Mon 9 Nov", planGroupId: "g2",
    versionNo: 1, status: "draft", assumptions: "", createdByName: "QAE", createdAtUtc: "2026-11-09T05:00:00Z", version: "v1", issues: [],
    activities: [{ id: "x2", activityKey: "production:i1", sortOrder: 1, title: "Make 4 batches of Injera dough", detail: "40 kg", ownerEmployeeId: "e1", ownerName: "Selam Bekele",
      ownerRole: "Production supervisor", dueAtUtc: "2026-11-09T07:00:00Z", completionCriteria: "Batches posted.", completionMode: "transaction", status: "planned" }] };
  const posts: unknown[] = [];
  await page.route(`**/operations-officer/plans?**`, (r) => r.fulfill({ json: [] }));
  await page.route(`**/operations-officer/production/requirements**`, (r) => r.fulfill({ json: requirements }));
  await page.route(`**/operations-officer/plans/production`, (r) => { posts.push(r.request().postDataJSON()); return r.fulfill({ json: plan }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/plans`);
  await page.getByRole("button", { name: "Production plan" }).click();
  const preview = page.getByTestId("production-preview");
  await expect(preview.getByText("4 × 10 = 40")).toBeVisible();
  await expect(preview.getByText("Teff flour 8 kg")).toBeVisible();
  await expect(preview.getByText(/Tomato sauce: the recipe has no yield/)).toBeVisible();
  await page.getByRole("button", { name: "Prepare" }).click();
  await expect(page.getByText("Make 4 batches of Injera dough")).toBeVisible();
  expect(posts[0]).toEqual({ branchId: BRANCH, businessDate: null, revisionReason: null });
  await page.screenshot({ path: `test-results/officer-production-plan-${test.info().project.name}.png`, fullPage: true });
});

test("A revision shows what changed and the former owner is told to stop", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.plans.manage"]);
  await mock(page);
  const v2 = {
    id: "p3", branchId: BRANCH, branchName: "Bole", kind: "production", businessDate: "2026-11-09", title: "Production plan Mon 9 Nov", planGroupId: "g3", versionNo: 2,
    supersedesPlanId: "p2", status: "draft", revisionReason: "Officer replanning: Injera dough: planned 40, now needed 60 kg", createdByName: "AI Operations Officer",
    createdAtUtc: "2026-11-09T09:00:00Z", version: "v2", issues: [],
    activities: [{ id: "y1", activityKey: "production:i1", sortOrder: 1, title: "Prepare 60 kg Injera dough", ownerEmployeeId: "e2", ownerName: "Dawit Alemu",
      ownerRole: "Production supervisor", dueAtUtc: "2026-11-09T07:00:00Z", completionCriteria: "A posted production batch of this item.", completionMode: "transaction", status: "planned" }],
  };
  const changes = { planId: "p3", versionNo: 2, comparedPlanId: "p2", comparedVersionNo: 1, revisionReason: v2.revisionReason, material: true,
    materialReasons: ["Prepare 60 kg Injera dough reassigned", "Prepare 60 kg Injera dough: quantity 40 to 60"], costChange: 1300,
    changes: [
      { activityKey: "production:i1", change: "changed", title: "Prepare 60 kg Injera dough", previousTitle: "Prepare 40 kg Injera dough", ownerName: "Dawit Alemu", previousOwnerName: "Selam Bekele",
        dueAtUtc: "2026-11-09T07:00:00Z", previousDueAtUtc: "2026-11-09T07:00:00Z", quantity: 60, previousQuantity: 40, unit: "kg", costChange: 1300,
        instructionEffect: "The earlier instruction is superseded and the new owner is instructed" },
      { activityKey: "production:i2", change: "completed", title: "Prepare 10 kg Shiro", previousTitle: "Prepare 10 kg Shiro", quantity: 10, previousQuantity: 10, unit: "kg",
        instructionEffect: "Done in the earlier version; the work and its transactions stay" }] };
  await page.route(`**/operations-officer/plans?**`, (r) => r.fulfill({ json: [{ ...v2, activities: 1, done: 0 }] }));
  await page.route(`**/operations-officer/plans/p3`, (r) => r.fulfill({ json: v2 }));
  await page.route(`**/operations-officer/plans/p3/changes`, (r) => r.fulfill({ json: changes }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/plans`);
  await page.getByText("Production plan Mon 9 Nov").click();
  const table = page.getByTestId("plan-changes");
  await expect(table.getByText(/Material change: .*reassigned/)).toBeVisible();
  await expect(table.getByText("was Selam Bekele")).toBeVisible();
  await expect(table.getByText("Done, kept")).toBeVisible();
  await expect(table.getByText("Stock cost of the quantity changes: +1,300")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-plan-changes-${test.info().project.name}.png`, fullPage: true });

  await seedWorkspaceAuth(page, []);
  await page.route(`**/operations-officer/instructions/mine**`, (r) => r.fulfill({ json: [] }));
  await page.route(`**/operations-officer/instructions/mine/changes`, (r) => r.fulfill({ json: [
    { instructionId: "i9", title: "Prepare 40 kg Injera dough", event: "Superseded", note: "Replaced by plan v2: more guests.", atUtc: "2026-11-09T09:10:00Z", status: "superseded", dueAtUtc: "2026-11-09T07:00:00Z" }] }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/instructions`);
  await expect(page.getByTestId("instruction-changes").getByText(/Prepare 40 kg Injera dough: replaced, stop work on it/)).toBeVisible();
});

test("The officer answers a question with sources and data time", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.view.company"]);
  await mock(page);
  const asked: unknown[] = [];
  await page.route(`**/operations-officer/ask`, async (r) => {
    if (r.request().resourceType() === "document") return r.fallback();
    asked.push(r.request().postDataJSON());
    await r.fulfill({ json: {
      threadId: "th1", usedModel: false, notes: ["No language model is configured; this answer lists the facts directly."],
      question: { id: "m1", threadId: "th1", role: "User", text: "What needs my attention today?", sources: [], atUtc: "2026-11-08T08:00:00Z" },
      answer: { id: "m2", threadId: "th1", role: "Officer", text: "Company, 2026-11-08. From today's briefing:\n• High: 3 unpaid order(s) older than 4 h at Bole.", dataAsOfUtc: "2026-11-08T07:58:00Z",
        sources: [{ type: "OfficerFinding", id: "f1", label: "3 unpaid order(s) older than 4 h at Bole" }], atUtc: "2026-11-08T08:00:01Z" },
    } });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/ask`);
  await page.getByRole("button", { name: "What needs my attention today?" }).click();
  await expect(page.getByText("Facts listed directly, no language model")).toBeVisible();
  await expect(page.getByText("OfficerFinding")).toBeVisible();
  expect(asked[0]).toEqual({ question: "What needs my attention today?", branchId: null, threadId: null, language: "en" });
  await page.screenshot({ path: `test-results/officer-ask-${test.info().project.name}.png`, fullPage: true });
});

test("Stock review shares short supply and prepares SIV drafts", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.actions.request"]);
  await mock(page);
  const line = (itemId: string, itemName: string, suggested: number, allocated: number) => ({
    itemId, itemName, baseUom: "kg", uomId: "u1", uom: "kg", toBaseFactor: 1, onHand: 1, reserved: 0, inbound: 0, dailyUsage: 3, usageBasis: "Ledger",
    coverageDays: 3, leadTimeDays: 1, target: suggested + 1, suggested, sourceFree: 12, allocated, allocatedQty: allocated, shortfall: suggested - allocated,
    status: "Low", warnings: [], ruleVersions: [],
  });
  const review = {
    branchId: BRANCH, branchName: "Bole", calculatedAtUtc: "2026-11-09T08:00:00Z", lookbackDays: 28, coverageDays: 3, estimatedCost: 960,
    assumptions: ["Usage over the last 28 complete days.", "Each item is requested from the store holding the stock that should leave first."],
    locations: [
      { locationId: "kitchen", locationName: "Kitchen", allocationPriority: 1, itemsEvaluated: 12, itemsCovered: 10, closedDays: 0, openSivs: 0, recipeIssues: [], lines: [line("milk", "Milk", 10, 10)] },
      { locationId: "bar", locationName: "Bar", allocationPriority: 2, itemsEvaluated: 8, itemsCovered: 7, closedDays: 0, openSivs: 1, recipeIssues: [], lines: [line("milk", "Milk", 10, 2)] },
    ],
    conflicts: [{ itemId: "milk", itemName: "Milk", baseUom: "kg", needed: 20, available: 12, allocation: ["Kitchen (priority 1): 10 of 10", "Bar (priority 2): 2 of 10"] }],
    transfers: [], purchaseNeeds: [{ itemId: "milk", itemName: "Milk", baseUom: "kg", shortfall: 8, onOrder: 0, openOrders: [] }],
  };
  const posts: unknown[] = [];
  await page.route(`**/operations-officer/stock/replenishment**`, async (r) => {
    if (r.request().resourceType() === "document") return r.fallback();
    if (r.request().method() === "GET") return r.fulfill({ json: review });
    posts.push(r.request().postDataJSON());
    return r.fulfill({ json: { id: "a1", status: "executed", title: "Replenish", actionType: "stock.replenish.draft" } });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/stock`);
  await expect(page.getByRole("heading", { name: "Officer Stock" })).toBeVisible();
  await expect(page.getByText("Bar (priority 2): 2 of 10")).toBeVisible();
  await expect(page.getByText("8 short")).toBeVisible();
  await page.getByRole("checkbox", { name: "Request Milk" }).last().uncheck();
  await page.getByRole("button", { name: "Prepare SIV drafts (1)" }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect((posts[0] as { destinations: unknown }).destinations).toEqual([{ toLocationId: "kitchen", lines: [{ itemId: "milk", qty: 10 }] }]);
  await expect(page.getByText("SIV drafts prepared. They are approved and issued as usual.")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-stock-${test.info().project.name}.png`, fullPage: true });
});

test("Purchasing ranks suppliers and asks for a reason before overriding", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.actions.request"]);
  await mock(page);
  const quote = (quoteId: string, supplierName: string, rank: number, s: number) => ({
    quoteId, supplierId: `s-${quoteId}`, supplierName, rank, score: s, unitCostBase: 10 + rank, lineTotal: 100, currency: "ETB", exchangeRate: 1,
    validUntil: "2026-11-20", deliveryDate: "2026-11-12", paymentTermDays: 30, quotedBaseQty: 10, priceScore: 100, leadTimeScore: 70,
    reliabilityScore: 50, qualityScore: 50, paymentScore: 100, eligible: true, notes: [],
  });
  const comparison = {
    requestId: "rfq1", reference: "RFQ-1", status: "Open", version: "v1", currency: "ETB", calculatedAtUtc: "2026-11-09T08:00:00Z",
    weights: { price: 50, quality: 15, leadTime: 15, reliability: 15, paymentTerms: 5 },
    assumptions: ["Price: lowest cost scores 100, others in proportion."], missingData: ["Cheap Dairy: no deliveries in the last 12 months."],
    lines: [{ requisitionLineId: "l1", requisitionNo: "PR-9", itemName: "Milk", unit: "kg", quantity: 10, baseQuantity: 10, quotes: [quote("q1", "Cheap Dairy", 1, 80.5), quote("q2", "Prompt Dairy", 2, 75.4)], recommendedQuoteId: "q1" }],
  };
  const awards: unknown[] = [];
  await page.route(`**/operations-officer/purchasing/requirements**`, (r) => r.fulfill({ json: { calculatedAtUtc: "2026-11-09T08:00:00Z", assumptions: [], items: [], excluded: [] } }));
  await page.route(`**/operations-officer/purchasing/quotations`, (r) => r.request().resourceType() === "document" ? r.fallback()
    : r.fulfill({ json: [{ id: "rfq1", reference: "RFQ-1", status: "Open", responseDue: "2026-11-10", lines: 1, quotes: 2 }] }));
  await page.route(`**/operations-officer/purchasing/quotations/rfq1/comparison`, (r) => r.fulfill({ json: comparison }));
  await page.route(`**/operations-officer/purchasing/quotations/rfq1/award`, async (r) => {
    awards.push(r.request().postDataJSON());
    return r.fulfill({ json: { id: "a1", status: "pendingApproval", title: "Select suppliers", authorityNote: "Waits for approval by a person." } });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/purchasing`);
  await expect(page.getByRole("heading", { name: "Officer Purchasing" })).toBeVisible();
  await page.getByLabel("View").selectOption("suppliers");
  await expect(page.getByText("Weights: price 50, quality 15, lead time 15, reliability 15, payment terms 5")).toBeVisible();
  await page.getByRole("checkbox", { name: "Choose Prompt Dairy for Milk" }).check();
  const propose = page.getByRole("button", { name: "Propose selection" });
  await expect(propose).toBeDisabled();
  await page.getByLabel("Why not the first-ranked supplier?").fill("Breakfast cannot wait two more days");
  await propose.click();
  await expect.poll(() => awards.length).toBe(1);
  expect(awards[0]).toMatchObject({ lines: [{ quoteId: "q2", requisitionLineId: "l1", quantity: 10 }], overrideReason: "Breakfast cannot wait two more days" });
  await expect(page.getByText("Waits for approval by a person.")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-purchasing-${test.info().project.name}.png`, fullPage: true });
});

const caseBase = {
  id: "c1", caseNo: "AC-202611-0001", kind: "missedTarget", status: "awaitingExplanation", branchId: BRANCH, branchName: "Bole", subjectEmployeeId: "e1",
  subjectName: "Selam Bekele", title: "Daily net sales missed on 08 Nov", severity: "high", openedAtUtc: "2026-11-09T06:00:00Z", explanationDueUtc: "2026-11-11T06:00:00Z",
  explanationOverdue: false, recurrenceNo: 1, escalated: false, dataLimited: false, responsibility: null, isMine: true,
};
const caseDetail = {
  ...caseBase, summary: "48,000 against a target of at least 60,000.", findingId: "f9", targetId: "t1", periodStart: "2026-11-08", periodEnd: "2026-11-08",
  expected: 60000, actual: 48000, evidence: [{ type: "OfficerInstruction", id: "i3", label: "Run the lunch promotion: due 08 Nov 10:00, completed late" },
    { type: "OfficerBlocker", id: "bl3", no: "Buyer", label: "Blocker before the deadline: supplier did not deliver the injera (open, Buyer)" }],
  dependencies: [], openedByName: "Dawit Alemu", version: "cv1", corrections: [], decisions: [], events: [{ event: "Opened", note: "Explanation due 11 Nov.", actorName: "Dawit Alemu", atUtc: "2026-11-09T06:00:00Z" }],
  canDo: ["explain"],
  suggestion: { responsibility: "shared", failureType: "both", dependencies: ["Supplier"], mitigationReasonable: true,
    reasons: ["Blocker reported before the deadline: supplier did not deliver the injera → Buyer, not resolved.", "Supplier: PO-0107 is overdue."] },
};

test("The responsible manager explains a case in their own words", async ({ page }) => {
  await seedWorkspaceAuth(page, []);
  const posts: unknown[] = [];
  await page.route(`**/operations-officer/cases?**`, (r) => r.fulfill({ json: [caseBase] }));
  await page.route(`**/operations-officer/cases/c1`, (r) => r.fulfill({ json: caseDetail }));
  await page.route(`**/operations-officer/cases/c1/explain`, (r) => { posts.push(r.request().postDataJSON());
    return r.fulfill({ json: { ...caseDetail, status: "awaitingAssessment", canDo: [], causes: "Supplier did not deliver", proposedCorrection: "Second injera supplier",
      explainedAtUtc: "2026-11-09T08:00:00Z", explainedByName: "Selam Bekele" } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/cases`);
  await page.getByText("AC-202611-0001 · Daily net sales missed on 08 Nov").click();
  await expect(page.getByText(/Please explain by/)).toBeVisible();
  await expect(page.getByTestId("case-suggestion")).toHaveCount(0); // the subject does not see the officer's suggestion
  await page.getByRole("button", { name: "Explain", exact: true }).click();
  await page.getByLabel("Causes").fill("Supplier did not deliver");
  await page.getByLabel("Correction you propose").fill("Second injera supplier");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Explanation sent.")).toBeVisible();
  expect(posts[0]).toMatchObject({ causes: "Supplier did not deliver", proposedCorrection: "Second injera supplier", version: "cv1" });
  await page.screenshot({ path: `test-results/officer-case-explained-${test.info().project.name}.png`, fullPage: true });
});

test("An assessor starts from the officer's suggestion and records dependencies", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.cases.manage"]);
  await mock(page);
  const explained = { ...caseDetail, isMine: false, status: "awaitingAssessment", canDo: ["assess", "withdraw"], causes: "Supplier did not deliver",
    proposedCorrection: "Second injera supplier", explainedAtUtc: "2026-11-09T08:00:00Z", explainedByName: "Selam Bekele" };
  const posts: Record<string, unknown>[] = [];
  await page.route(`**/operations-officer/cases?**`, (r) => r.fulfill({ json: [{ ...caseBase, isMine: false, status: "awaitingAssessment" }] }));
  await page.route(`**/operations-officer/cases/c1`, (r) => r.fulfill({ json: explained }));
  await page.route(`**/operations-officer/cases/c1/assess`, (r) => { posts.push(r.request().postDataJSON());
    return r.fulfill({ json: { ...explained, status: "assessed", canDo: ["correct", "withdraw"], responsibility: "shared", failureType: "both", dependencies: ["Supplier"],
      assessedByName: "Dawit Alemu", assessedAtUtc: "2026-11-09T09:00:00Z", challengeByUtc: "2026-11-14T09:00:00Z" } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/cases`);
  await page.getByRole("tab", { name: "All cases" }).click();
  await page.getByText("AC-202611-0001 · Daily net sales missed on 08 Nov").click();
  await expect(page.getByTestId("case-suggestion")).toContainText("Shared");
  await page.getByRole("button", { name: "Assess", exact: true }).click();
  await expect(page.getByLabel("Who controlled the outcome")).toHaveValue("shared");
  await expect(page.getByLabel("Supplier")).toBeChecked();
  await page.getByLabel("Uncertainty and evidence relied on").fill("Supplier delay confirmed by PO-0107; promotion was late as well.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("case-assessment")).toContainText("Shared");
  expect(posts[0]).toMatchObject({ responsibility: "shared", failureType: "both", dependencies: ["Supplier"], mitigationReasonable: true });
});

test("A scorecard separates its components and shows the items behind each", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view", "aiops.scorecards.view"]);
  await mock(page);
  const card = {
    branchId: BRANCH, branchName: "Bole", subjectEmployeeId: "e1", subjectName: "Selam Bekele", from: "2026-11-01", to: "2026-11-08", overall: null, withheld: true,
    withheldReason: "1 challenged case(s) await review (AC-202611-0001).", disputes: 1, calculatedAtUtc: "2026-11-09T09:00:00Z",
    calculation: "Overall = Σ(component score × weight) ÷ Σ(weights of rated components).", context: ["Net sales 412,000 over 8 trading day(s)."],
    components: [
      { key: "targets", label: "Target achievement", weight: 40, met: 5, counted: 7, score: 71.4, rated: true, rule: "Completed target periods met.", notes: [],
        items: [{ type: "TargetPeriod", id: "t1", label: "Daily net sales 08 Nov", result: "Excused by case AC-202611-0002 (external dependency)", met: null }] },
      { key: "instructions", label: "Instruction compliance", weight: 30, met: 3, counted: 4, score: 75, rated: true, rule: "Instructions completed by their deadline.", notes: [],
        items: [{ type: "OfficerInstruction", id: "i1", label: "Post GRN 7", dueAtUtc: "2026-11-07T15:00:00Z", result: "Completed late (2026-11-07 20:00)", met: false }] },
      { key: "reporting", label: "Reporting timeliness", weight: 15, met: 2, counted: 2, score: 100, rated: false, rule: "In time.", notes: [], items: [] },
      { key: "corrections", label: "Correction completion", weight: 15, met: 0, counted: 0, score: null, rated: false, rule: "Verified.", notes: [], items: [] },
    ],
  };
  await page.route(`**/api/companies/*/operations-officer/scorecards**`, (r) => r.fulfill({ json: [card] }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/scorecards`);
  const sc = page.getByTestId("scorecard");
  await expect(sc.getByText("Overall withheld")).toBeVisible();
  await expect(sc.getByText(/Personnel assessment withheld until review/)).toBeVisible();
  await expect(sc.getByText("75% · 3 of 4 counted")).toBeVisible();
  await sc.getByRole("button", { name: "Items and rule" }).nth(1).click();
  await expect(page.getByTestId("score-items").getByText("Completed late (2026-11-07 20:00)")).toBeVisible();
  await page.screenshot({ path: `test-results/officer-scorecard-${test.info().project.name}.png`, fullPage: true });
});
