import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID, TEST_BRANCH_ID } from "../fixtures/auth";

const inquiry = (id: string, status: string) => ({
  id, status, companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID,
  branchName: "Main Branch", customerId: "customer", customerName: "Test Customer",
  customerNo: "C-1", inquiryNo: `INQ-${id}`, expectedGuests: 25,
  eventType: "meeting", proposedEventDateUtc: "2027-01-10T10:00:00Z",
  serviceStyle: "buffet", leadSource: "phone", venueName: "Hall", contactPersonName: "Contact",
});

test("closed inquiries cannot be selected and a newly closed inquiry is caught before posting", async ({ page }) => {
  await seedWorkspaceAuth(page, ["catering.view", "catering.manage"]);
  let posted = false;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/catering/inquiries")) body = [inquiry("open", "quoted"), inquiry("won", "won"), inquiry("lost", "lost")];
    if (path.endsWith("/catering/inquiries/open")) body = inquiry("open", "won");
    if (path.endsWith("/catering/quotations") && route.request().method() === "POST") posted = true;
    await route.fulfill({ json: body });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/eventmanagment/sales?doc=quotations`);
  await page.getByRole("button", { name: "New quotation", exact: true }).click();
  const selector = page.getByRole("combobox", { name: "Inquiry", exact: true });
  await expect(selector.locator("option")).toHaveText(["Select inquiry", "INQ-open · Test Customer · 25 guests"]);
  await selector.selectOption("open");
  await page.getByRole("button", { name: "Create quotation", exact: true }).click();
  await expect(page.getByText(/This inquiry is closed as Won/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create quotation", exact: true })).toBeDisabled();
  expect(posted).toBe(false);
});

for (const status of ["won", "lost"]) {
  test(`${status} inquiry explains closure and disables quotation creation`, async ({ page }) => {
    await seedWorkspaceAuth(page, ["catering.view", "catering.manage"]);
    await page.route("**/api/**", route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/catering/inquiries") ? [inquiry(status, status)] : [] }));
    await page.goto(`/companies/${TEST_COMPANY_ID}/eventmanagment/sales?doc=inquiries&id=${status}`);
    await expect(page.getByRole("button", { name: "Raise quotation" })).toBeDisabled();
    await expect(page.getByText(new RegExp(`This inquiry is closed as ${status === "won" ? "Won" : "Lost"}`))).toBeVisible();
    await page.getByRole("button", { name: "Quotations", exact: true }).click();
    await expect(page.getByRole("button", { name: "New quotation", exact: true })).toBeDisabled();
    await expect(page.getByText("No open inquiries are available. Create a new inquiry before preparing a quotation.")).toBeVisible();
  });
}
