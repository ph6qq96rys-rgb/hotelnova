import type { Page, Route } from "@playwright/test";
import { TEST_BRANCH_ID, TEST_COMPANY_ID } from "./auth";

export const TEST_STORE_ID = "store-qae-main";

type Mode = "cashier" | "waiter";

/** Tip settings the mocked branch returns: tips on for dine-in at 5/10/15%. */
export const TEST_TIP_SETTINGS = {
  source: "branch", isEnabled: true, suggestedPercents: [5, 10, 15], allowCustom: true, allowNoTip: true,
  basis: "afterTax", distribution: "individual", poolingEnabled: false, trackCashTips: true,
  enabledForDineIn: true, enabledForTakeAway: false, enabledForDelivery: false, enabledForRoomService: false,
  updatedAtUtc: "2026-10-04T09:00:00Z", version: "tips-v1",
};

export type PosMockState = { settleRequests: Array<Record<string, unknown>> };

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const menuItem = {
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
};

/**
 * Mocks the POS API for UI tests. Tickets are kept in memory so opening a table,
 * sending a round and reading the ticket back behave like the real service.
 */
export async function mockPosWorkstation(page: Page, mode: Mode = "cashier"): Promise<PosMockState> {
  const mockState: PosMockState = { settleRequests: [] };
  const openedAtUtc = new Date().toISOString();
  const waiter = { employeeId: "emp-qae-waiter", userId: "qae-user", name: "QAE Waiter", hasLogin: true, openTickets: 0 };
  let ticket: Record<string, unknown> | null = null;

  const summary = () => ticket && {
    ...ticket, itemCount: (ticket.lines as Array<{ quantity: number }>).reduce((sum, line) => sum + line.quantity, 0),
  };

  await page.route("**/companies/*/branches/*/pos-sessions/current", (route) =>
    json(route, {
      id: "session-qae-open", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID, storeId: TEST_STORE_ID,
      storeName: "Main POS", cashierName: "QAE Cashier", terminal: "POS-QAE", openingFloat: 1000, openedAtUtc,
      status: "Open", isZReported: false,
    }));

  await page.route("**/companies/*/branches/*/pos/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/pos\//, "");
    const method = route.request().method();

    if (path === "me") return json(route, { userId: "qae-user", name: mode === "cashier" ? "QAE Cashier" : "QAE Waiter",
      employeeId: mode === "waiter" ? waiter.employeeId : null, canManageTickets: mode === "cashier", canVoid: mode === "cashier" });
    if (path === "menu") return json(route, [menuItem]);
    if (path === "tips/settings") return json(route, TEST_TIP_SETTINGS);
    if (path === "tickets/ticket-1/settle" && ticket) {
      mockState.settleRequests.push(route.request().postDataJSON());
      return json(route, {
        id: "sale-qae-2", saleNo: "QAE-SALE-002", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID, storeId: TEST_STORE_ID,
        posSessionId: "session-qae-open", soldAtUtc: new Date().toISOString(), subTotal: ticket.subtotal, discountAmount: 0,
        taxAmount: 0, serviceChargeAmount: 0, totalAmount: ticket.subtotal, totalCogs: 120, grossProfit: 130,
        isInventoryPosted: true, saleItems: [], payments: [],
      });
    }
    if (path === "waiters") return json(route, [waiter]);
    if (path === "stores") return json(route, [{ id: TEST_STORE_ID, companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID,
      code: "POS-QAE", name: "Main POS", isActive: true }]);
    if (path === "floor") return json(route, {
      generatedAtUtc: new Date().toISOString(),
      areas: [{ id: "area-1", name: "Main hall", tables: [
        { id: "table-1", number: "T1", seats: 4, status: ticket ? "occupied" : "free", tickets: ticket ? [summary()] : [] },
        { id: "table-2", number: "T2", seats: 2, status: "free", tickets: [] },
      ] }],
      unseatedTickets: [],
    });
    if (path === "tickets" && method === "POST") {
      const body = route.request().postDataJSON();
      ticket = {
        id: "ticket-1", ticketNo: "T0101-001", orderType: body.orderType, status: "open", tableId: body.tableId,
        tableLabel: "T1", areaName: "Main hall", guestCount: body.guestCount, waiterEmployeeId: waiter.employeeId,
        waiterUserId: waiter.userId, waiterName: waiter.name, subtotal: 0, openedAtUtc, lastActivityAtUtc: openedAtUtc,
        openedByName: waiter.name, version: "v1", canEdit: true, canManage: mode === "cashier", lines: [],
      };
      return json(route, ticket, 201);
    }
    if (path === "tickets/ticket-1" && ticket) return json(route, ticket);
    if (path === "tickets/ticket-1/items" && ticket) {
      const { items } = route.request().postDataJSON() as { items: Array<{ menuItemId: string; quantity: number }> };
      const round = (ticket.lines as unknown[]).length ? 2 : 1;
      ticket = {
        ...ticket, version: `v${round + 1}`,
        lines: [...(ticket.lines as unknown[]), ...items.map((item, index) => ({
          id: `line-${round}-${index}`, menuItemId: item.menuItemId, itemName: menuItem.name, quantity: item.quantity,
          unitPrice: menuItem.sellingPrice, lineTotal: item.quantity * menuItem.sellingPrice, round,
          addedAtUtc: new Date().toISOString(), addedByName: waiter.name, isVoided: false,
        }))],
      };
      ticket.subtotal = (ticket.lines as Array<{ lineTotal: number }>).reduce((sum, line) => sum + line.lineTotal, 0);
      return json(route, ticket);
    }
    return json(route, { title: "Not mocked", detail: path }, 404);
  });

  await page.route("**/companies/*/branches/*/sales", (route) =>
    json(route, {
      id: "sale-qae-1", saleNo: "QAE-SALE-001", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID, storeId: TEST_STORE_ID,
      posSessionId: "session-qae-open", soldAtUtc: new Date().toISOString(), subTotal: 250, discountAmount: 0,
      taxAmount: 20, serviceChargeAmount: 0, totalAmount: 270, totalCogs: 120, grossProfit: 150,
      isInventoryPosted: true, saleItems: [], payments: [],
    }));
  return mockState;
}
