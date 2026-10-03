// src/features/production/api/productionBatchesApi.ts
//
// Production batch CRUD, recipe application, posting, and reversal.
// Base path: /companies/{companyId}/branches/{branchId}/production/batches
//
// C# ProductionBatchStatus enum:
//   Draft = 2 | Approved = 3 | Posted = 4 | Reversed = 5

import { http } from "../../../api/http";
import type { AxiosRequestConfig } from "axios";

//  DTOs 

export interface ProductionInputLineDto {
  id:            string;
  lineNo:        number;
  itemId:        string;
  uomId:         string;
  qty:           number;
  qtyBase:       number;
  unitCost:      number;
  lineAmount:    number;
  /** ProductionInputSource numeric enum - use normaliseSource() in components. */
  source:        number;
  recipeLineId?: string | null;
  batchNo?:      string | null;
  expiryDate?:   string | null;
  notes?:        string | null;
}

export interface ProductionOutputLineDto {
  id:          string;
  lineNo:      number;
  itemId:      string;
  itemName?:   string | null;
  uomId:       string;
  outputLocationId?: string | null;
  uomCode?:    string | null;
  uomName?:    string | null;
  qty:         number;
  qtyBase:     number;
  plannedQuantity?: number | null;
  actualQuantity?: number | null;
  portionSize?: number | null;
  portionUomId?: string | null;
  portionUomCode?: string | null;
  portionUomName?: string | null;
  outputWeightBase?: number | null;
  outputCategory?: string | null;
  isRemainingBulk?: boolean;
  isWaste?: boolean;
  isRework?: boolean;
  costAllocationMethod?: string | null;
  unitCost:    number;
  lineAmount:  number;
  batchNo?:    string | null;
  expiryDate?: string | null;
  notes?:      string | null;
}

export interface ProductionBatchDto {
  id:              string;
  companyId:       string;
  branchId:        string;
  menuItemId:      string;
  batchNo:         string;
  /** Numeric status - see C# ProductionBatchStatus enum. */
  status:          number;
  issueLocationId: string;
  outputLocationId:string;
  producedAtUtc:   string;
  plannedQty:      number;
  inputs:          ProductionInputLineDto[];
  outputs:         ProductionOutputLineDto[];
  recipeId?:       string | null;
  notes?:          string | null;
  postedAtUtc?:    string | null;
  postedBy?:       string | null;
  ledgerGroupId?:  string | null;
}

export interface ProductionBatchListItemDto {
  id:              string;
  companyId:       string;
  branchId:        string;
  menuItemId:      string;
  menuItemName:    string;
  batchNo:         string;
  status:          number;
  producedAtUtc:   string;
  plannedQty:      number;
  inputLineCount:  number;
  outputLineCount: number;
  totalInputCost:  number;
  outputUnitCost:  number;
  postedAtUtc?:    string | null;
  notes?:          string | null;
}

export interface ListProductionBatchesParams {
  status?: number | string | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
}

//  Requests 

export interface CreateProductionBatchRequest {
  menuItemId:       string;
  plannedQty:       number;
  issueLocationId:  string;
  outputLocationId: string;
  /** ISO 8601 datetime string - maps to C# DateTime ProducedAtUtc. */
  producedAtUtc:    string;
  notes?:           string | null;
}

type CreateProductionBatchResponse = string | { id?: string | null; batchId?: string | null };

export interface ProductionLineRequest {
  itemId:      string;
  uomId:       string;
  outputLocationId?: string | null;
  qty:         number;
  id?:         string | null;
  lineNo?:     number | null;
  plannedQuantity?: number | null;
  actualQuantity?: number | null;
  portionSize?: number | null;
  portionUomId?: string | null;
  outputWeightBase?: number | null;
  outputCategory?: string | null;
  isRemainingBulk?: boolean;
  isWaste?: boolean;
  isRework?: boolean;
  costAllocationMethod?: string | null;
  batchNo?:    string | null;
  expiryDate?: string | null;
  notes?:      string | null;
}

export interface UpdateProductionLinesRequest {
  issueLocationId?: string;
  outputLocationId?: string;
  inputs:  ProductionLineRequest[];
  outputs: ProductionLineRequest[];
}

/** RecipeId is the recipe entity ID - not the menuItemId. */
export interface ApplyRecipeRequest {
  recipeId:              string;
  outputQty:             number;
  replaceExistingInputs: boolean;
}

