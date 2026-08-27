import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockPosWorkstation } from "../fixtures/pos";

test.describe("QAE POS smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockPosWorkstation(page);
  });

  test("cashier can add an item and reach payment", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await expect(page.getByText("Hotel Nova POS Workstation")).toBeVisible();
    await expect(page.getByText("SESSION ACTIVE")).toBeVisible();
    await expect(page.getByText("QAE Burger")).toBeVisible();

    await page.getByRole("button", { name: /QAE Burger/ }).click();
    await expect(page.getByText("1 line")).toBeVisible();
    await expect(page.getByText("QAE Burger")).toHaveCount(2);

    await page.getByPlaceholder("T-01 / 205").fill("T-01");
    await page.getByRole("button", { name: /Payment/ }).first().click();

    await expect(page.getByText("Payment Processing")).toBeVisible();
    await expect(page.getByText("Amount Payable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete Sale" })).toBeVisible();
  });
});
