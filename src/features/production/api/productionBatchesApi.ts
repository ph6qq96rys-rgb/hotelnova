// =============================================================================
// Production Batches API Client
// Mirrors: api/companies/{companyId}/branches/{branchId}/production/batches
//
// Uses the shared axios `http` instance so base-URL, auth headers, and
// interceptors are applied consistently with the rest of the app — avoiding
// the mismatch that caused "[FromBody] req is required" when fetch sent
// requests to a different origin than the axios instance.
// =============================================================================

import { http } from "../../../api/http";
import type { AxiosRequestConfig } from "axios";

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ProductionInputLineDto {
  id?: string | null;
  lineNo?: number | null;
  itemId?: string | null;
  itemName?: string | null;
  uomId?: string | null;
  uomName?: string | null;
  qty?: number | null;
  qtyBase?: number | null;
  source?: string | null;
  recipeLineId?: string | null;
}

export interface ProductionBatchDto {
  id: string;
  companyId: string;
  branchId: string;
  batchNo?: string | null;
  status: "Draft" | "Posted" | "Reversed";
  menuItemId?: string | null;
  plannedQty?: number | null;
  issueLocationId?: string | null;
  outputLocationId?: string | null;
  inputs?: ProductionInputLineDto[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateProductionBatchRequest {
  menuItemId: string;       // Guid string
  plannedQty: number;
  issueLocationId: string;  // Guid string
  outputLocationId: string; // Guid string
}

export interface UpdateProductionLinesRequest {
  inputs: {
    lineNo: number;
    itemId: string;
    qty: number;
    uomId?: string | null;
    source?: string | null;
    recipeLineId?: string | null;
  }[];
}

export interface ApplyRecipeRequest {
  menuItemId: string;
  plannedQty: number;
}

// ── API Error ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
    public readonly errors?: Record<string, string[]>
  ) {
    super(`[${status}] ${title}${detail ? `: ${detail}` : ""}`);
    this.name = "ApiError";
  }

  static fromAxios(e: unknown): ApiError {
    const err  = e as any;
    const res  = err?.response;
    const data = res?.data;

    const status = res?.status ?? 0;
    const title  =
      data?.title   ??
      data?.message ??
      err?.message  ??
      "Request failed";
    const detail = typeof data === "string" ? data : (data?.detail ?? undefined);
    const errors = data?.errors ?? undefined;

    return new ApiError(status, title, detail, errors);
  }
}

// ── Path helpers ──────────────────────────────────────────────────────────────

function batchesPath(companyId: string, branchId: string): string {
  return `/companies/${companyId}/branches/${branchId}/production/batches`;
}

function batchPath(companyId: string, branchId: string, batchId: string): string {
  return `${batchesPath(companyId, branchId)}/${batchId}`;
}

// ── Core request wrapper ──────────────────────────────────────────────────────

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  opts: { body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const config: AxiosRequestConfig = { signal: opts.signal };

  try {
    let res;
    if (method === "GET") {
      res = await http.get<T>(url, config);
    } else if (method === "DELETE") {
      res = await http.delete<T>(url, config);
    } else if (method === "PUT") {
      res = await http.put<T>(url, opts.body ?? {}, config);
    } else {
      // POST — always pass a body object so Content-Type: application/json
      // is sent and ASP.NET Core [FromBody] can bind the model.
      res = await http.post<T>(url, opts.body ?? {}, config);
    }
    return res.data;
  } catch (e) {
    throw ApiError.fromAxios(e);
  }
}

// ── Full client ───────────────────────────────────────────────────────────────

export const productionBatchesApi = {
  create(
    companyId: string,
    branchId: string,
    body: CreateProductionBatchRequest,
    signal?: AbortSignal
  ): Promise<string> {
    return request<string>("POST", batchesPath(companyId, branchId), { body, signal });
  },

  get(
    companyId: string,
    branchId: string,
    batchId: string,
    signal?: AbortSignal
  ): Promise<ProductionBatchDto> {
    return request<ProductionBatchDto>(
      "GET",
      batchPath(companyId, branchId, batchId),
      { signal }
    );
  },

  updateLines(
    companyId: string,
    branchId: string,
    batchId: string,
    body: UpdateProductionLinesRequest,
    signal?: AbortSignal
  ): Promise<void> {
    return request<void>(
      "PUT",
      `${batchPath(companyId, branchId, batchId)}/lines`,
      { body, signal }
    );
  },

  applyRecipe(
    companyId: string,
    branchId: string,
    batchId: string,
    body: ApplyRecipeRequest,
    signal?: AbortSignal
  ): Promise<void> {
    return request<void>(
      "POST",
      `${batchPath(companyId, branchId, batchId)}/apply-recipe`,
      { body, signal }
    );
  },

  post(
    companyId: string,
    branchId: string,
    batchId: string,
    signal?: AbortSignal
  ): Promise<void> {
    return request<void>(
      "POST",
      `${batchPath(companyId, branchId, batchId)}/post`,
      { body: {}, signal }   // empty body — POST with no body fails [FromBody]
    );
  },

  reverse(
    companyId: string,
    branchId: string,
    batchId: string,
    signal?: AbortSignal
  ): Promise<void> {
    return request<void>(
      "POST",
      `${batchPath(companyId, branchId, batchId)}/reverse`,
      { body: {}, signal }
    );
  },
};

// ── Scoped client ─────────────────────────────────────────────────────────────

export function createScopedProductionBatchesApi(companyId: string, branchId: string) {
  return {
    create: (body: CreateProductionBatchRequest, signal?: AbortSignal) =>
      productionBatchesApi.create(companyId, branchId, body, signal),

    get: (batchId: string, signal?: AbortSignal) =>
      productionBatchesApi.get(companyId, branchId, batchId, signal),

    updateLines: (batchId: string, body: UpdateProductionLinesRequest, signal?: AbortSignal) =>
      productionBatchesApi.updateLines(companyId, branchId, batchId, body, signal),

    applyRecipe: (batchId: string, body: ApplyRecipeRequest, signal?: AbortSignal) =>
      productionBatchesApi.applyRecipe(companyId, branchId, batchId, body, signal),

    post: (batchId: string, signal?: AbortSignal) =>
      productionBatchesApi.post(companyId, branchId, batchId, signal),

    reverse: (batchId: string, signal?: AbortSignal) =>
      productionBatchesApi.reverse(companyId, branchId, batchId, signal),
  };
}

export type ScopedProductionBatchesApi = ReturnType<typeof createScopedProductionBatchesApi>;