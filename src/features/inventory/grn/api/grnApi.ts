import { http } from "../../../../api/http";
import type { ItemUomDto } from "../../../inventoryMaster/items/types";
import type {
  CreateGrnDraftRequest,
  GrnDetailDto,
  GrnListDto,
  ReverseGrnRequest,
} from "../types/grn.types";

import {GrnStatus,GrnStatusFilter} from "../helpers/grn.status";

export type GrnScope =
  | string
  | {
      companyId: string;
      branchId?: string | null;
    };

export interface GrnListParams {
  status?: GrnStatusFilter;
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

type DraftRequestWithBranch = CreateGrnDraftRequest & {
  branchId?: string | null;
  receivingBranchId?: string | null;
};

function unwrap<T>(payload: unknown): T {
  const envelope = payload as ApiEnvelope<T> | null | undefined;

  if (envelope?.data !== undefined) return envelope.data;
  if (envelope?.result !== undefined) return envelope.result;
  if (envelope?.items !== undefined) return envelope.items;

  return payload as T;
}

function unwrapArray<T>(payload: unknown): T[] {
  const value = unwrap<T[] | PagedResult<T>>(payload);

  if (Array.isArray(value)) return value;

  if (value && typeof value === "object") {
    const paged = value as PagedResult<T>;
    if (Array.isArray(paged.items)) return paged.items;
  }

  return [];
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanNullable(value: unknown): string | null {
  const text = cleanText(value);
  return text.length > 0 ? text : null;
}

function requireText(value: unknown, label: string): string {
  const text = cleanText(value);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function requirePositiveNumber(value: unknown, label: string): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return numeric;
}

function requireNonNegativeNumber(value: unknown, label: string): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return numeric;
}

function toDateParam(value?: string | Date | null): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const text = value.trim();
  return text ? text : undefined;
}

function cleanParams<T extends object>(params: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    }),
  );
}

function resolveScope(scope: GrnScope): { companyId: string; branchId: string | null } {
  if (typeof scope === "string") {
    return {
      companyId: requireText(scope, "Company"),
      branchId: null,
    };
  }

  return {
    companyId: requireText(scope.companyId, "Company"),
    branchId: cleanNullable(scope.branchId),
  };
}

function grnBase(scope: GrnScope): string {
  const { companyId } = resolveScope(scope);
  const encodedCompanyId = encodeURIComponent(companyId);

  return `/companies/${encodedCompanyId}/grns`;
}

function inventoryItemBase(scope: GrnScope): string {
  const { companyId, branchId } = resolveScope(scope);
  const encodedCompanyId = encodeURIComponent(companyId);

  if (branchId) {
    return `/companies/${encodedCompanyId}/branches/${encodeURIComponent(
      branchId,
    )}/inventory-master/items`;
  }

  return `/companies/${encodedCompanyId}/inventory-master/items`;
}

function validateReverseRequest(body: ReverseGrnRequest): ReverseGrnRequest {
  return {
    ...body,
    reason: requireText(body.reason, "Reversal reason"),
  };
}

function validateDraftRequest(
  scope: GrnScope,
  body: DraftRequestWithBranch,
): DraftRequestWithBranch {
  resolveScope(scope);
  const receivingLocationId = requireText(body.receivingLocationId, "Receiving warehouse");
  const receivedDate = requireText(body.receivedDate, "Received date");

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw new Error("Add at least one item before saving the goods receipt.");
  }

  return {
    ...body,
    branchId: null,
    receivingBranchId: null,
    receivingLocationId,
    receivedDate,
    supplierName: cleanNullable(body.supplierName),
    notes: cleanNullable(body.notes),
    lines: body.lines.map((line, index) => {
      const lineNo = index + 1;

      return {
        ...line,
        itemId: requireText(line.itemId, `Line ${lineNo} item`),
        uomId: requireText(line.uomId, `Line ${lineNo} UOM`),
        quantity: requirePositiveNumber(line.quantity, `Line ${lineNo} quantity`),
        unitCost: requireNonNegativeNumber(line.unitCost, `Line ${lineNo} unit cost`),
        batchNo: cleanNullable(line.batchNo),
        expiryDate: cleanNullable(line.expiryDate),
        notes: cleanNullable(line.notes),
      };
    }),
  };
}

