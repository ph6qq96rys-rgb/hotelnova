import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockPosWorkstation } from "../fixtures/pos";

test.describe("QAE POS smoke", () => {
  test("cashier rings up a counter sale and reaches payment", async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await expect(page.getByRole("heading", { name: "Point of sale" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Table T1, free/ })).toBeVisible();

    await page.getByRole("button", { name: "Counter sale" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await expect(page.getByRole("region", { name: "Items" }).or(page.locator(".rpos-round--draft"))).toContainText("QAE Burger");

    await page.getByRole("button", { name: "Take payment" }).first().click();
    await expect(page.getByText("Amount Payable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete Sale" })).toBeVisible();
  });

  test("waiter opens a table ticket and sends an order without payment access", async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockPosWorkstation(page, "waiter");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await expect(page.getByText("Waiter mode: your tables and tickets. A cashier takes payment.")).toBeVisible();
    await page.getByRole("button", { name: /^Table T1, free/ }).click();
    await page.getByLabel("Guest Count").fill("2");
    await page.getByRole("button", { name: "Open ticket" }).click();

    await expect(page.getByRole("heading", { name: "Ticket T0101-001" })).toBeVisible();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.getByRole("button", { name: "Send order" }).first().click();

    await expect(page.locator(".rpos-round h3").first()).toContainText("Round 1");
    await expect(page.getByRole("button", { name: "Take payment" })).toHaveCount(0);
  });
});
