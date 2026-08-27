import { expect, test } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";
import {
  KITCHEN_BATCH_ID,
  KITCHEN_MENU_ITEM_ID,
  mockKitchenProduction,
} from "../fixtures/productionKitchen";

test.describe("QAE kitchen production UX smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkspaceAuth(page);
    await mockKitchenProduction(page);
  });

  test("recipe management presents a kitchen-friendly stocked production workflow", async ({ page }) => {
    await page.goto(`/companies/${TEST_COMPANY_ID}/production/recipes`);

    await expect(page.getByRole("heading", { name: "Build the recipe the way the kitchen uses it" })).toBeVisible();
    await expect(page.getByText(/Recipe Mode/)).toBeVisible();
    await expect(page.getByText(/Output - Stock received into inventory/)).toBeVisible();
    await expect(page.getByText(/Inputs - Ingredients consumed from stock/)).toBeVisible();
    await expect(page.getByText("Create Production Batch", { exact: true })).toBeVisible();
    await expect(page.getByText("Production recipes consume inputs and receive a finished or semi-finished item into inventory.")).toBeVisible();
  });

  test("production batch control uses the unified kitchen batch flow", async ({ page }) => {
    await page.goto(
      `/companies/${TEST_COMPANY_ID}/production/batches/${KITCHEN_BATCH_ID}?menuItemId=${KITCHEN_MENU_ITEM_ID}`
    );

    await expect(page.getByRole("heading", { name: "Prepare, produce, and post stock in one controlled flow" })).toBeVisible();
    await expect(page.getByText("Recipe ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Create batch", { exact: true })).toBeVisible();
    await expect(page.getByText("Apply recipe", { exact: true })).toBeVisible();
    await expect(page.getByText("Post stock", { exact: true })).toBeVisible();
    await expect(page.getByText(/Issue Location - Raw Materials/)).toBeVisible();
    await expect(page.getByText(/Output Location - Finished Goods/)).toBeVisible();
  });
});
