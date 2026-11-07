import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockPosWorkstation } from "../fixtures/pos";

test.describe("QAE POS smoke", () => {
  test("cashier rings up a counter sale and reaches payment", async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await expect(page.getByRole("heading", { name: "Point of sale" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Table T1, Available/ })).toBeVisible();

    await page.getByRole("button", { name: "New order" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await expect(page.getByRole("region", { name: "Items" }).or(page.locator(".rpos-round--draft"))).toContainText("QAE Burger");

    await page.getByRole("button", { name: "Take payment" }).first().click();
    await expect(page.getByText("Amount Payable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete Sale" })).toBeVisible();
  });

  test("waiter taps a table, picks items and sends: no dialog, back on the floor", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "waiter");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await expect(page.getByText("Waiter mode: your tables and tickets. A cashier takes payment.")).toBeVisible();
    await page.getByRole("button", { name: /^Table T1, Available/ }).click();

    // Straight to the menu: the table, guests and the waiter are on the ticket panel.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Table T1/ })).toBeVisible();
    await page.getByRole("button", { name: "More guests" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await expect(page.getByRole("button", { name: "Take payment" })).toHaveCount(0);
    await page.getByRole("button", { name: "Send order" }).first().click();

    await expect(page.getByRole("status").first()).toContainText("Order T0101-001 sent · Table T1");
    await expect(page.getByRole("button", { name: /^Table T1, Occupied/ })).toBeVisible();
    expect(mock.openRequests).toHaveLength(1);
    expect(mock.openRequests[0]).toMatchObject({ orderType: "dineIn", tableId: "table-1", guestCount: 3, items: [{ menuItemId: "menu-qae-1", quantity: 1 }] });
  });

  test("leaving a table before sending anything leaves no empty order", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "waiter");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);
    await page.getByRole("button", { name: /^Table T1, Available/ }).click();
    await page.getByRole("button", { name: "Back to floor" }).click();
    await expect(page.getByRole("button", { name: /^Table T1, Available/ })).toBeVisible();
    expect(mock.openRequests).toHaveLength(0);
  });

  test("hold is one tap when the branch does not require a reason", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "waiter");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);
    await page.getByRole("button", { name: /^Table T1, Available/ }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.getByRole("button", { name: "Send order" }).first().click();
    await page.getByRole("button", { name: /^Table T1, Occupied/ }).click();
    await page.getByRole("button", { name: "Hold order" }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status").first()).toContainText("Order T0101-001 held");
    expect(mock.ticketHoldRequests).toEqual([{ version: "v1", holdReason: null }]);
  });

  test("cashier settles a dine-in ticket split between two payers, each choosing a tip", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await page.getByRole("button", { name: /^Table T1, Available/ }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    // A cashier serving the table chooses its waiter; Take payment sends the items first, no separate Send.
    await page.getByRole("combobox", { name: "Waiter" }).selectOption({ label: "QAE Waiter" });
    await page.getByRole("button", { name: "Take payment" }).first().click();
    expect(mock.openRequests[0]).toMatchObject({ waiterEmployeeId: "emp-qae-waiter", items: [{ menuItemId: "menu-qae-1", quantity: 2 }] });
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

  test("waiter builds an order first and holds it at an available table as themselves", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "waiter");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await expect(page.getByRole("button", { name: /^Table T2, Needs cleaning/ })).toBeVisible();
    await page.getByRole("button", { name: "New order" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.getByRole("button", { name: "Hold order" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("QAE Waiter"); // the waiter is the server; no waiter list
    await expect(dialog.getByRole("combobox", { name: "Waiter/Waitress" })).toHaveCount(0);
    await expect(dialog.getByRole("radio", { name: /^Table T2/ })).toBeDisabled(); // needs cleaning
    await expect(dialog.getByRole("button", { name: "Hold order" })).toBeDisabled(); // a table is required
    await dialog.getByRole("radio", { name: /^Table T1/ }).click();
    await dialog.getByRole("radio", { name: "Guests still ordering" }).click();
    await dialog.getByRole("button", { name: "Hold order" }).click();

    await expect(page.getByRole("status").first()).toContainText("Order T0101-001 held");
    expect(mock.holdRequests).toHaveLength(1);
    expect(mock.holdRequests[0]).toMatchObject({
      orderType: "dineIn", tableId: "table-1", waiterEmployeeId: null, waiterUserId: null, holdReason: "Guests still ordering",
      appendToTicketId: null, items: [{ menuItemId: "menu-qae-1", quantity: 1 }],
    });
    await expect(page.getByRole("button", { name: /^Table T1, Held order/ })).toBeVisible();
  });
});
