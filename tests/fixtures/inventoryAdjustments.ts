import type { Page, Route } from "@playwright/test";
import { TEST_BRANCH_ID, TEST_COMPANY_ID } from "./auth";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

export const WAREHOUSE = "loc-qae-main";

type Candidate = Record<string, unknown> & { itemId: string; fifoLotId: string | null };

/** Lots and whole items the location offers; units and costs as the server returns them. */
const lots: Candidate[] = [
  {
    itemId: "item-flour", itemName: "QAE Flour", itemCode: "FLR", locationId: WAREHOUSE, locationName: "Main store",
    uomId: "uom-kg", uomName: "Kilogram", uomCode: "KG", baseUomId: "uom-kg", baseUomName: "Kilogram", baseUomCode: "KG",
    conversionFactor: 1, systemQty: 50, systemQtyBase: 50, availableQty: 50, unitCost: 6, unitCostDisplay: 6,
    fifoLotId: "lot-flour", batchNo: "B2", isItemLevel: false, openLotCount: 1,
  },
  {
    itemId: "item-sugar", itemName: "QAE Sugar", itemCode: "SUG", locationId: WAREHOUSE, locationName: "Main store",
    uomId: "uom-kg", uomName: "Kilogram", uomCode: "KG", baseUomId: "uom-g", baseUomName: "Gram", baseUomCode: "G",
    conversionFactor: 1000, systemQty: 20, systemQtyBase: 20000, availableQty: 20000, unitCost: 0.002, unitCostDisplay: 2,
    fifoLotId: "lot-sugar", batchNo: "S1", isItemLevel: false, openLotCount: 1,
  },
];

const items: Candidate[] = [
  {
    itemId: "item-lime", itemName: "QAE Lime", itemCode: "LIM", locationId: WAREHOUSE, locationName: "Main store",
    uomId: "uom-kg", uomName: "Kilogram", uomCode: "KG", baseUomId: "uom-kg", baseUomName: "Kilogram", baseUomCode: "KG",
    conversionFactor: 1, systemQty: 0, systemQtyBase: 0, availableQty: 0, unitCost: 4, unitCostDisplay: 4,
    fifoLotId: null, isItemLevel: true, openLotCount: 0,
  },
];

export type AdjustmentMock = {
  creates: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  actions: Array<{ action: string; body: Record<string, unknown> }>;
  docs: Map<string, Record<string, unknown>>;
};

type LineInput = { fifoLotId?: string | null; itemId: string; uomId?: string; countedQty: number; reason?: string };

/** Builds lines the way the server does: book quantity and cost from the ledger, counted quantity from the user. */
function serverLines(input: LineInput[]) {
  return input.map((line, index) => {
    const source = [...lots, ...items].find((c) => c.itemId === line.itemId && (c.fifoLotId ?? null) === (line.fifoLotId ?? null))!;
    const factor = source.conversionFactor as number;
    const systemQtyBase = source.systemQtyBase as number;
    const countedQtyBase = line.countedQty * factor;
    const adjustmentQtyBase = countedQtyBase - systemQtyBase;
    return {
      id: `line-${index + 1}`, lineNo: index + 1, itemId: line.itemId, itemName: source.itemName, itemCode: source.itemCode,
      uomId: source.uomId, uomName: source.uomName, uomCode: source.uomCode, baseUomId: source.baseUomId, baseUomName: source.baseUomName,
      conversionFactor: factor, isBaseUnit: factor === 1, systemQty: systemQtyBase / factor, countedQty: line.countedQty,
      adjustmentQty: line.countedQty - systemQtyBase / factor, systemQtyBase, countedQtyBase, adjustmentQtyBase,
      unitCost: source.unitCost, unitCostDisplay: source.unitCostDisplay, lineAmount: Math.round(adjustmentQtyBase * (source.unitCost as number) * 100) / 100,
      fifoLotId: line.fifoLotId ?? null, batchNo: source.batchNo, variancePercent: systemQtyBase === 0 ? 100 : Math.abs((adjustmentQtyBase / systemQtyBase) * 100),
      isHighVariance: systemQtyBase === 0, requiresApproval: false, currentQtyBase: systemQtyBase, notes: line.reason,
    };
  });
}

