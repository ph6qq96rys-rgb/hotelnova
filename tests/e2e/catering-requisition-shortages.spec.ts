import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID, TEST_BRANCH_ID } from "../fixtures/auth";

test("shortage requisition requires a receiving warehouse and sends a draft with priority", async ({ page }) => {
  await seedWorkspaceAuth(page, ["catering.view", "inventory.view", "purchasing.view", "purchasing.create"]);
  let request: any;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/catering/events")) body = [{ id: "event-1", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID,
      eventNo: "EV-TEST", customerName: "Test customer", venueName: "Hall", eventDateUtc: "2027-01-10T09:00:00Z",
      status: "confirmed", serviceStyle: "buffet", guestCount: 25, contractValue: 1000, remainingBalance: 1000, payments: [] }];
    if (path.endsWith("/requirements")) body = { eventId: "event-1", hasShortages: true, menuItems: [], ingredients: [], guestCount: 25 };
    if (path.endsWith("/receiving-locations")) body = [{ id: "warehouse-1", name: "Main Warehouse" }];
    if (path.endsWith("/procurement/requisition")) { request = route.request().postDataJSON(); body = { purchaseRequisitionNo: "PR-TEST" }; }
    await route.fulfill({ json: body });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/eventmanagment/inventory?event=event-1`);
  await page.getByRole("button", { name: "Requisition shortages", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Requisition shortages", exact: true })).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Receiving destination" }).selectOption("warehouse-1");
  await dialog.getByRole("button", { name: "Requisition shortages", exact: true }).click();
  await expect.poll(() => request).toMatchObject({ priority: "Normal", submit: false, deliveryLocationId: "warehouse-1" });
  await expect(dialog).toHaveCount(0);
});
