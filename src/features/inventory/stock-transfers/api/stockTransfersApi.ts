// src/features/inventory/stock-transfers/api/stockTransfersApi.ts

import { http } from "../../../../api/http";
import type {
  CreateStockTransferRequest,
  StockTransferDetailDto,
  StockTransferListDto,
  StockTransferStatus,
  UpdateStockTransferRequest,
} from "../types";
import { unwrapArray } from "../utils/apiUtils";
import { normalizeItemLookup, normalizeUom } from "../mapping/stockTransferMappers";

export type ItemLookupDto = {
  id: string;
  code?: string | null;
  sku?: string | null;
  name?: string | null;
  label?: string | null;
  defaultUomId?: string | null;
  baseUomId?: string | null;
  uoms?: Array<{
    uomId: string;
    code?: string | null;
    name?: string | null;
  }>;
};

export type UomLookupDto = {
  id: string;
  code?: string | null;
  name?: string | null;
  label: string;
};

type WorkflowReason = {
  reason?: string | null;
  note?: string | null;
};

function path(value: string): string {
  return encodeURIComponent(value.trim());
}

const root = (companyId: string, branchId: string) =>
  `/companies/${path(companyId)}/branches/${path(branchId)}/stock-transfers`;

const inventoryMaster = (companyId: string) =>
  `/companies/${path(companyId)}/inventory-master`;

function isItemLookupDto(value: ItemLookupDto | null): value is ItemLookupDto {
  return Boolean(value?.id);
}

function toUomLookupDto(value: ReturnType<typeof normalizeUom>): UomLookupDto | null {
  if (!value?.id) return null;

  return {
    id: value.id,
    code: value.code ?? null,
    name: value.name ?? null,
    label: value.label,
  };
}

function isUomLookupDto(value: UomLookupDto | null): value is UomLookupDto {
  return Boolean(value?.id);
}

export const stockTransfersApi = {
  catalog: {
    async items(companyId: string): Promise<ItemLookupDto[]> {
      const response = await http.get(`${inventoryMaster(companyId)}/items`);

      return unwrapArray<unknown>(response)
        .map(normalizeItemLookup)
        .filter(isItemLookupDto);
    },

    async uoms(companyId: string): Promise<UomLookupDto[]> {
      const response = await http.get(`${inventoryMaster(companyId)}/uoms`);

      return unwrapArray<unknown>(response)
        .map(normalizeUom)
        .map(toUomLookupDto)
        .filter(isUomLookupDto);
    },
  },

  documents: {
    async list(
      companyId: string,
      branchId: string,
      status?: StockTransferStatus | null
    ): Promise<StockTransferListDto[]> {
      const response = await http.get(root(companyId, branchId), {
        params: { status: status ?? undefined },
      });

      return unwrapArray<StockTransferListDto>(response);
    },

    async get(
      companyId: string,
      branchId: string,
      id: string
    ): Promise<StockTransferDetailDto> {
      const response = await http.get<StockTransferDetailDto>(
        `${root(companyId, branchId)}/${path(id)}`
      );

      return response.data;
    },

    async create(
      companyId: string,
      branchId: string,
      body: CreateStockTransferRequest
    ): Promise<string> {
      const response = await http.post<string>(root(companyId, branchId), body);
      return response.data;
    },

    async update(
      companyId: string,
      branchId: string,
      id: string,
      body: UpdateStockTransferRequest
    ): Promise<void> {
      await http.put(`${root(companyId, branchId)}/${path(id)}`, body);
    },
  },

  workflow: {
    async submit(companyId: string, branchId: string, id: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/submit`, {});
    },

    async approve(companyId: string, branchId: string, id: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/approve`, {});
    },

    async reject(
      companyId: string,
      branchId: string,
      id: string,
      reason: string
    ): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/reject`, {
        reason,
      });
    },

    async post(companyId: string, branchId: string, id: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/post`, {});
    },

    async cancel(
      companyId: string,
      branchId: string,
      id: string,
      reason?: string | null
    ): Promise<void> {
      const body: WorkflowReason = { reason: reason ?? null };
      await http.post(`${root(companyId, branchId)}/${path(id)}/cancel`, body);
    },
  },

  list: (
    companyId: string,
    branchId: string,
    status?: StockTransferStatus | null
  ) => stockTransfersApi.documents.list(companyId, branchId, status),

  get: (companyId: string, branchId: string, id: string) =>
    stockTransfersApi.documents.get(companyId, branchId, id),

  create: (
    companyId: string,
    branchId: string,
    body: CreateStockTransferRequest
  ) => stockTransfersApi.documents.create(companyId, branchId, body),

  update: (
    companyId: string,
    branchId: string,
    id: string,
    body: UpdateStockTransferRequest
  ) => stockTransfersApi.documents.update(companyId, branchId, id, body),

  submit: (companyId: string, branchId: string, id: string) =>
    stockTransfersApi.workflow.submit(companyId, branchId, id),

  approve: (companyId: string, branchId: string, id: string) =>
    stockTransfersApi.workflow.approve(companyId, branchId, id),

  reject: (companyId: string, branchId: string, id: string, reason: string) =>
    stockTransfersApi.workflow.reject(companyId, branchId, id, reason),

  post: (companyId: string, branchId: string, id: string) =>
    stockTransfersApi.workflow.post(companyId, branchId, id),

  cancel: (companyId: string, branchId: string, id: string, reason?: string) =>
    stockTransfersApi.workflow.cancel(companyId, branchId, id, reason),

  listItems: (companyId: string) => stockTransfersApi.catalog.items(companyId),
  listUoms: (companyId: string) => stockTransfersApi.catalog.uoms(companyId),
};