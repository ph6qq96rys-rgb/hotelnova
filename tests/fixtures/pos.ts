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

export type PosMockState = {
  settleRequests: Array<Record<string, unknown>>; holdRequests: Array<Record<string, unknown>>;
  saleRequests: Array<Record<string, unknown>>; receiptRequests: string[]; bumps: Array<Record<string, unknown>>; printerSaves: Array<Record<string, unknown>>;
};

export const TEST_SERVICE_SETTINGS = {
  source: "branch", serviceStyle: "tableService", quickServiceRequiresTable: false, quickServiceRequiresWaiter: false,
  requireGuestCount: false, requireHoldReason: false, holdReasons: ["Guests still ordering", "Guest will pay later"],
  markTableForCleaningAfterPayment: false,
  tableRequired: { dineIn: true, takeAway: false, delivery: false, roomService: false },
  waiterRequired: { dineIn: true, takeAway: false, delivery: false, roomService: false },
  version: "svc-v1",
};

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
  const mockState: PosMockState = { settleRequests: [], holdRequests: [], saleRequests: [], receiptRequests: [], bumps: [], printerSaves: [] };
  let saleNo = 1;
  const kitchenOrder = {
    id: "ko-1", stationId: "station-hot", stationName: "Hot kitchen", orderNo: "#0001", ticketNo: "TKT-0001", round: 1, tableLabel: "T1",
    waiterName: "QAE Waiter", orderType: "dineIn", guestCount: 2, note: null, status: "new", sentAtUtc: new Date().toISOString(), sentByName: "QAE Waiter",
    ageSeconds: 30, version: "ko-v1", lines: [{ id: "kol-1", itemName: "QAE Burger", quantity: 2, note: "no onion", isVoided: false }],
  };
  const printers: Array<Record<string, unknown>> = [];
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
    if (path === "service-settings") return json(route, TEST_SERVICE_SETTINGS);
    if (path === "orders/hold" && method === "POST") {
      const body = route.request().postDataJSON();
      mockState.holdRequests.push(body);
      ticket = {
        id: "ticket-1", ticketNo: "T0101-001", orderType: body.orderType, status: "open", tableId: body.tableId,
        tableLabel: "T1", areaName: "Main hall", guestCount: body.guestCount ?? 1, waiterEmployeeId: waiter.employeeId,
        waiterUserId: waiter.userId, waiterName: waiter.name, subtotal: menuItem.sellingPrice, openedAtUtc, lastActivityAtUtc: openedAtUtc,
        openedByName: waiter.name, version: "v1", canEdit: true, canManage: mode === "cashier", heldAtUtc: openedAtUtc,
        holdReason: body.holdReason, heldByName: waiter.name, events: [],
        lines: [{ id: "line-1-0", menuItemId: menuItem.id, itemName: menuItem.name, quantity: 1, unitPrice: menuItem.sellingPrice,
          lineTotal: menuItem.sellingPrice, round: 1, addedAtUtc: openedAtUtc, addedByName: waiter.name, isVoided: false }],
      };
      return json(route, ticket);
    }
    if (path === "tickets/ticket-1/settle" && ticket) {
      const body = route.request().postDataJSON() as { lines?: Array<{ lineId: string; quantity: number }> };
      mockState.settleRequests.push(body);
      const saleId = `sale-qae-split-${saleNo++}`;
      if (body.lines) {
        // Split check: paid quantities move to their own paid lines; the ticket stays open while anything is owed.
        const lines = ticket.lines as Array<Record<string, unknown>>;
        const next: Array<Record<string, unknown>> = [];
        for (const line of lines) {
          const pay = body.lines.find((x) => x.lineId === line.id);
          if (!pay) { next.push(line); continue; }
          const qty = line.quantity as number;
          if (pay.quantity < qty) next.push({ ...line, quantity: qty - pay.quantity, lineTotal: (qty - pay.quantity) * menuItem.sellingPrice });
          next.push({ ...line, id: `${line.id}-paid`, quantity: pay.quantity, lineTotal: pay.quantity * menuItem.sellingPrice, saleId });
        }
        const owed = next.filter((x) => !x.saleId && !x.isVoided);
        ticket = { ...ticket, lines: next, version: `${ticket.version}-s`, status: owed.length ? "open" : "settled",
          subtotal: owed.reduce((sum, x) => sum + (x.lineTotal as number), 0) };
      }
      return json(route, {
        id: body.lines ? saleId : "sale-qae-2", saleNo: "QAE-SALE-002", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID, storeId: TEST_STORE_ID,
        posSessionId: "session-qae-open", soldAtUtc: new Date().toISOString(), subTotal: ticket.subtotal, discountAmount: 0,
        taxAmount: 0, serviceChargeAmount: 0, totalAmount: ticket.subtotal, totalCogs: 120, grossProfit: 130,
        isInventoryPosted: true, saleItems: [], payments: [],
      });
    }
    if (/^sales\/[^/]+\/receipt$/.test(path)) {
      mockState.receiptRequests.push(`${path}?${url.searchParams.get("channel")}`);
      const copyNo = mockState.receiptRequests.filter((x) => x.startsWith(path)).length;
      return json(route, {
        kind: "Receipt", header: { businessName: "Hotel Nova QAE", tin: "0012345678", vatNumber: "VAT-1", branchName: "Main", tillName: "Main POS", fiscalMachineCode: "MRC-1" },
        invoiceNumber: "INV-HQ-00000001", documentNo: "QAE-SALE-001", atUtc: new Date().toISOString(), localTime: "26/10/2026 10:00", cashier: "QAE Cashier",
        orderType: "takeAway", lines: [{ name: "QAE Burger", quantity: 1, unitPrice: 250, lineTotal: 250, vatRate: 15 }], subTotal: 250, discount: 0, serviceCharge: 0,
        taxes: [{ rate: 15, taxable: 250, tax: 37.5 }], taxTotal: 37.5, total: 287.5, payments: [{ method: "CASH", amount: 287.5 }], tips: 0, returned: 0, balance: 0,
        currencyCode: "ETB", isFiscal: false, copyNo, escPosBase64: "", printJobQueued: url.searchParams.get("channel") === "printer",
      });
    }
    if (path === "kitchen/stations" || path === "devices/stations") return json(route, [{ id: "station-hot", code: "HOT", name: "Hot kitchen", kind: "kitchen",
      printerId: null, usesDisplay: true, isDefault: true, isActive: true, categoryIds: [], menuItemIds: [], version: "st-v1" }]);
    if (path === "kitchen/orders") return json(route, [kitchenOrder]);
    if (path === "kitchen/orders/ko-1/bump" && method === "POST") {
      const body = route.request().postDataJSON() as { action: string };
      mockState.bumps.push(body);
      Object.assign(kitchenOrder, { status: body.action === "start" ? "inprogress" : body.action === "ready" ? "ready" : body.action === "served" ? "served" : "inprogress", version: `ko-${mockState.bumps.length + 1}` });
      return json(route, kitchenOrder);
    }
    if (path === "devices/printers" && method === "GET") return json(route, printers);
    if (path === "devices/printers" && method === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      mockState.printerSaves.push(body);
      printers.push({ ...body, id: `printer-${printers.length + 1}`, version: "p-v1" });
      return json(route, printers[printers.length - 1]);
    }
    if (path === "devices/tills") return json(route, [{ id: TEST_STORE_ID, code: "POS-QAE", name: "Main POS", receiptPrinterId: null, fiscalMachineCode: null }]);
    if (path === "devices/agents") return json(route, []);
    if (path === "devices/jobs") return json(route, []);
    if (path === "devices/menu") return json(route, { categories: [{ id: "cat-food", name: "Food" }], items: [{ id: menuItem.id, name: menuItem.name, categoryId: "cat-food" }] });
    if (path === "waiters") return json(route, [waiter]);
    if (path === "stores") return json(route, [{ id: TEST_STORE_ID, companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID,
      code: "POS-QAE", name: "Main POS", isActive: true }]);
    if (path === "floor") return json(route, {
      generatedAtUtc: new Date().toISOString(),
      areas: [{ id: "area-1", name: "Main hall", tables: [
        { id: "table-1", number: "T1", seats: 4, status: ticket ? (ticket.heldAtUtc ? "held" : "occupied") : "available", serviceState: "available", tickets: ticket ? [summary()] : [] },
        { id: "table-2", number: "T2", seats: 2, status: "needsCleaning", serviceState: "needsCleaning", tickets: [] },
      ] }],
      unseatedTickets: [],
    });
    if (path === "tickets" && method === "POST") {
      const body = route.request().postDataJSON();
      ticket = {
        id: "ticket-1", ticketNo: "T0101-001", orderType: body.orderType, status: "open", tableId: body.tableId,
        tableLabel: "T1", areaName: "Main hall", guestCount: body.guestCount, waiterEmployeeId: waiter.employeeId,
        waiterUserId: waiter.userId, waiterName: waiter.name, subtotal: 0, openedAtUtc, lastActivityAtUtc: openedAtUtc,
        openedByName: waiter.name, version: "v1", canEdit: true, canManage: mode === "cashier", lines: [], events: [],
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

  await page.route("**/companies/*/branches/*/sales", (route) => {
    mockState.saleRequests.push(route.request().postDataJSON());
    return json(route, {
      id: "sale-qae-1", saleNo: "QAE-SALE-001", companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID, storeId: TEST_STORE_ID,
      posSessionId: "session-qae-open", soldAtUtc: new Date().toISOString(), subTotal: 250, discountAmount: 0,
      taxAmount: 20, serviceChargeAmount: 0, totalAmount: 270, totalCogs: 120, grossProfit: 150,
      isInventoryPosted: true, saleItems: [], payments: [],
    });
  });
  return mockState;
}
