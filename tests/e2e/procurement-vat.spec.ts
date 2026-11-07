import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

test("VAT on Purchases: set an item exempt", async ({ page }) => {
  await seedWorkspaceAuth(page, ["purchasing.view", "purchasing.manage"]);
  const puts: unknown[] = [];
  let teff: string | null = null;
  await page.route("**/procurement/vat/categories", (r) => r.fulfill({ json: [
    { id: "c1", code: "GRAIN", name: "Grains", parentId: null, vatTreatment: null, effective: "Standard", itemCount: 2 }] }));
  await page.route("**/procurement/vat/items**", async (r) => {
    if (r.request().method() === "PUT") { puts.push(r.request().postDataJSON()); teff = "Exempt"; return r.fulfill({ json: { changed: 1 } }); }
    return r.fulfill({ json: [
      { id: "i1", name: "Teff", sku: "T-1", categoryName: "Grains", vatTreatment: teff, effective: teff ?? "Standard" },
      { id: "i2", name: "Imported rice", sku: null, categoryName: "Grains", vatTreatment: null, effective: "Standard" }] });
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/procurement/vat`);
  await expect(page.getByRole("heading", { name: "VAT on Purchases" })).toBeVisible();
  await page.getByLabel("VAT setting Teff").selectOption("Exempt");
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0]).toEqual({ itemIds: ["i1"], vatTreatment: "Exempt" });
  await expect(page.getByText("1 items updated.")).toBeVisible();
});
