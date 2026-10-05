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

  test("cashier settles a dine-in ticket split between two payers, each choosing a tip", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await page.getByRole("button", { name: /^Table T1, free/ }).click();
    await page.getByRole("button", { name: "Open ticket" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.getByRole("button", { name: "Send order" }).first().click();
    await expect(page.locator(".rpos-round h3").first()).toContainText("Round 1");

    await page.getByRole("button", { name: "Take payment" }).first().click();
    // No tip is ever preselected: the sale cannot complete until the guest has chosen.
    await expect(page.getByRole("radio", { name: "No tip" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("button", { name: "Complete Sale" })).toBeDisabled();

    await page.getByRole("button", { name: "Split 2 ways" }).click();
    const first = page.getByRole("region", { name: "Payer 1" });
    const second = page.getByRole("region", { name: "Payer 2" });
    await first.getByRole("radio", { name: "CARD" }).click();
    await first.getByRole("radio", { name: /^10%/ }).click();
    await first.getByLabel("Payment Reference").fill("CARD-1");
    await second.getByRole("radio", { name: "No tip" }).click();
    await second.getByRole("button", { name: "Exact amount" }).click();

    await expect(page.getByRole("region", { name: "Payment summary" }).or(page.locator(".rpos-pay-summary"))).toContainText("525.00");
    await page.getByRole("button", { name: "Complete Sale" }).click();
    await expect(page.getByRole("status")).toContainText("Tips recorded: 25.00");
    await expect(page.getByRole("button", { name: "Print receipt" })).toBeVisible();

    expect(mock.settleRequests).toHaveLength(1);
    expect(mock.settleRequests[0].payments).toEqual([
      { method: "CARD", amount: 250, referenceCode: "CARD-1", tipAmount: 25, tipPercent: 10 },
      { method: "CASH", amount: 250, referenceCode: null, tipAmount: 0, tipPercent: null },
    ]);
  });
});
