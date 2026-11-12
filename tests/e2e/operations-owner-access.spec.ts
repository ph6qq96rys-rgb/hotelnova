import { test, expect } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

for (const roles of [["SYSTEMADMIN"], ["COMPANYADMIN"], []]) {
  test(`Operations denies non-owner direct routes with roles ${roles.join() || "none"}`, async ({ page }) => {
    await seedWorkspaceAuth(page, ["aiops.view", "aiops.configure"], roles);
    if (roles.includes("SYSTEMADMIN")) await page.addInitScript(() => {
      sessionStorage.setItem("restaurantfnb.workspaceAuth", localStorage.getItem("restaurantfnb.auth.v2")!);
    });
    let calls = 0;
    await page.route("**/api/companies/**/operations-officer/**", r => { calls++; return r.fulfill({ json: {} }); });
    await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/instructions`);
    await expect(page.getByText(/access denied|do not have permission|do not have access|don't have access/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Operations Officer", exact: true })).toHaveCount(0);
    expect(calls).toBe(0);
  });
}

test("Tilahun can open Operations and sees its navigation", async ({ page }) => {
  await seedWorkspaceAuth(page, ["aiops.view"], ["COMPANYADMIN"], "tilahun.z@fnbnova.com");
  await page.route("**/operations-officer/daily-cycle?**", r => r.fulfill({ json: { enabled: false, timeZone: "Africa/Addis_Ababa", today: "2026-11-10", branches: [] } }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/operations-officer/daily-cycle`);
  await expect(page.getByRole("heading", { name: "Daily Cycle", exact: true })).toBeVisible();
});
