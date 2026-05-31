import { http } from "../../../../api/http";
import type {
  StockLocationDto,
  CreateStockLocationDto,
  UpdateStockLocationDto,
} from "../types";

// All routes mirror BranchLocationsController:
// api/companies/{companyId}/branches/{branchId}/stock-locations[/{locationId}]

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/stock-locations`;

function unwrapArray<T>(res: unknown): T[] {
  const d = res as Record<string, unknown>;
  // Handles PagedResult<T> envelope ({ items, totalCount, ... }) and bare arrays.
  const raw = d?.items ?? d?.data ?? d?.result ?? d;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export const stockLocationsApi = {

  // ── List ──────────────────────────────────────────────────────────────────
  // FIX: `list` and `listForBranch` were duplicates hitting the same endpoint.
  // Merged into one. Optional `kind` filter preserved from listForBranch.
  // FIX: backend returns PagedResult<StockLocationDto>; unwrapArray extracts items.

  async list(
    companyId: string,
    branchId: string,
    kind?: string,
    signal?: AbortSignal
  ): Promise<StockLocationDto[]> {
    const res = await http.get(base(companyId, branchId), {
      params: kind ? { kind } : undefined,
      signal,
    });
    return unwrapArray<StockLocationDto>(res.data);
  },

  // ── Get by id ─────────────────────────────────────────────────────────────

  async getById(
    companyId: string,
    branchId: string,
    locationId: string,
    signal?: AbortSignal
  ): Promise<StockLocationDto> {
    const res = await http.get<StockLocationDto>(
      `${base(companyId, branchId)}/${locationId}`,
      { signal }
    );
    return res.data;
  },

  // ── Create ────────────────────────────────────────────────────────────────
  // FIX: was `/inventory/stock-locations` — wrong prefix, no companyId/branchId.
  // Route: POST /companies/{cId}/branches/{bId}/stock-locations

  async create(
    companyId: string,
    branchId: string,
    dto: CreateStockLocationDto,
    signal?: AbortSignal
  ): Promise<StockLocationDto> {
    const res = await http.post<StockLocationDto>(
      base(companyId, branchId),
      dto,
      { signal }
    );
    return res.data;
  },

  // ── Update ────────────────────────────────────────────────────────────────
  // FIX: was `/inventory/stock-locations/{id}` — wrong prefix, no companyId/branchId.
  // Route: PUT /companies/{cId}/branches/{bId}/stock-locations/{locationId}

  async update(
    companyId: string,
    branchId: string,
    locationId: string,
    dto: UpdateStockLocationDto,
    signal?: AbortSignal
  ): Promise<StockLocationDto> {
    const res = await http.put<StockLocationDto>(
      `${base(companyId, branchId)}/${locationId}`,
      dto,
      { signal }
    );
    return res.data;
  },

  // ── Set active ────────────────────────────────────────────────────────────
  // FIX: was `/inventory/stock-locations/{id}/active` — no such backend route.
  // Active status is a field on UpdateStockLocationDto; use the update endpoint.

  async setActive(
    companyId: string,
    branchId: string,
    locationId: string,
    isActive: boolean,
    currentDto: UpdateStockLocationDto,
    signal?: AbortSignal
  ): Promise<StockLocationDto> {
    return stockLocationsApi.update(
      companyId,
      branchId,
      locationId,
      { ...currentDto, isActive },
      signal
    );
  },

  // ── Set issue location ────────────────────────────────────────────────────
  // Route: PUT /companies/{cId}/branches/{bId}/stock-locations/{locationId}/issue-location

  async setIssueLocation(
    companyId: string,
    branchId: string,
    locationId: string,
    signal?: AbortSignal
  ): Promise<void> {
    await http.put(
      `${base(companyId, branchId)}/${locationId}/issue-location`,
      {},
      { signal }
    );
  },
};