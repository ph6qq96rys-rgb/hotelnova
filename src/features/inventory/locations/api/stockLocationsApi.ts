import { http } from "../../../../api/http";
import type {
  StockLocationDto,
  StockLocationFilter,
  CreateStockLocationDto,
  UpdateStockLocationDto
} from "../types";

const base = import.meta.env.VITE_API_BASE_URL ?? "";

/*
 * Build query string safely
 */
function qs(filter: StockLocationFilter): string {
  const params = new URLSearchParams();

  if (filter.companyId) params.set("companyId", filter.companyId);
  if (filter.branchId) params.set("branchId", filter.branchId);
  if (filter.q) params.set("q", filter.q);

  const query = params.toString();
  return query ? `?${query}` : "";
}

/*
 * API: Stock Locations
 *
 * Expected endpoints:
 *  GET    /api/inventory/stock-locations?companyId=&branchId=&q=
 *  POST   /api/inventory/stock-locations
 *  PUT    /api/inventory/stock-locations/{id}
 *  PUT    /api/inventory/stock-locations/{id}/active   body: { isActive: boolean }
 */
export const stockLocationsApi = {
  /**
   * List stock locations
   */
  list: (filter: StockLocationFilter) =>
    http<StockLocationDto[]>(
      `${base}/inventory/stock-locations${qs(filter)}`
    ),

  /**
   * Create stock location
   */
  create: (dto: CreateStockLocationDto) =>
    http<StockLocationDto>(
      `${base}/inventory/stock-locations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: dto
      }
    ),

  /**
   * Update stock location
   */
  update: (id: string, dto: UpdateStockLocationDto) =>
    http<StockLocationDto>(
      `${base}/inventory/stock-locations/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        data: dto
      }
    ),

  /**
   * Activate / Deactivate stock location
   */
  setActive: (id: string, isActive: boolean) =>
    http<void>(
      `${base}/inventory/stock-locations/${id}/active`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        data:  isActive 
      }
    ),
    
};