//  ApiError 

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title:  string,
    public readonly detail?: string,
    public readonly errors?: Record<string, string[]>
  ) {
    super(`[${status}] ${title}${detail ? `: ${detail}` : ""}`);
    this.name = "ApiError";
  }

  static fromAxios(e: unknown): ApiError {
    const err  = e as any;
    const data = err?.response?.data;
    return new ApiError(
      err?.response?.status ?? 0,
      data?.title ?? data?.message ?? err?.message ?? "Request failed",
      typeof data === "string" ? data : (data?.detail ?? undefined),
      data?.errors ?? undefined
    );
  }
}

//  Internal helpers 

function batchesPath(companyId: string, branchId: string): string {
  return `/companies/${companyId}/branches/${branchId}/production/batches`;
}

function batchPath(companyId: string, branchId: string, batchId: string): string {
  const id = String(batchId ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Production batch id is invalid. Refresh the batch and try again.");
  }
  return `${batchesPath(companyId, branchId)}/${encodeURIComponent(id)}`;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  params?: object
): Promise<T> {
  const cfg: AxiosRequestConfig = { signal, params };
  try {
    const res =
      method === "GET"    ? await http.get<T>(url, cfg) :
      method === "DELETE" ? await http.delete<T>(url, cfg) :
      method === "PUT"    ? await http.put<T>(url, body ?? {}, cfg) :
                            await http.post<T>(url, body ?? {}, cfg);
    return res.data;
  } catch (e) {
    throw ApiError.fromAxios(e);
  }
}

//  Full client 

export const productionBatchesApi = {
  list(companyId: string, branchId: string, params?: ListProductionBatchesParams, signal?: AbortSignal): Promise<ProductionBatchListItemDto[]> {
    return request("GET", batchesPath(companyId, branchId), undefined, signal, params);
  },

  async create(companyId: string, branchId: string, body: CreateProductionBatchRequest, signal?: AbortSignal): Promise<string> {
    const response = await request<CreateProductionBatchResponse>("POST", batchesPath(companyId, branchId), body, signal);
    const id = typeof response === "string" ? response : response?.id ?? response?.batchId ?? null;
    if (!id) throw new Error("Production batch was created, but the API did not return a batch id.");
    return id;
  },

  get(companyId: string, branchId: string, batchId: string, signal?: AbortSignal): Promise<ProductionBatchDto> {
    return request("GET", batchPath(companyId, branchId, batchId), undefined, signal);
  },

  updateLines(companyId: string, branchId: string, batchId: string, body: UpdateProductionLinesRequest, signal?: AbortSignal): Promise<void> {
    return request("PUT", `${batchPath(companyId, branchId, batchId)}/lines`, body, signal);
  },

  applyRecipe(companyId: string, branchId: string, batchId: string, body: ApplyRecipeRequest, signal?: AbortSignal): Promise<void> {
    return request("POST", `${batchPath(companyId, branchId, batchId)}/apply-recipe`, body, signal);
  },

  post(companyId: string, branchId: string, batchId: string, signal?: AbortSignal): Promise<void> {
    return request("POST", `${batchPath(companyId, branchId, batchId)}/post`, {}, signal);
  },

  reverse(companyId: string, branchId: string, batchId: string, reason?: string | null, signal?: AbortSignal): Promise<void> {
    return request("POST", `${batchPath(companyId, branchId, batchId)}/reverse`, { reason: reason ?? null }, signal);
  },
};

//  Scoped client (preferred at call sites) 

export function createScopedProductionBatchesApi(companyId: string, branchId: string) {
  return {
    list:        (params?: ListProductionBatchesParams, signal?: AbortSignal) => productionBatchesApi.list(companyId, branchId, params, signal),
    create:      (body: CreateProductionBatchRequest, signal?: AbortSignal)     => productionBatchesApi.create(companyId, branchId, body, signal),
    get:         (batchId: string, signal?: AbortSignal)                        => productionBatchesApi.get(companyId, branchId, batchId, signal),
    updateLines: (batchId: string, body: UpdateProductionLinesRequest, signal?: AbortSignal) => productionBatchesApi.updateLines(companyId, branchId, batchId, body, signal),
    applyRecipe: (batchId: string, body: ApplyRecipeRequest, signal?: AbortSignal)           => productionBatchesApi.applyRecipe(companyId, branchId, batchId, body, signal),
    post:        (batchId: string, signal?: AbortSignal)                        => productionBatchesApi.post(companyId, branchId, batchId, signal),
    reverse:     (batchId: string, reason?: string | null, signal?: AbortSignal) => productionBatchesApi.reverse(companyId, branchId, batchId, reason, signal),
  };
}

export type ScopedProductionBatchesApi = ReturnType<typeof createScopedProductionBatchesApi>;
