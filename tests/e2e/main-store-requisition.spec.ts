import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

for (const authorized of [true, false]) {
  test(`Main Store requisition editor ${authorized ? "fixes the origin" : "blocks branch-only access"}`, async ({ page }) => {
    await seedWorkspaceAuth(page, ["purchasing.create", "purchasing.view"], []);
    await page.route("**/api/**", route => {
      if (route.request().url().includes("/requisitions/main-store-origin")) {
        return route.fulfill({ json: authorized
          ? { branchId: "head", branchName: "Head Office", locationId: "warehouse", locationName: "Main Warehouse" }
          : { detail: "Main Store access is required." }, status: authorized ? 200 : 403 });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto(`/companies/${TEST_COMPANY_ID}/procurement/requisitions/new`);
    const save = page.getByRole("button", { name: "Save draft", exact: true });
    if (authorized) {
      await expect(page.getByLabel("Requisition origin")).toHaveValue("Main Warehouse");
      await expect(page.getByLabel("Requisition origin")).toHaveAttribute("readonly", "");
      await expect(page.getByLabel("Managing branch")).toHaveValue("Head Office");
      await expect(save).toBeEnabled();
    } else {
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(save).toBeDisabled();
    }
  });
}
