import {http} from "../../../api/http"
import type {
  CreateInventoryAdjustmentDto,
  InventoryAdjustmentDetailDto,
  InventoryAdjustmentListDto,
  InventoryAdjustmentLineDto,
  PagedResult,
} from "../types"

export const inventoryAdjustmentsApi = {
  // List (optionally paged + search)
  list: async (params: {
    companyId: string;
    branchId?: string;
    status?: "DRAFT" | "POSTED" | "CANCELLED";
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<InventoryAdjustmentListDto>> => {
    const res = await http.get<PagedResult<InventoryAdjustmentListDto>>(
      "/inventory/adjustments",
      { params }
    );
    return res.data;
  },

  // Get detail
  getById: async (id: string): Promise<InventoryAdjustmentDetailDto> => {
    const res = await http.get<InventoryAdjustmentDetailDto>(
      `/inventory/adjustments/${id}`
    );
    return res.data;
  },

  // Create (Draft)
  create: async (dto: CreateInventoryAdjustmentDto): Promise<{ id: string }> => {
    const res = await http.post<{ id: string }>(
      "/inventory/adjustments",
      dto
    );
    return res.data;
  },

  // Update header (optional, if your backend supports)
  update: async (
    id: string,
    patch: { reason?: string; note?: string }
  ): Promise<void> => {
    await http.put(`/inventory/adjustments/${id}`, patch);
  },

  // Replace lines (optional, if your backend supports)
  setLines: async (id: string, lines: InventoryAdjustmentLineDto[]): Promise<void> => {
    await http.put(`/inventory/adjustments/${id}/lines`, { lines });
  },

  // Post (apply inventory + ledger + FIFO impacts)
  post: async (id: string): Promise<void> => {
    await http.post(`/inventory/adjustments/${id}/post`);
  },

  // Cancel / Reverse
  cancel: async (id: string, reason?: string): Promise<void> => {
    await http.post(`/inventory/adjustments/${id}/cancel`, { reason });
  },
};
