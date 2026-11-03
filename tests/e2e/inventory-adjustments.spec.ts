import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import { adjustmentDoc, mockInventoryAdjustments } from "../fixtures/inventoryAdjustments";

const ALL = ["inventory.view", "inventory.adjustments.view", "inventory.adjustments.create", "inventory.adjustments.approve",
  "inventory.adjustments.post", "inventory.adjustments.cancel"];
const base = `/companies/${TEST_COMPANY_ID}/inventory/adjustments`;

test.describe("Inventory adjustments", () => {
  test("a count sends only what was counted, in the counting unit, with found stock as a whole item", async ({ page }) => {
    await seedWorkspaceAuth(page, ALL);
    const mock = await mockInventoryAdjustments(page);
    await page.goto(`${base}/new`);

    await page.locator(".adj-candidate-card", { hasText: "QAE Sugar" }).click();
    await page.getByRole("tab", { name: "Whole item / found stock" }).click();
    await page.locator(".adj-candidate-card", { hasText: "QAE Lime" }).click();

    const counts = page.locator(".adj-table tbody input[type=number]");
    await counts.nth(0).fill("21");
    await counts.nth(1).fill("3");
    await page.getByLabel("Reason", { exact: true }).fill("Monthly count");
    await page.getByRole("button", { name: "Create draft" }).click();

    await expect.poll(() => mock.creates.length).toBe(1);
    const sent = mock.creates[0];
    expect(sent.lines).toEqual([
      { fifoLotId: "lot-sugar", itemId: "item-sugar", uomId: "uom-kg", countedQty: 21 },
      { fifoLotId: null, itemId: "item-lime", uomId: "uom-kg", countedQty: 3 },
    ]);
    expect(sent).toMatchObject({ locationId: "loc-qae-main", adjustmentType: "StockCount", reason: "Monthly count" });
    expect(typeof sent.adjustmentDate).toBe("string");

    // The saved document shows the server's figures: 1 kg of sugar found is 1000 g at 0.002 = 2.00.
    await expect(page.getByText("ADJ-MAIN-20261028-0001")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Whole item" })).toBeVisible();
    await expect(page.getByRole("row", { name: /QAE Sugar/ })).toContainText("+ETB 2.00");
    await expect(page.getByRole("row", { name: /QAE Lime/ })).toContainText("+ETB 12.00");
  });

  test("a write-off cannot add stock", async ({ page }) => {
    await seedWorkspaceAuth(page, ALL);
    const mock = await mockInventoryAdjustments(page);
    await page.goto(`${base}/new`);

    await page.getByLabel(/Adjustment type/).selectOption("Waste");
    await page.locator(".adj-candidate-card", { hasText: "QAE Flour" }).click();
    await page.locator(".adj-table tbody input[type=number]").first().fill("55");
    await page.getByLabel("Reason", { exact: true }).fill("Bin");
    await page.getByRole("button", { name: "Create draft" }).click();

    await expect(page.getByText("A write-off can only reduce stock.")).toBeVisible();
    expect(mock.creates).toHaveLength(0);
  });

  test("a rejected adjustment is corrected with the loaded version and returns to draft", async ({ page }) => {
    await seedWorkspaceAuth(page, ALL);
    const mock = await mockInventoryAdjustments(page, [
      adjustmentDoc("adj-0042", { docStatus: "Rejected", version: "v-rej", rejectionNote: "Recount the flour", rejectedByName: "Abebe" }),
    ]);
    await page.goto(`${base}/adj-0042/edit`);

    await expect(page.getByText("Rejected by Abebe:")).toBeVisible();
    await page.locator(".adj-table tbody input[type=number]").first().fill("47");
    await page.getByRole("button", { name: "Save correction" }).click();

    await expect.poll(() => mock.updates.length).toBe(1);
    expect(mock.updates[0]).toMatchObject({ version: "v-rej", lines: [{ fifoLotId: "lot-flour", itemId: "item-flour", countedQty: 47, reason: "Spilled" }] });
    await expect(page.getByText("The adjustment is a draft again")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  test("the approval page opens from its route and approves with a note and the version", async ({ page }) => {
    await seedWorkspaceAuth(page, ALL);
    const mock = await mockInventoryAdjustments(page, [adjustmentDoc("adj-0007", { docStatus: "Submitted", version: "v-sub" })]);
    await page.goto(`${base}/adj-0007/approve`);

    await expect(page.getByText("Prepared by Hana")).toBeVisible();
    await page.getByPlaceholder(/Why you approve/).fill("Checked the bin");
    await page.getByRole("button", { name: "Approve adjustment" }).click();

    await expect.poll(() => mock.actions.length).toBe(1);
    expect(mock.actions[0]).toEqual({ action: "approve", body: { note: "Checked the bin", version: "v-sub" } });
  });

  test("a draft is cancelled with a reason", async ({ page }) => {
    await seedWorkspaceAuth(page, ALL);
    const mock = await mockInventoryAdjustments(page, [adjustmentDoc("adj-0008")]);
    await page.goto(`${base}/adj-0008`);

    await page.getByRole("button", { name: "Cancel adjustment" }).click();
    await page.getByPlaceholder("Reason for cancelling").fill("Duplicate count");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel adjustment" }).click();

    await expect.poll(() => mock.actions.length).toBe(1);
    expect(mock.actions[0]).toEqual({ action: "cancel", body: { note: "Duplicate count", version: "v1" } });
    await expect(page.getByText("Cancelled.", { exact: true })).toBeVisible();
  });

  test("a posted adjustment shows its trail and journal, and a viewer gets no actions", async ({ page }) => {
    await seedWorkspaceAuth(page, ["inventory.view", "inventory.adjustments.view"], ["STOREKEEPER"]);
    await mockInventoryAdjustments(page, [
      adjustmentDoc("adj-0009", {
        docStatus: "Posted", autoApproved: true, approvedByName: "Policy (within threshold)", approvedAt: "2026-10-28T09:10:00Z",
        submittedAt: "2026-10-28T09:05:00Z", submittedByName: "Hana", postedAt: "2026-10-28T10:00:00Z", postedByName: "Dawit",
        glStatus: "Posted", glJournalNo: "JV-0007",
      }),
    ]);
    await page.goto(`${base}/adj-0009`);

    await expect(page.getByText("Approved by policy")).toBeVisible();
    await expect(page.getByText("Dawit")).toBeVisible();
    await expect(page.getByText(/journal JV-0007/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reverse" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel adjustment" })).toHaveCount(0);
  });
});
