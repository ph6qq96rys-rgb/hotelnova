// src/features/eventmanagment/api/eventStockApi.ts
//
// Event-scoped stock, lifecycle and profitability endpoints. Everything here is keyed by the
// catering event; the old quotation-scoped operations were retired on the server (410 Gone).

import { http } from "../../../api/http";

const eventPath = (companyId: string, eventId: string, suffix = "") =>
  `/companies/${companyId}/catering/events/${eventId}${suffix}`;

export type EventStatus = "pendingDeposit" | "confirmed" | "inPlanning" | "inExecution" | "completed" | "cancelled";

export type ClosureCheck = { key: string; label: string; isMet: boolean; detail?: string | null };
export type ClosureReadiness = {
  eventId: string;
  eventNo: string;
  status: EventStatus;
  canComplete: boolean;
  checks: ClosureCheck[];
};

export type IngredientRequirement = {
  itemId: string;
  itemName: string;
  baseUomCode: string;
  consumptionLocationId?: string | null;
  consumptionLocationName?: string | null;
  requiredBaseQty: number;
  availableBaseQty: number;
  reservedBaseQty: number;
  shortageBaseQty: number;
  isShort: boolean;
  issuedBaseQty: number;
  pendingIssueBaseQty: number;
  /** Still to be issued (required less issued and pending issues). */
  outstandingBaseQty: number;
  eventReservedBaseQty: number;
};

export type Requirements = {
  eventId: string;
  eventNo: string;
  packageName?: string | null;
  guestCount: number;
  hasPackage: boolean;
  hasMissingRecipes: boolean;
  hasShortages: boolean;
  menuItems: Array<{
    menuItemId: string;
    menuItemName: string;
    requiredMenuQuantity: number;
    hasActiveRecipe: boolean;
  }>;
  ingredients: IngredientRequirement[];
};

export type Reservation = {
  id: string;
  reservationNo: string;
  status: "active" | "released" | "consumed" | string;
  reservedAtUtc: string;
  releasedAtUtc?: string | null;
  releaseReason?: string | null;
  notes?: string | null;
  lines: Array<{
    id: string;
    stockLocationName: string;
    itemId: string;
    itemName: string;
    baseUomCode: string;
    reservedBaseQty: number;
    releasedBaseQty: number;
  }>;
};

export type ReturnLine = {
  id: string;
  description: string;
  inventoryItemId?: string | null;
  inventoryItemName?: string | null;
  quantityIssued: number;
  quantityReturned: number;
  uomCode?: string | null;
  unitCost: number;
  lineCost: number;
};
export type EventReturn = {
  id: string;
  returnNo: string;
  status: "recorded" | "cancelled";
  returnedAtUtc: string;
  notes?: string | null;
  stockPostedAtUtc?: string | null;
  totalReturnedCost: number;
  cancellationReason?: string | null;
  lines: ReturnLine[];
};

export type WasteType =
  "preparedFood" | "ingredient" | "spoilage" | "transportationDamage" | "customerRelated" | "other";
export type EventWaste = {
  id: string;
  wasteNo: string;
  status: "recorded" | "approved" | "cancelled";
  recordedAtUtc: string;
  approvedAtUtc?: string | null;
  notes?: string | null;
  totalWasteQuantity: number;
  totalEstimatedCost: number;
  cancellationReason?: string | null;
  lines: Array<{
    id: string;
    wasteType: WasteType;
    description: string;
    inventoryItemId?: string | null;
    inventoryItemName?: string | null;
    quantity: number;
    uomCode?: string | null;
    unitCost: number;
    reason?: string | null;
  }>;
};

export type ReconciliationLine = {
  id: string;
  description: string;
  inventoryItemId?: string | null;
  uomCode?: string | null;
  quantityIssued: number;
  quantityReturned: number;
  grossConsumptionQty: number;
  actualFoodConsumptionQty: number;
  recordedWasteQty: number;
  approvedVarianceQty: number;
  unexplainedVarianceQty: number;
  reviewNote?: string | null;
  unitCost: number;
};
export type Reconciliation = {
  id: string;
  reconciliationNo: string;
  status: "draft" | "requiresReview" | "approved" | "closed" | "cancelled";
  reconciledAtUtc: string;
  varianceToleranceQty: number;
  requiresReview: boolean;
  notes?: string | null;
  totalIssuedCost: number;
  totalReturnedCost: number;
  totalWasteCost: number;
  totalUnexplainedCost: number;
  lines: ReconciliationLine[];
};

