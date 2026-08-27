import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_BRANCH_ID, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockMenuEngineering } from "../fixtures/menuEngineering";

const TEST_BOLE_BRANCH_ID = "branch-qae-bole";

test.describe("QAE responsive shell smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);

    await page.route(`**/companies/${TEST_COMPANY_ID}/branches?**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: TEST_BRANCH_ID, name: "Main Branch", isActive: true },
          { id: TEST_BOLE_BRANCH_ID, name: "Bole Branch", isActive: true },
        ]),
      });
    });

    await mockMenuEngineering(page);
  });

  test("hamburger opens sidebar above page content on mobile-size viewports", async ({ page, isMobile }) => {
    test.skip(!isMobile, "This smoke check targets phone-sized layouts.");

    await page.goto(`/companies/${TEST_COMPANY_ID}/production/menu-engineering`);

    await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click();
    const sidebar = page.getByRole("navigation", { name: "Sidebar navigation" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "Production" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Menu Engineering" })).toBeVisible();
  });

  test("HQ users can switch the active branch from the sidebar scope card", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/production/menu-engineering`);

    const menuButton = page.getByRole("banner").getByRole("button", { name: "Open menu" });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    const branchSelect = page.getByLabel("Select active branch");
    await expect(branchSelect).toBeVisible();
    await expect(branchSelect).toHaveValue(TEST_BRANCH_ID);

    await branchSelect.selectOption(TEST_BOLE_BRANCH_ID);

    await expect(page.locator(".hnav-scope-card")).toContainText("Bole Branch");
    await expect
      .poll(async () =>
        page.evaluate(() => ({
          directBranchId: window.localStorage.getItem("branchId"),
          sessionBranchId: window.sessionStorage.getItem("branchId"),
          authBranchId: JSON.parse(
            window.localStorage.getItem("restaurantfnb.auth.v2") ?? "{}",
          )?.branchId,
          scopeBranchId: JSON.parse(
            window.localStorage.getItem("rfnb.scope.v3") ?? "{}",
          )?.branchId,
        })),
      )
      .toEqual({
        directBranchId: TEST_BOLE_BRANCH_ID,
        sessionBranchId: TEST_BOLE_BRANCH_ID,
        authBranchId: TEST_BOLE_BRANCH_ID,
        scopeBranchId: TEST_BOLE_BRANCH_ID,
      });
  });
});
