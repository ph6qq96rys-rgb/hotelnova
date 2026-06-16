import { http } from "../../../../api/http";
import type { ItemUomDto } from "../../../inventoryMaster/items/types";
import type {
  CreateGrnDraftRequest,
  GrnDetailDto,
  GrnListDto,
  ReverseGrnRequest,
} from "../types/grn.types";

export type GrnStatus = "DRAFT" | "POSTED" | "REVERSED" | "CANCELLED" | "ALL";

export type GrnScope =
  | string
  | {
      companyId: string;
      branchId?: string | null;
    };

export interface GrnListParams {
  status?: GrnStatus;
  from?: string | Date | null;
  to?: string | Date | null;
  q?: string | null;
}

type ApiEnvelope<T> = {
  data?: T;
  result?: T;
  items?: T;
};

type PagedResult<T> = {
  items?: T[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
};

export type GrnIdentityResult = {
  id?: string;
  grnId?: string;
  draftId?: string;
};

function unwrap<T>(payload: unknown): T {
  const value = payload as ApiEnvelope<T> | null | undefined;

  if (value?.data !== undefined) return value.data;
  if (value?.result !== undefined) return value.result;
  if (value?.items !== undefined) return value.items;

  return payload as T;
}

function unwrapArray<T>(payload: unknown): T[] {
  const value = unwrap<T[] | PagedResult<T>>(payload);

  if (Array.isArray(value)) return value;
  if (value && Array.isArray((value as PagedResult<T>).items)) {
    return (value as PagedResult<T>).items ?? [];
  }

  return [];
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanNullable(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned.length ? cleaned : null;
}

function assertRequired(value: unknown, label: string): string {
  const cleaned = cleanText(value);

  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }

  return cleaned;
}

function assertPositiveNumber(value: unknown, label: string): number {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return number;
}

function assertNonNegativeNumber(value: unknown, label: string): number {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return number;
}

function toIso(value?: string | Date | null): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const cleaned = value.trim();
  return cleaned.length ? cleaned : undefined;
}

function cleanParams(params: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value.trim().length > 0,
    ),
  );
}

function resolveScope(scope: GrnScope): { companyId: string; branchId?: string | null } {
  if (typeof scope === "string") {
    return {
      companyId: assertRequired(scope, "Company"),
    };
  }

  return {
    companyId: assertRequired(scope.companyId, "Company"),
    branchId: cleanNullable(scope.branchId),
  };
}

function base(scope: GrnScope): string {
  const resolved = resolveScope(scope);
  const companyId = encodeURIComponent(resolved.companyId);

  if (resolved.branchId) {
    return `/companies/${companyId}/branches/${encodeURIComponent(
      resolved.branchId,
    )}/grns`;
  }

  return `/companies/${companyId}/grns`;
}

function inventoryItemBase(scope: GrnScope): string {
  const resolved = resolveScope(scope);
  const companyId = encodeURIComponent(resolved.companyId);

  if (resolved.branchId) {
    return `/companies/${companyId}/branches/${encodeURIComponent(
      resolved.branchId,
    )}/inventory-master/items`;
  }

  return `/companies/${companyId}/inventory-master/items`;
}

function validateReverseRequest(body: ReverseGrnRequest): ReverseGrnRequest {
  return {
    ...body,
    reason: assertRequired(body.reason, "Reversal reason"),
  };
}

function validateDraftRequest(body: CreateGrnDraftRequest): CreateGrnDraftRequest {
  const receivingLocationId = assertRequired(
    body.receivingLocationId,
    "Receiving location",
  );

  const receivedDate = assertRequired(body.receivedDate, "Received date");

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw new Error("At least one GRN line is required.");
  }

  return {
    ...body,
    receivingLocationId,
    receivedDate,
    supplierName: cleanText(body.supplierName),
    notes: cleanNullable(body.notes),
    lines: body.lines.map((line, index) => {
      const lineNo = index + 1;

      return {
        ...line,
        itemId: assertRequired(line.itemId, `Line ${lineNo} item`),
        uomId: assertRequired(line.uomId, `Line ${lineNo} UOM`),
        quantity: assertPositiveNumber(line.quantity, `Line ${lineNo} quantity`),
        unitCost: assertNonNegativeNumber(
          line.unitCost,
          `Line ${lineNo} unit cost`,
        ),
        batchNo: cleanNullable(line.batchNo),
        expiryDate: cleanNullable(line.expiryDate),
        notes: cleanNullable(line.notes),
      };
    }),
  };
}

