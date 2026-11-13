import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID, TEST_BRANCH_ID } from "../fixtures/auth";

test.use({ timezoneId: "America/Los_Angeles" });
test("one quotation carries six independently dated services in Addis Ababa time", async ({ page }) => {
  await seedWorkspaceAuth(page, ["catering.view", "catering.manage"]);
  const inquiry = { id: "inquiry", status: "quoted", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID,
    inquiryNo: "INQ-MULTI", customerName: "Conference", expectedGuests: 50 };
  let posted: any;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/catering/inquiries")) body = [inquiry];
    if (path.endsWith("/catering/inquiries/inquiry")) body = inquiry;
    if (path.endsWith("/catering/packages")) body = [{ id: "package", name: "Conference menu", branchId: TEST_BRANCH_ID,
      pricePerPerson: 100, offering: { sections: [], pricingMode: "PerPerson", taxPercent: 15, serviceChargePercent: 5 } }];
    if (path.endsWith("/catering/quotations") && route.request().method() === "POST") { posted = route.request().postDataJSON(); body = { id: "quote" }; }
    await route.fulfill({ json: body });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/eventmanagment/sales?doc=quotations`);
  await page.getByRole("button", { name: "New quotation", exact: true }).click();
  await page.getByRole("combobox", { name: "Inquiry", exact: true }).selectOption("inquiry");
  for (const [index, name, time, guests] of [[0,"Morning tea","10:00",40],[1,"Lunch","12:30",50],[2,"Afternoon tea","15:00",45]] as const) {
    await page.getByRole("button", { name: "Add meal service", exact: true }).click();
    const row = page.getByRole("group", { name: `Service ${index * 2 + 1}`, exact: true });
    await row.getByLabel("Service name", { exact: true }).fill(name);
    await row.getByLabel("Service date and time (Addis Ababa)").fill(`2027-01-10T${time}`);
    await row.getByLabel("Guests for this service").fill(String(guests));
    await row.getByRole("combobox", { name: "Service package" }).selectOption("package");
    await row.getByRole("button", { name: "Repeat next day" }).click();
  }
  await page.getByRole("button", { name: "Create quotation", exact: true }).click();
  await expect.poll(() => posted?.services?.length).toBe(6);
  expect(posted.packageId).toBeNull();
  expect(posted.guestCount).toBe(50);
  expect(posted.services[0]).toMatchObject({ name: "Morning tea", serviceAtUtc: "2027-01-10T07:00:00.000Z", guestCount: 40 });
  expect(posted.services[1].serviceAtUtc).toBe("2027-01-11T07:00:00.000Z");
  expect(posted.services[4].name).toBe("Afternoon tea");
});
