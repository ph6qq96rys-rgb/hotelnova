import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_BRANCH_ID, TEST_COMPANY_ID } from "../fixtures/auth";

const QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("The branch checklist guides kiosk set-up and a new kiosk shows a short activation code with its QR code", async ({ page }) => {
  await seedWorkspaceAuth(page, ["hr.attendance.view", "hr.attendance.manage", "hr.attendance.kiosks.manage", "hr.attendance.pins.reset", "hr.employees.view"]);
  const setup = {
    branchId: TEST_BRANCH_ID, branchName: "Bole", activeEmployees: 12, withoutPin: 3, temporaryPin: 1, lockedPin: 0, locationSet: true, kiosks: [],
    policy: { name: "Standard", branchSpecific: false, timeZoneId: "Africa/Addis_Ababa", standardDailyHours: 8, lateGraceMinutes: 10, maxSessionHours: 16, allowSplitShifts: true, duplicateScanGuardMinutes: 1, allowManualEntry: true },
    steps: [
      { key: "policy", title: "Attendance rules", done: true, detail: "Company default \"Standard\" applies." },
      { key: "kiosk", title: "Register a kiosk", done: false, detail: "No kiosk registered for this branch yet." },
      { key: "activate", title: "Activate it on the branch device", done: false, detail: "Open the kiosk page on the branch tablet." },
      { key: "online", title: "Kiosk online", done: false, detail: "Waiting for activation." },
      { key: "pins", title: "Employees have a PIN", done: false, detail: "3 of 12 active employees have no PIN; they cannot clock on a kiosk." },
    ],
  };
  let registered: Record<string, unknown> | undefined;
  await page.route(/\/hr\/kiosks$/, async (r) => {
    if (r.request().method() === "POST") {
      registered = r.request().postDataJSON();
      return r.fulfill({ json: { id: "k1", pairingCode: "K7MX-4QPA", expiresAtUtc: new Date(Date.now() + 600_000).toISOString(), activationUrl: "https://tenant.example/attendance-kiosk#activate=K7MX4QPA", activationQr: QR } });
    }
    return r.fulfill({ json: [] });
  });
  await page.route(/\/hr\/kiosks\/branches$/, (r) => r.fulfill({ json: [{ id: TEST_BRANCH_ID, name: "Bole" }] }));
  await page.route(/\/hr\/kiosks\/setup\?/, (r) => r.fulfill({ json: setup }));
  await page.route(/\/hr\/kiosks\/pins\/attention\?/, (r) => r.fulfill({ json: [{ id: "e2", employeeNo: "EMP-002", name: "Dawit Alemu", pinStatus: "NotSet" }] }));

  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/attendance/kiosks`);
  const checklist = page.getByTestId("kiosk-setup");
  await expect(checklist.getByText("Set-up at Bole")).toBeVisible();
  await expect(checklist.getByText(/3 of 12 active employees have no PIN/)).toBeVisible();
  await expect(page.getByLabel("Kiosk name")).toHaveValue("Bole kiosk 1");
  await page.getByLabel("Where it is (optional)").fill("Staff entrance");
  await page.getByRole("button", { name: "Add kiosk and show activation code" }).click();
  const panel = page.getByTestId("kiosk-activation");
  await expect(panel.getByText("K7MX-4QPA")).toBeVisible();
  await expect(panel.getByAltText("Kiosk activation QR code")).toBeVisible();
  expect(registered).toMatchObject({ branchId: TEST_BRANCH_ID, name: "Bole kiosk 1", location: "Staff entrance", device: null, requirePhoto: true, photoRetentionDays: 30 });
  await page.screenshot({ path: `test-results/kiosk-setup-${test.info().project.name}.png`, fullPage: true });

  await checklist.getByRole("button", { name: "Set PINs" }).click();
  await page.getByRole("button", { name: "Show employees who need a PIN" }).click();
  await expect(page.getByTestId("pin-attention").getByText("EMP-002 — Dawit Alemu")).toBeVisible();
});

test("An activation link activates the kiosk without typing", async ({ page }) => {
  let paired: Record<string, unknown> | undefined;
  let active = false;
  await page.route("**/api/attendance-kiosk/pair", async (r) => { paired = r.request().postDataJSON(); active = true; await r.fulfill({ json: { message: "Kiosk registered." } }); });
  await page.route("**/api/attendance-kiosk/status", (r) => active
    ? r.fulfill({ json: { name: "Bole kiosk 1", branchName: "Bole", companyName: "Hotel Nova", location: "Staff entrance", requirePhoto: false, photoRetentionDays: 30 } })
    : r.fulfill({ status: 401, body: "" }));
  await page.goto("/attendance-kiosk#activate=K7MX-4QPA");
  await expect(page.getByText("Bole · Staff entrance")).toBeVisible();
  expect(paired).toEqual({ code: "K7MX-4QPA" });
  expect(page.url()).not.toContain("activate=");
});

test("Typing the activation code formats it and activates the kiosk", async ({ page }) => {
  let paired: Record<string, unknown> | undefined;
  await page.route("**/api/attendance-kiosk/pair", async (r) => { paired = r.request().postDataJSON(); await r.fulfill({ status: 401, json: { message: "Invalid" } }); });
  await page.route("**/api/attendance-kiosk/status", (r) => r.fulfill({ status: 401, body: "" }));
  await page.goto("/attendance-kiosk");
  await page.getByLabel("Activation code").fill("k7mx4qpa");
  await expect(page.getByLabel("Activation code")).toHaveValue("K7MX-4QPA");
  await page.getByRole("button", { name: "Activate and sign out of ERP" }).click();
  await expect(page.getByText(/wrong or has expired/)).toBeVisible();
  expect(paired).toEqual({ code: "K7MX-4QPA" });
});
