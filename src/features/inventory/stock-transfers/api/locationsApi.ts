import { http } from "../../../../api/http";
import type {StockLocationDto} from "../types"

export type LocationLiteDto = {
  id: string;
  name: string;
  code?: string | null;
  branchName?: string | null; // optional if you have it
  active?: boolean;
};
function unwrap<T>(res: unknown): T {
  const d = res as Record<string, unknown>;
  if (d?.data   !== undefined) return d.data   as T;
  if (d?.result !== undefined) return d.result as T;
  if (d?.items  !== undefined) return d.items  as T;
  return res as T;
}

function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : "";
}
export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};
export const locationsApi = {
  async list2(companyId: string, branchId: string|null): Promise<StockLocationDto[]> {
            const res = await http.get(`/companies/${companyId}/branches/${branchId}/stock-locations`);
            return res.data ?? [];
  },
  async listLocations(
    companyId: string,
    branchId: string|null,
    signal?: AbortSignal
  ): Promise<StockLocationDto[]> {
    const res = await http.get(
      `/companies/${companyId}/branches/${branchId}/stock-locations${toQuery({ activeOnly: true })}`,
      { signal }
    );
    const raw = unwrap<PagedResult<StockLocationDto> | StockLocationDto[]>(res);
    return Array.isArray(raw) ? raw : (raw?.items ?? []);
  },
  
  async getStockLocations(
    companyId: string,
    branchId: string,
    signal?: AbortSignal
  ): Promise<StockLocationDto[]> {
    const res = await http.get(
      `/companies/${companyId}/branches/${branchId}/stock-locations${toQuery({ activeOnly: true })}`,
      { signal }
    );
    const raw = unwrap<PagedResult<StockLocationDto> | StockLocationDto[]>(res);
    return Array.isArray(raw) ? raw : (raw?.items ?? []);
  },
  
      
};
