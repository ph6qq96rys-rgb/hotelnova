import type { CreateGrnDraftRequest, DateOnlyString, GrnDraft, GrnLineDraft, Guid } from "../types/grn.types";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type GrnRequestScope = {
  companyId?: Guid;
  branchId?: Guid;
};

export function todayLocalDate(): DateOnlyString {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const createEmptyGrnLine = (): GrnLineDraft => ({
  itemId: "",
  uomId: "",
  quantity: 1,
  unitCost: 0,
  batchNo: "",
  expiryDate: null,
  notes: "",
});

export const createEmptyGrnDraft = (): GrnDraft => ({
  id: undefined,
  locationId: "",
  receivedDate: todayLocalDate(),
  supplierName: "",
  notes: "",
  lines: [createEmptyGrnLine()],
});

export function buildCreateGrnRequest(draft: GrnDraft, scope: GrnRequestScope = {}): CreateGrnDraftRequest {
  return {
    companyId: scope.companyId,
    branchId: scope.branchId,
    receivingBranchId: scope.branchId,
    receivingLocationId: draft.locationId,
    receivedDate: draft.receivedDate,
    supplierName: cleanText(draft.supplierName) || null,
    notes: cleanText(draft.notes) || null,
    lines: draft.lines.map((line) => ({
      itemId: line.itemId,
      uomId: line.uomId,
      quantity: safeNumber(line.quantity),
      unitCost: safeNumber(line.unitCost),
      batchNo: cleanText(line.batchNo) || null,
      expiryDate: line.expiryDate || null,
      notes: cleanText(line.notes) || null,
    })),
  };
}
