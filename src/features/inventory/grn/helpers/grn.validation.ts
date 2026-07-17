import type { GrnLineDraft } from "../types/grn.types";

export type GrnLineFieldKey = keyof GrnLineDraft | "inventoryItemId" | "duplicate";
export type GrnLineFieldErrors = Partial<Record<GrnLineFieldKey, string>>;

export interface GrnFieldErrors {
  locationId?: string;
  receivingLocationId?: string;
  receivedDate?: string;
  supplierName?: string;
  notes?: string;
  lines?: string;
  lineErrors?: Record<number, GrnLineFieldErrors>;
}

export interface GrnValidationResult {
  isValid: boolean;
  errors: GrnFieldErrors;
}
