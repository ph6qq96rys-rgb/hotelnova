import type { Page } from "@playwright/test";

export async function mockSalesRegister(page: Page): Promise<void> {
  await page.route("**/companies/*/branches/*/sales/sale-qae-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "sale-qae-1",
        saleNo: "QAE-SALE-001",
        companyId: "c76834e2-1b3b-4794-9ff8-272c825c4f17",
        branchId: "branch-qae-main",
        branchCode: "MAIN",
        branchName: "Main Branch",
        storeId: "store-qae-pos",
        storeCode: "POS",
        storeName: "Main POS Store",
        posSessionId: "session-qae-001",
        sessionLabel: "POS-01 / SESSION-QAE",
        sourceType: 1,
        sourceName: "POS",
        documentType: "POS Sale",
        externalReferenceNo: "CHK-1042",
        cashierName: "Marta Alemu",
        terminal: "POS-01",
        soldAtUtc: "2026-08-01T10:15:00.000Z",
        createdAt: "2026-08-01T10:15:00.000Z",
        status: 3,
        paymentStatus: 3,
        subTotal: 270,
        discountAmount: 0,
        taxAmount: 0,
        serviceChargeAmount: 0,
        totalAmount: 270,
        totalCogs: 120,
        grossProfit: 150,
        isInventoryPosted: true,
        saleItems: [
          {
            id: "sale-line-qae-1",
            menuItemId: "menu-item-qae-doro",
            menuItemName: "Doro Tibs Signature",
            quantity: 1,
            unitPrice: 270,
            lineTotal: 270,
            lineCogs: 120,
          },
        ],
        payments: [
          {
            id: "payment-qae-1",
            method: "CASH",
            amount: 270,
            referenceCode: "CASH-1042",
            paidAt: "2026-08-01T10:16:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/companies/*/branches/*/sales**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.endsWith("/sales")) {
      await route.fallback();
      return;
    }

    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const allRows = [
      {
        id: "sale-qae-1",
        saleNo: "QAE-SALE-001",
        soldAtUtc: "2026-08-01T10:15:00.000Z",
        status: 3,
        paymentStatus: 3,
        totalAmount: 270,
        totalCogs: 120,
        grossProfit: 150,
        isInventoryPosted: true,
        itemCount: 1,
        saleItems: [
          {
            id: "sale-line-qae-1",
            menuItemId: "menu-item-qae-doro",
            menuItemName: "Doro Tibs Signature",
            quantity: 1,
            unitPrice: 270,
            lineTotal: 270,
          },
        ],
      },
    ];
    const rows = q
      ? allRows.filter((row) => row.saleNo.toLowerCase().includes(q))
      : allRows;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: rows,
        totalCount: rows.length,
        page: 1,
        pageSize: 20,
      }),
    });
  });

  await page.route("**/companies/*/branches/*/sales/post-cogs/bulk**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ posted: 1, skipped: 0, failed: 0 }),
    });
  });
}