export const grnApi = {
  async list(scope: GrnScope, params: GrnListParams = {}): Promise<GrnListDto[]> {
    const response = await http.get(grnBase(scope), {
      params: cleanParams({
        status: params.status && params.status !== "ALL" ? params.status : undefined,
        from: toDateParam(params.from),
        to: toDateParam(params.to),
        q: params.q,
      }),
    });

    return unwrapArray<GrnListDto>(response);
  },

  async getById(scope: GrnScope, grnId: string): Promise<GrnDetailDto> {
    const id = requireText(grnId, "GRN id");
    const response = await http.get(`${grnBase(scope)}/${encodeURIComponent(id)}`);

    return unwrap<GrnDetailDto>(response);
  },

  async createDraft(
    scope: GrnScope,
    body: DraftRequestWithBranch,
  ): Promise<GrnDetailDto & GrnIdentityResult> {
    const response = await http.post(grnBase(scope), validateDraftRequest(scope, body));

    return unwrap<GrnDetailDto & GrnIdentityResult>(response);
  },

  async updateDraft(
    scope: GrnScope,
    draftId: string,
    body: DraftRequestWithBranch,
  ): Promise<GrnDetailDto & GrnIdentityResult> {
    const id = requireText(draftId, "Draft id");

    const response = await http.put(
      `${grnBase(scope)}/${encodeURIComponent(id)}`,
      validateDraftRequest(scope, body),
    );

    return unwrap<GrnDetailDto & GrnIdentityResult>(response);
  },

  async postDraft(
    scope: GrnScope,
    draftId: string,
  ): Promise<GrnDetailDto & GrnIdentityResult> {
    const id = requireText(draftId, "Draft id");
    const response = await http.post(`${grnBase(scope)}/${encodeURIComponent(id)}/post`, {});

    return unwrap<GrnDetailDto & GrnIdentityResult>(response);
  },

  // Backward-compatible alias for pages/components that still call grnApi.post(...).
  async post(scope: GrnScope, grnId: string): Promise<GrnDetailDto & GrnIdentityResult> {
    return this.postDraft(scope, grnId);
  },

  async reverseById(
    scope: GrnScope,
    grnId: string,
    body: ReverseGrnRequest,
  ): Promise<void> {
    const id = requireText(grnId, "GRN id");

    await http.post(
      `${grnBase(scope)}/${encodeURIComponent(id)}/reverse`,
      validateReverseRequest(body),
    );
  },

  async findByNumber(scope: GrnScope, grnNumber: string): Promise<GrnListDto | null> {
    const q = cleanText(grnNumber);
    if (!q) return null;

    const rows = await grnApi.list(scope, {
      q,
      status: "ALL",
    });

    return (
      rows.find(
        (row) =>
          cleanText(row.grnNumber ?? row.grnNo).toLowerCase() === q.toLowerCase(),
      ) ??
      rows[0] ??
      null
    );
  },

  async requestReversal(
  scope: GrnScope,
  grnId: string,
  body: ReverseGrnRequest,
): Promise<void> {
  const id = requireText(grnId, "GRN id");

  await http.post(
    `${grnBase(scope)}/${encodeURIComponent(id)}/request-reversal`,
    validateReverseRequest(body),
  );
},

async approveReversal(scope: GrnScope, grnId: string): Promise<void> {
  const id = requireText(grnId, "GRN id");

  await http.post(
    `${grnBase(scope)}/${encodeURIComponent(id)}/approve-reversal`,
    {},
  );
},

async rejectReversal(
  scope: GrnScope,
  grnId: string,
  body: { reason?: string | null },
): Promise<void> {
  const id = requireText(grnId, "GRN id");

  await http.post(
    `${grnBase(scope)}/${encodeURIComponent(id)}/reject-reversal`,
    {
      reason: cleanNullable(body.reason),
    },
  );
},

  async getItemUoms(scope: GrnScope, itemId: string): Promise<ItemUomDto[]> {
    const id = requireText(itemId, "Item id");

    const response = await http.get(
      `${inventoryItemBase(scope)}/${encodeURIComponent(id)}/uoms`,
    );

    return unwrapArray<ItemUomDto>(response);
  },
};

export type { GrnStatus, GrnStatusFilter };