export type Profitability = {
  id: string;
  analysisNo: string;
  status: "draft" | "approved" | "cancelled";
  calculatedAtUtc: string;
  finalBillNo?: string | null;
  revenueAmount: number;
  foodCostAmount: number;
  laborCostAmount: number;
  transportationCostAmount: number;
  equipmentCostAmount: number;
  wasteCostAmount: number;
  otherDirectCostAmount: number;
  totalDirectCostAmount: number;
  contributionMarginAmount: number;
  contributionMarginPercent: number;
  notes?: string | null;
};

export type ProfitabilityInput = {
  laborCostAmount: number;
  transportationCostAmount: number;
  equipmentCostAmount: number;
  otherDirectCostAmount: number;
  notes?: string | null;
};

async function get<T>(url: string, signal?: AbortSignal) {
  const { data } = await http.get<T>(url, { signal });
  return data;
}
async function post<T>(url: string, body: unknown = {}) {
  const { data } = await http.post<T>(url, body);
  return data;
}

export const eventStockApi = {
  requirements: (c: string, e: string, s?: AbortSignal) => get<Requirements>(eventPath(c, e, "/requirements"), s),
  closureReadiness: (c: string, e: string, s?: AbortSignal) =>
    get<ClosureReadiness>(eventPath(c, e, "/closure-readiness"), s),
  start: (c: string, e: string) => post<unknown>(eventPath(c, e, "/start")),
  complete: (c: string, e: string) => post<unknown>(eventPath(c, e, "/complete")),
  reopen: (c: string, e: string, reason: string) => post<unknown>(eventPath(c, e, "/reopen"), { reason }),

  reservations: (c: string, e: string, s?: AbortSignal) => get<Reservation[]>(eventPath(c, e, "/reservations"), s),
  reserve: (c: string, e: string, notes: string | null) =>
    post<Reservation>(eventPath(c, e, "/reservations"), { notes }),
  releaseReservation: (c: string, e: string, id: string, reason: string) =>
    post<Reservation>(eventPath(c, e, `/reservations/${id}/release`), { reason }),

  createSiv: (c: string, e: string, body: { submit: boolean; notes: string | null }) =>
    post<{ sivNo: string }>(eventPath(c, e, "/sivs"), {
      departmentId: null,
      toLocationId: null,
      issueDateUtc: null,
      allowDuplicate: false,
      ...body,
    }),
  butcheryDemand: (c: string, e: string, notes: string | null) =>
    post<unknown>(eventPath(c, e, "/butchery/demand"), { notes }),
  requisition: (c: string, e: string, notes: string | null) =>
    post<unknown>(eventPath(c, e, "/procurement/requisition"), { notes }),

  returns: (c: string, e: string, s?: AbortSignal) => get<EventReturn[]>(eventPath(c, e, "/returns"), s),
  createReturn: (
    c: string,
    e: string,
    body: {
      notes: string | null;
      returnLocationId: string | null;
      lines: Array<{
        inventoryItemId: string;
        description: string;
        quantityIssued: number;
        quantityReturned: number;
        uomCode: string | null;
      }>;
    },
  ) =>
    post<EventReturn>(eventPath(c, e, "/returns"), {
      returnedAtUtc: null,
      receivedByEmployeeId: null,
      responsibleEmployeeId: null,
      notes: body.notes,
      returnLocationId: body.returnLocationId,
      lines: body.lines.map((l) => ({
        lineType: "food",
        description: l.description,
        quantityIssued: l.quantityIssued,
        quantityReturned: l.quantityReturned,
        uomCode: l.uomCode,
        isReturnable: true,
        inventoryItemId: l.inventoryItemId,
        menuItemId: null,
        sivId: null,
        dispatchLineId: null,
        notes: null,
      })),
    }),
  cancelReturn: (c: string, e: string, id: string, reason: string) =>
    post<EventReturn>(eventPath(c, e, `/returns/${id}/cancel`), { reason }),

  waste: (c: string, e: string, s?: AbortSignal) => get<EventWaste[]>(eventPath(c, e, "/waste"), s),
  createWaste: (
    c: string,
    e: string,
    body: {
      notes: string | null;
      lines: Array<{
        inventoryItemId: string;
        description: string;
        quantity: number;
        uomCode: string | null;
        wasteType: WasteType;
        reason: string | null;
      }>;
    },
  ) =>
    post<EventWaste>(eventPath(c, e, "/waste"), {
      recordedAtUtc: null,
      reportedByEmployeeId: null,
      responsibleEmployeeId: null,
      notes: body.notes,
      lines: body.lines.map((l) => ({
        ...l,
        estimatedCost: null,
        menuItemId: null,
        sivId: null,
        dispatchLineId: null,
        returnLineId: null,
        notes: null,
      })),
    }),
  approveWaste: (c: string, e: string, id: string) => post<EventWaste>(eventPath(c, e, `/waste/${id}/approve`)),
  cancelWaste: (c: string, e: string, id: string, reason: string) =>
    post<EventWaste>(eventPath(c, e, `/waste/${id}/cancel`), { reason }),

  reconciliations: (c: string, e: string, s?: AbortSignal) =>
    get<Reconciliation[]>(eventPath(c, e, "/reconciliations"), s),
  reconciliation: (c: string, e: string, id: string, s?: AbortSignal) =>
    get<Reconciliation>(eventPath(c, e, `/reconciliations/${id}`), s),
  reconcile: (
    c: string,
    e: string,
    body: {
      varianceToleranceQty: number;
      notes: string | null;
      reviews: Array<{
        inventoryItemId: string;
        description: string;
        approvedVarianceQty: number;
        reviewNote: string | null;
      }>;
    },
  ) =>
    post<Reconciliation>(eventPath(c, e, "/reconciliations"), {
      reconciledAtUtc: null,
      varianceToleranceQty: body.varianceToleranceQty,
      notes: body.notes,
      // The server computes issued, returned, standard and waste quantities; only the review is sent.
      lines: body.reviews.map((r) => ({
        lineType: "ingredient",
        description: r.description,
        inventoryItemId: r.inventoryItemId,
        menuItemId: null,
        uomCode: null,
        quantityIssued: 0,
        quantityReturned: 0,
        actualFoodConsumptionQty: 0,
        recordedWasteQty: 0,
        approvedVarianceQty: r.approvedVarianceQty,
        reviewNote: r.reviewNote,
      })),
    }),
  approveReconciliation: (c: string, e: string, id: string) =>
    post<Reconciliation>(eventPath(c, e, `/reconciliations/${id}/approve`)),
  cancelReconciliation: (c: string, e: string, id: string, reason: string) =>
    post<Reconciliation>(eventPath(c, e, `/reconciliations/${id}/cancel`), { reason }),

  profitability: (c: string, e: string, s?: AbortSignal) => get<Profitability[]>(eventPath(c, e, "/profitability"), s),
  previewProfitability: (c: string, e: string, input: ProfitabilityInput) =>
    post<Profitability>(eventPath(c, e, "/profitability/preview"), profitabilityBody(input)),
  createProfitability: (c: string, e: string, input: ProfitabilityInput) =>
    post<Profitability>(eventPath(c, e, "/profitability"), profitabilityBody(input)),
  approveProfitability: (c: string, e: string, id: string) =>
    post<Profitability>(eventPath(c, e, `/profitability/${id}/approve`)),
  cancelProfitability: (c: string, e: string, id: string, reason: string) =>
    post<Profitability>(eventPath(c, e, `/profitability/${id}/cancel`), { reason }),
};

/** Revenue, food and waste cost are taken from the issued bill and the ledger on the server. */
function profitabilityBody(input: ProfitabilityInput) {
  return {
    finalBillId: null,
    calculatedAtUtc: null,
    revenueAmount: null,
    foodCostAmount: 0,
    wasteCostAmount: null,
    laborCostAmount: input.laborCostAmount,
    transportationCostAmount: input.transportationCostAmount,
    equipmentCostAmount: input.equipmentCostAmount,
    otherDirectCostAmount: input.otherDirectCostAmount,
    notes: input.notes ?? null,
  };
}
