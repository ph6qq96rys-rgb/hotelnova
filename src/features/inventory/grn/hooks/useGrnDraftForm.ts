import { useCallback, useEffect, useMemo, useState } from "react";
import { grnApi, type GrnScope } from "../api/grnApi";
import type { CreateGrnDraftRequest, GrnDetailDto } from "../types/grn.types";
import { getApiErrorMessage } from "../helpers/grn.errors";
import { todayLocalDate } from "../helpers/grn.builders";
import type { GrnItemVm } from "./useGrnLookups";

export type GrnLineForm = {
  itemId: string;
  uomId: string;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
  notes: string;
};

export type GrnForm = {
  id?: string;
  receivingLocationId: string;
  receivedDate: string;
  supplierName: string;
  notes: string;
  lines: GrnLineForm[];
};

export type LineErrors = Partial<Record<keyof GrnLineForm, string>>;
export type FormErrors = Partial<Record<"receivingLocationId" | "receivedDate" | "lines", string>> & {
  lineErrors?: Record<number, LineErrors>;
};

export function createEmptyGrnLine(): GrnLineForm {
  return {
    itemId: "",
    uomId: "",
    quantity: "1",
    unitCost: "0",
    batchNo: "",
    expiryDate: "",
    notes: "",
  };
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function nullable(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned ? cleaned : null;
}

function parseDecimal(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isPositive(value: unknown): boolean {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isNonNegative(value: unknown): boolean {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function dateOnly(value: unknown): string {
  const raw = clean(value);
  return raw ? raw.slice(0, 10) : todayLocalDate();
}

function normalizeDraft(dto: GrnDetailDto): GrnForm {
  const d = dto as GrnDetailDto & {
    warehouseId?: string | null;
    locationId?: string | null;
    receivedAt?: string | null;
    receiptDate?: string | null;
    receivedAtUtc?: string | null;
  };

  return {
    id: clean(d.id),
    receivingLocationId: clean(d.receivingLocationId ?? d.locationId ?? d.warehouseId),
    receivedDate: dateOnly(d.receivedDate ?? d.receivedAt ?? d.receiptDate ?? d.receivedAtUtc),
    supplierName: clean(d.supplierName),
    notes: clean(d.notes),
    lines: Array.isArray(d.lines) && d.lines.length
      ? d.lines.map((line) => ({
          itemId: clean(line.itemId),
          uomId: clean(line.uomId),
          quantity: String(line.quantity ?? 1),
          unitCost: String(line.unitCost ?? 0),
          batchNo: clean(line.batchNo),
          expiryDate: clean(line.expiryDate ?? line.expiryDateUtc).slice(0, 10),
          notes: clean(line.notes),
        }))
      : [createEmptyGrnLine()],
  };
}

export function useGrnDraftForm(scope: GrnScope | null, draftId?: string, itemMap?: Map<string, GrnItemVm>) {
  const [form, setForm] = useState<GrnForm>({
    receivingLocationId: "",
    receivedDate: todayLocalDate(),
    supplierName: "",
    notes: "",
    lines: [createEmptyGrnLine()],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!scope || !draftId) return;

    let alive = true;
    setLoadingDraft(true);
    setDraftError(null);

    grnApi
      .getById(scope, draftId)
      .then((dto) => {
        if (!alive) return;
        setForm(normalizeDraft(dto));
      })
      .catch((err) => {
        if (!alive) return;
        setDraftError(getApiErrorMessage(err, "Failed to load GRN draft."));
      })
      .finally(() => {
        if (alive) setLoadingDraft(false);
      });

    return () => {
      alive = false;
    };
  }, [draftId, scope]);

  const subtotal = useMemo(
    () =>
      form.lines.reduce((sum, line) => {
        const qty = parseDecimal(line.quantity);
        const cost = parseDecimal(line.unitCost);
        return Number.isFinite(qty) && Number.isFinite(cost) ? sum + qty * cost : sum;
      }, 0),
    [form.lines],
  );

  const patch = useCallback((value: Partial<GrnForm>) => {
    setForm((current) => ({ ...current, ...value }));
  }, []);

  const patchLine = useCallback((index: number, value: Partial<GrnLineForm>) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...value } : line)),
    }));
  }, []);

  const addLine = useCallback(() => {
    setForm((current) => ({ ...current, lines: [...current.lines, createEmptyGrnLine()] }));
  }, []);

  const removeLine = useCallback((index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.length <= 1 ? [createEmptyGrnLine()] : current.lines.filter((_, i) => i !== index),
    }));
  }, []);

  function expectedBaseUomIdForLine(line: GrnLineForm): string {
    return itemMap?.get(line.itemId)?.defaultUomId || "";
  }
  function toUtcIsoDate(value?: string | null): string | null {
  if (!value) return null;

  return new Date(`${value}T00:00:00Z`).toISOString();
}

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    const lineErrors: NonNullable<FormErrors["lineErrors"]> = {};

    if (!clean(form.receivingLocationId)) nextErrors.receivingLocationId = "Receiving location is required.";
    if (!clean(form.receivedDate)) nextErrors.receivedDate = "Received date is required.";
    if (!form.lines.length) nextErrors.lines = "At least one line is required.";

    form.lines.forEach((line, index) => {
      const lineError: LineErrors = {};
      const expectedUomId = expectedBaseUomIdForLine(line);

      if (!clean(line.itemId)) lineError.itemId = "Item is required.";
      if (!clean(line.uomId)) lineError.uomId = "UOM is required.";
      if (clean(line.itemId) && !expectedUomId) lineError.uomId = "Base/Purchasing UOM is not configured for this item.";
      if (expectedUomId && clean(line.uomId) && clean(line.uomId) !== expectedUomId) {
        lineError.uomId = "GRN must be received in the item's Base/Purchasing UOM.";
      }
      if (!isPositive(line.quantity)) lineError.quantity = "Quantity must be greater than zero.";
      if (!isNonNegative(line.unitCost)) lineError.unitCost = "Unit cost cannot be negative.";

      if (Object.keys(lineError).length) lineErrors[index] = lineError;
    });

    if (Object.keys(lineErrors).length) nextErrors.lineErrors = lineErrors;
    setErrors(nextErrors);
    return nextErrors;
  }

  function hasErrors(value: FormErrors): boolean {
    return Boolean(value.receivingLocationId || value.receivedDate || value.lines || Object.keys(value.lineErrors ?? {}).length);
  }

  function buildPayload(branchId?: string | null): CreateGrnDraftRequest {
    return {
      receivingLocationId: clean(form.receivingLocationId),
      branchId: clean(branchId),
      receivedDate: form.receivedDate,
      supplierName: nullable(form.supplierName),
      notes: nullable(form.notes),
      lines: form.lines.map((line) => ({
        itemId: clean(line.itemId),
        uomId: expectedBaseUomIdForLine(line) || clean(line.uomId),
        quantity: parseDecimal(line.quantity),
        unitCost: parseDecimal(line.unitCost),
        batchNo: nullable(line.batchNo),
        expiryDate: toUtcIsoDate(line.expiryDate) || null,
        notes: nullable(line.notes),
      })),
    };
  }

  return {
    form,
    setForm,
    patch,
    patchLine,
    addLine,
    removeLine,
    errors,
    setErrors,
    validate,
    hasErrors,
    buildPayload,
    subtotal,
    loadingDraft,
    draftError,
    expectedBaseUomIdForLine,
  };
}
