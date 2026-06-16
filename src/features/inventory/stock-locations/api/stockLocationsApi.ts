import { http } from "../../../../api/http";
import type {
  StockLocationDto,
  CreateStockLocationDto,
  UpdateStockLocationDto,
} from "../types";

const companyBase = (companyId: string) =>
  `/companies/${companyId}/stock-locations`;

const branchBase = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/stock-locations`;

function unwrapArray<T>(res: unknown): T[] {
  const d = res as Record<string, unknown>;
  const raw = d?.items ?? d?.data ?? d?.result ?? d;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export const stockLocationsApi = {
  async list(
    companyId: string,
    branchId?: string | null,
    kind?: string,
    signal?: AbortSignal,
  ): Promise<StockLocationDto[]> {
    const url = branchId
      ? branchBase(companyId, branchId)
      : companyBase(companyId);

    const res = await http.get(url, {
      params: kind ? { kind } : undefined,
      signal,
    });

    return unwrapArray<StockLocationDto>(res.data);
  },

  async listForCompany(
    companyId: string,
    kind?: string,
    signal?: AbortSignal,
  ): Promise<StockLocationDto[]> {
    const res = await http.get(companyBase(companyId), {
      params: kind ? { kind } : undefined,
      signal,
    });

    return unwrapArray<StockLocationDto>(res.data);
  },

  async listForBranch(
    companyId: string,
    branchId: string,
    kind?: string,
    signal?: AbortSignal,
  ): Promise<StockLocationDto[]> {
    const res = await http.get(branchBase(companyId, branchId), {
      params: kind ? { kind } : undefined,
      signal,
    });

    return unwrapArray<StockLocationDto>(res.data);
  },

  async getById(
    companyId: string,
    locationId: string,
    branchId?: string | null,
    signal?: AbortSignal,
  ): Promise<StockLocationDto> {
    const url = branchId
      ? `${branchBase(companyId, branchId)}/${locationId}`
      : `${companyBase(companyId)}/${locationId}`;

    const res = await http.get<StockLocationDto>(url, { signal });
    return res.data;
  },

  async create(
    companyId: string,
    branchId: string,
    dto: CreateStockLocationDto,
    signal?: AbortSignal,
  ): Promise<StockLocationDto> {
    const res = await http.post<StockLocationDto>(
      branchBase(companyId, branchId),
      dto,
      { signal },
    );

    return res.data;
  },

  async update(
    companyId: string,
    branchId: string,
    locationId: string,
    dto: UpdateStockLocationDto,
    signal?: AbortSignal,
  ): Promise<StockLocationDto> {
    const res = await http.put<StockLocationDto>(
      `${branchBase(companyId, branchId)}/${locationId}`,
      dto,
      { signal },
    );

    return res.data;
  },

  async setActive(
    companyId: string,
    branchId: string,
    locationId: string,
    isActive: boolean,
    currentDto: UpdateStockLocationDto,
    signal?: AbortSignal,
  ): Promise<StockLocationDto> {
    return stockLocationsApi.update(
      companyId,
      branchId,
      locationId,
      { ...currentDto, isActive },
      signal,
    );
  },

  async setIssueLocation(
    companyId: string,
    branchId: string,
    locationId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await http.put(
      `${branchBase(companyId, branchId)}/${locationId}/issue-location`,
      {},
      { signal },
    );
  },
};