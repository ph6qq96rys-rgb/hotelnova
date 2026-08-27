import type { Page } from "@playwright/test";
import { TEST_BRANCH_ID, TEST_COMPANY_ID } from "./auth";

export async function mockMenuEngineering(page: Page): Promise<void> {
  const response = {
    companyId: TEST_COMPANY_ID,
    branchId: TEST_BRANCH_ID,
    analysedAt: new Date().toISOString(),
    totalItems: 4,
    summary: {
      stars: { count: 1, totalRevenue: 12000, totalMargin: 8200 },
      plowhorses: { count: 1, totalRevenue: 8400, totalMargin: 3900 },
      puzzles: { count: 1, totalRevenue: 4200, totalMargin: 3100 },
      dogs: { count: 1, totalRevenue: 900, totalMargin: 200 },
      totalRevenue: 25500,
      totalMargin: 15400,
      avgFoodCostPct: 31.5,
    },
    items: [
      {
        menuItemId: "star-1",
        itemName: "Doro Tibs Signature",
        itemCode: "DT-01",
        category: "STAR",
        categoryLabel: "Stars",
        cost: 160,
        sellingPrice: 420,
        contributionMargin: 260,
        foodCostPct: 38.1,
        quantitySold: 96,
        popularityIndex: 138,
        profitabilityIndex: 126,
        totalRevenue: 40320,
        totalCost: 15360,
        totalMargin: 24960,
        revenue: 40320,
        foodCost: 15360,
        grossProfit: 24960,
        grossProfitPct: 61.9,
        bostonCategory: "STAR",
        aiRecommendation: "Negotiate ingredient costs while protecting demand.",
        analysedAtUtc: new Date().toISOString(),
      },
    ],
  };

  await page.route("**/companies/*/branches/*/menu-engineering", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}
