import type { Page } from "@playwright/test";
import { TEST_BRANCH_ID, TEST_COMPANY_ID } from "./auth";

export const TEST_STORE_ID = "store-qae-main";

export async function mockPosWorkstation(page: Page): Promise<void> {
  const openedAtUtc = new Date().toISOString();

  await page.route("**/companies/*/branches/*/pos-sessions/current", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "session-qae-open",
        companyId: TEST_COMPANY_ID,
        branchId: TEST_BRANCH_ID,
        storeId: TEST_STORE_ID,
        storeName: "Main POS",
        cashierName: "QAE Cashier",
        terminal: "POS-QAE",
        openingFloat: 1000,
        openedAtUtc,
        status: "Open",
        isZReported: false,
      }),
    });
  });

  await page.route("**/companies/*/branches/*/stores", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: TEST_STORE_ID,
          companyId: TEST_COMPANY_ID,
          branchId: TEST_BRANCH_ID,
          code: "POS-QAE",
          name: "Main POS",
          isActive: true,
          issueStockLocationId: "stock-qae-main",
          issueStockLocationName: "Main Store",
        },
      ]),
    });
  });

  await page.route("**/companies/*/branches/*/menu/items**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "menu-qae-1",
          name: "QAE Burger",
          code: "QAE-BURGER",
          categoryName: "Food",
          cost: 120,
          sellingPrice: 250,
          isActive: true,
          isAvailableForSale: true,
          hasRecipe: true,
          hasConsumptionLocation: true,
          consumptionLocationName: "Main Store",
          unitsSold: 0,
        },
      ]),
    });
  });

  await page.route("**/companies/*/branches/*/sales", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "sale-qae-1",
        saleNo: "QAE-SALE-001",
        companyId: TEST_COMPANY_ID,
        branchId: TEST_BRANCH_ID,
        storeId: TEST_STORE_ID,
        posSessionId: "session-qae-open",
        soldAtUtc: new Date().toISOString(),
        subTotal: 250,
        discountAmount: 0,
        taxAmount: 20,
        serviceChargeAmount: 0,
        totalAmount: 270,
        totalCogs: 120,
        grossProfit: 150,
        isInventoryPosted: true,
        saleItems: [],
        payments: [],
      }),
    });
  });
}