export const grnApi = {
  async list(scope: GrnScope, params?: GrnListParams): Promise<GrnListDto[]> {
    const response = await http.get(base(scope), {
      params: cleanParams({
        status:
          params?.status && params.status !== "ALL"
            ? String(params.status)
            : undefined,
        from: toIso(params?.from),
        to: toIso(params?.to),
        q: params?.q?.trim() || undefined,
      }),
    });

    return unwrapArray<GrnListDto>(response.data);
  },

  async getById(scope: GrnScope, grnId: string): Promise<GrnDetailDto> {
    const id = assertRequired(grnId, "GRN id");

    const response = await http.get(`${base(scope)}/${encodeURIComponent(id)}`);

    return unwrap<GrnDetailDto>(response.data);
  },

  async createDraft(
    scope: GrnScope,
    body: CreateGrnDraftRequest,
  ): Promise<GrnDetailDto & GrnIdentityResult> {
    const response = await http.post(base(scope), validateDraftRequest(body));

    return unwrap<GrnDetailDto & GrnIdentityResult>(response.data);
  },

  async updateDraft(
    scope: GrnScope,
    draftId: string,
    body: CreateGrnDraftRequest,
  ): Promise<GrnDetailDto & GrnIdentityResult> {
    const id = assertRequired(draftId, "Draft id");

    const response = await http.put(
      `${base(scope)}/${encodeURIComponent(id)}`,
      validateDraftRequest(body),
    );

    return unwrap<GrnDetailDto & GrnIdentityResult>(response.data);
  },

  async postDraft(
    scope: GrnScope,
    draftId: string,
  ): Promise<GrnDetailDto & GrnIdentityResult> {
    const id = assertRequired(draftId, "Draft id");

    const response = await http.post(
      `${base(scope)}/${encodeURIComponent(id)}/post`,
      {},
    );

    return unwrap<GrnDetailDto & GrnIdentityResult>(response.data);
  },

  async reverseById(
    scope: GrnScope,
    grnId: string,
    body: ReverseGrnRequest,
  ): Promise<void> {
    const id = assertRequired(grnId, "GRN id");

    await http.post(
      `${base(scope)}/${encodeURIComponent(id)}/reverse`,
      validateReverseRequest(body),
    );
  },

  async reverseByBatch(
    scope: GrnScope,
    batchNo: string,
    body: ReverseGrnRequest,
  ): Promise<void> {
    const batch = assertRequired(batchNo, "Batch number");

    await http.post(
      `${base(scope)}/reverse-by-batch/${encodeURIComponent(batch)}`,
      validateReverseRequest(body),
    );
  },

  async findByNumber(scope: GrnScope, grnNumber: string): Promise<GrnListDto | null> {
    const q = grnNumber.trim();
    if (!q) return null;

    const rows = await grnApi.list(scope, {
      q,
      status: "ALL",
    });

    return (
      rows.find(
        (row) =>
          String(row.grnNumber ?? "").trim().toLowerCase() === q.toLowerCase(),
      ) ??
      rows[0] ??
      null
    );
  },

  async getItemUoms(scope: GrnScope, itemId: string): Promise<ItemUomDto[]> {
    const id = assertRequired(itemId, "Item id");

    const response = await http.get(
      `${inventoryItemBase(scope)}/${encodeURIComponent(id)}/uoms`,
    );

    return unwrapArray<ItemUomDto>(response.data);
  },
};