export function adjustmentDoc(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const lines = serverLines([{ fifoLotId: "lot-flour", itemId: "item-flour", countedQty: 45, reason: "Spilled" }]);
  return {
    id, companyId: TEST_COMPANY_ID, branchId: TEST_BRANCH_ID, locationId: WAREHOUSE, locationName: "Main store", version: "v1",
    adjustmentNo: `ADJ-MAIN-20261028-${id.slice(-4)}`, adjustmentDate: "2026-10-28T09:00:00Z", adjustmentType: "StockCount", docStatus: "Draft",
    reason: "Monthly count", totalSystemQty: 50, totalCountedQty: 45, totalAdjustmentQty: -5, totalAdjustmentValue: -30,
    hasHighVariance: true, highestVariancePercent: 10, createdAt: "2026-10-28T09:00:00Z", createdByName: "Hana", lines,
    ...overrides,
  };
}

export async function mockInventoryAdjustments(page: Page, initial: Record<string, unknown>[] = []): Promise<AdjustmentMock> {
  const mock: AdjustmentMock = { creates: [], updates: [], actions: [], docs: new Map(initial.map((d) => [d.id as string, d])) };
  let next = 1;

  await page.route("**/companies/*/branches/*/stock-locations**", (route) =>
    json(route, [{ id: WAREHOUSE, stockLocationId: WAREHOUSE, name: "Main store", code: "MAIN", isActive: true, canAdjust: true, isDefault: true, branchId: TEST_BRANCH_ID }]));

  await page.route("**/companies/*/inventory-control-settings/effective**", (route) =>
    json(route, {
      id: "settings", companyId: TEST_COMPANY_ID, warningVariancePercent: 5, highVariancePercent: 10, criticalVariancePercent: 25,
      approvalThresholdPercent: 25, requireApprovalForHighVariance: true, blockPostingOnCriticalVariance: true, lockInventoryDuringCount: true,
      requireReasonOnVariance: true, allowNegativeInventory: false, updatedAtUtc: "2026-10-01T00:00:00Z",
    }));

  await page.route("**/companies/*/branches/*/inventory-adjustments**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/inventory-adjustments\/?/, "");
    const method = request.method();
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;

    if (path === "lookups/candidates") return json(route, lots);
    if (path === "lookups/items") return json(route, items);
    if (path === "" && method === "GET") return json(route, [...mock.docs.values()].map((d) => ({ ...d, lines: [] })));
    if (path === "" && method === "POST") {
      mock.creates.push(body);
      const id = `adj-${String(next++).padStart(4, "0")}`;
      const lines = serverLines(body.lines as LineInput[]);
      mock.docs.set(id, adjustmentDoc(id, {
        lines, reason: body.reason, adjustmentType: body.adjustmentType,
        totalAdjustmentValue: lines.reduce((sum, l) => sum + l.lineAmount, 0),
      }));
      return json(route, { id }, 201);
    }

    const [id, action] = path.split("/");
    const doc = mock.docs.get(id);
    if (!doc) return json(route, { title: "Not found" }, 404);
    if (!action && method === "GET") return json(route, doc);
    if (!action && method === "PUT") {
      mock.updates.push(body);
      if (body.version && body.version !== doc.version)
        return json(route, { title: "Record Changed", detail: "Adjustment was changed by someone else. Reload it and try again." }, 409);
      mock.docs.set(id, { ...doc, lines: serverLines(body.lines as LineInput[]), reason: body.reason, docStatus: "Draft", version: `${doc.version}-u` });
      return route.fulfill({ status: 204 });
    }
    mock.actions.push({ action, body });
    const status: Record<string, string> = { submit: "Submitted", approve: "Approved", reject: "Rejected", cancel: "Cancelled", post: "Posted", reverse: "Reversed" };
    mock.docs.set(id, { ...doc, docStatus: status[action] ?? doc.docStatus, version: `${doc.version}-${action}` });
    return route.fulfill({ status: 204 });
  });

  return mock;
}
