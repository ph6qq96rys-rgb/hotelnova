import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { mockPosWorkstation } from "../fixtures/pos";

test.describe("POS ERP controls", () => {
  test("cashier splits a ticket by items and the rest stays open", async ({ page }) => {
    await seedWorkspaceAuth(page);
    const mock = await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await page.getByRole("button", { name: /^Table T1, Available/ }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.getByRole("combobox", { name: "Waiter" }).selectOption({ label: "QAE Waiter" });
    await page.getByRole("button", { name: "Send order" }).first().click();
    // Sending returns to the floor; the cashier reopens the table to split the bill.
    await page.getByRole("button", { name: /^Table T1, Occupied/ }).click();
    await expect(page.locator(".rpos-round h3").first()).toContainText("Round 1");

    await page.getByRole("button", { name: "Split by items" }).click();
    await page.getByLabel("Quantity to pay QAE Burger").fill("1");
    await page.getByRole("button", { name: "Pay selected items" }).click();
    await expect(page.getByRole("heading", { name: /selected items/ })).toBeVisible();
    await page.getByRole("radio", { name: "No tip" }).click();
    await page.getByRole("button", { name: "Exact amount" }).click();
    await page.getByRole("button", { name: "Complete Sale" }).click();

    expect(mock.settleRequests[0].lines).toEqual([{ lineId: "line-1-0", quantity: 1 }]);
    // The ticket is still open with the unpaid burger; the paid one is marked.
    await expect(page.getByRole("heading", { name: "Ticket T0101-001", exact: true })).toBeVisible();
    await expect(page.getByText("Paid separately")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Payment/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print receipt" })).toBeVisible();
    await page.getByRole("button", { name: "Print receipt" }).click();
    await expect.poll(() => mock.receiptRequests.length).toBe(1);
    expect(mock.receiptRequests[0]).toMatch(/receipt\?browser$/);
  });

  test("a supervisor gives a reasoned discount on a counter sale", async ({ page }) => {
    await seedWorkspaceAuth(page, ["sales.discount.approve"]);
    const mock = await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos`);

    await page.getByRole("button", { name: "New order" }).click();
    await page.locator(".rpos-menu-card", { hasText: "QAE Burger" }).click();
    await page.getByRole("button", { name: "Take payment" }).first().click();
    await page.getByRole("button", { name: "Add discount" }).click();
    await page.getByLabel("Amount", { exact: true }).fill("50");
    await page.getByLabel("Reason").fill("Regular guest");
    await page.getByRole("button", { name: "Apply discount" }).click();
    await expect(page.getByText("Discount -50.00 · Regular guest")).toBeVisible();
    await page.getByRole("button", { name: "Exact amount" }).click();
    await page.getByRole("button", { name: "Complete Sale" }).click();

    await expect.poll(() => mock.saleRequests.length).toBe(1);
    expect(mock.saleRequests[0]).toMatchObject({ discountAmount: 50, discountReason: "Regular guest" });
  });

  test("the kitchen display shows sent orders and bumps them", async ({ page }) => {
    await seedWorkspaceAuth(page, ["kitchen.view"]);
    const mock = await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos/kitchen`);

    const card = page.getByRole("article", { name: "Order #0001" });
    await expect(card).toContainText("2 × QAE Burger");
    await expect(card).toContainText("no onion");
    await card.getByRole("button", { name: "Start" }).click();
    await expect(card).toContainText("Cooking");
    await card.getByRole("button", { name: "Ready" }).click();
    expect(mock.bumps.map((x) => x.action)).toEqual(["start", "ready"]);
  });

  test("a manager adds a network receipt printer", async ({ page }) => {
    await seedWorkspaceAuth(page, ["pos.devices.manage"]);
    const mock = await mockPosWorkstation(page, "cashier");
    await page.goto(`/companies/${TEST_COMPANY_ID}/sales/pos/devices`);

    await expect(page.getByRole("heading", { name: "POS Devices" })).toBeVisible();
    await page.getByRole("button", { name: "Add printer" }).click();
    await page.getByLabel("Name").fill("Front counter");
    await page.getByLabel("Address").fill("192.168.1.50:9100");
    await page.getByLabel("A cash drawer is connected to this printer").check();
    await page.getByRole("button", { name: "Save printer" }).click();
    await expect(page.getByRole("cell", { name: "Front counter" })).toBeVisible();
    expect(mock.printerSaves[0]).toMatchObject({ name: "Front counter", role: "receipt", address: "192.168.1.50:9100", hasCashDrawer: true, charsPerLine: 42 });
  });
});
