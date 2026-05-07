// src/features/inventory/adjustments/api/adjustmentApi.ts

import { http } from "../../../../api/http";

import type {
  InventoryAdjustmentDto,
  CreateAdjustmentFromSivDto,
  UpdateAdjustmentCountDto,
  AdjustmentActionDto,
  InventoryItemOption,
  ManualAdjustmentCreateDto,
} from "../types";

export type ListAdjustmentsParams = {
  branchId?: string;
  locationId?: string;
  status?: string;
};

const baseUrl = (companyId: string) =>
  `/companies/${companyId}/inventory-adjustments`;

const lookupBaseUrl = (companyId: string) =>
  `${baseUrl(companyId)}/lookups`;

function clean(params?: ListAdjustmentsParams) {
  return {
    ...(params?.branchId ? { branchId: params.branchId } : {}),
    ...(params?.locationId ? { locationId: params.locationId } : {}),
    ...(params?.status ? { status: params.status } : {}),
  };
}

export const adjustmentApi = {
  list: async (
    companyId: string,
    params?: ListAdjustmentsParams
  ): Promise<InventoryAdjustmentDto[]> => {
    const { data } = await http.get(baseUrl(companyId), {
      params: clean(params),
    });
    return Array.isArray(data) ? data : [];
  },
 fifoItems: async (
    companyId: string,
    params: { branchId: string; locationId: string; q?: string }
  ): Promise<InventoryItemOption[]> => {
    const { data } = await http.get(
      `${lookupBaseUrl(companyId)}/fifo-items`,
      { params }
    );
    return Array.isArray(data) ? data : [];
  },
  get: async (
    companyId: string,
    id: string
  ): Promise<InventoryAdjustmentDto> => {
    const { data } = await http.get(`${baseUrl(companyId)}/${id}`);
    return data;
  },

  createFromSiv: async (
    companyId: string,
    sivId: string,
    payload: CreateAdjustmentFromSivDto
  ): Promise<InventoryAdjustmentDto> => {
    const { data } = await http.post(
      `${baseUrl(companyId)}/from-siv/${sivId}`,
      payload
    );
    return data;
  },

  createManual: async (
    companyId: string,
    payload: ManualAdjustmentCreateDto
  ): Promise<InventoryAdjustmentDto> => {
    const { data } = await http.post(`${baseUrl(companyId)}/manual`, payload);
    return data;
  },

  updateDraftCount: async (
    companyId: string,
    id: string,
    payload: UpdateAdjustmentCountDto
  ): Promise<void> => {
    await http.put(`${baseUrl(companyId)}/${id}/draft-count`, payload);
  },

  submit: async (companyId: string, id: string): Promise<void> => {
    await http.post(`${baseUrl(companyId)}/${id}/submit`);
  },

  approve: async (companyId: string, id: string): Promise<void> => {
    await http.post(`${baseUrl(companyId)}/${id}/approve`);
  },

  post: async (companyId: string, id: string): Promise<void> => {
    await http.post(`${baseUrl(companyId)}/${id}/post`);
  },

  reverse: async (
    companyId: string,
    id: string,
    payload: AdjustmentActionDto
  ): Promise<void> => {
    await http.post(`${baseUrl(companyId)}/${id}/reverse`, payload);
  },
};