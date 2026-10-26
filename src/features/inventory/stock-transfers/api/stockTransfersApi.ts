// src/features/inventory/stock-transfers/api/stockTransfersApi.ts
//
// Stock transfers move stock from a location of this branch to a location of this or another branch.
// The route branch is the user's working branch: the sending branch for every action
// except `receive`, which the receiving branch calls.

import { http } from "../../../../api/http";
import type {
  CreateStockTransferRequest,
  StockTransferAvailableItemDto,
  ReceiveStockTransferRequest,
  StockTransferDetailDto,
  StockTransferDirection,
  StockTransferDocumentDto,
  StockTransferFormValues,
  StockTransferListRowDto,
  StockTransferLookupsDto,
  StockTransferStatus,
  UpdateStockTransferRequest,
} from "../types";
import { clean, dateOnlyToUtcIso, unwrapArray } from "../utils/apiUtils";
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

export type StockTransferListFilter = {
  status?: StockTransferStatus | string | null;
  direction?: StockTransferDirection | null;
  type?: string | null;
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
  return { id: value.id, code: value.code ?? null, name: value.name ?? null, label: value.label };
}

function isUomLookupDto(value: UomLookupDto | null): value is UomLookupDto {
  return Boolean(value?.id);
}

function optionalId(value: string): string | null {
  return clean(value) || null;
}

/**
 * Create body (the API calls the lines `lines`). The server decides whether the transfer stays in the branch
 * from the destination location; the receiving branch is sent so a location shared by branches is unambiguous.
 */
export function toCreateBody(values: StockTransferFormValues) {
  return {
    transferType: values.transferType,
    toBranchId: optionalId(values.toBranchId),
    fromDepartmentId: optionalId(values.fromDepartmentId),
    toDepartmentId: optionalId(values.toDepartmentId),
    fromLocationId: clean(values.fromLocationId),
    toLocationId: clean(values.toLocationId),
    requestedAtUtc: dateOnlyToUtcIso(values.transferDate),
    notes: clean(values.notes) || null,
    lines: values.lines.map((line, index) => ({
      itemId: clean(line.itemId),
      unitId: clean(line.unitId),
      quantity: Number(line.quantity),
      notes: clean(line.notes) || null,
      lineNo: index + 1,
    })),
  };
}

/** Update body (the API calls the lines `items`, notes `reference`, and the date `transferDateUtc`). */
export function toUpdateBody(values: StockTransferFormValues) {
  const create = toCreateBody(values);
  return {
    transferType: create.transferType,
    toBranchId: create.toBranchId,
    fromDepartmentId: create.fromDepartmentId,
    toDepartmentId: create.toDepartmentId,
    fromLocationId: create.fromLocationId,
    toLocationId: create.toLocationId,
    reference: create.notes,
    transferDateUtc: create.requestedAtUtc,
    items: create.lines,
  };
}

export const stockTransfersApi = {
  catalog: {
    async items(companyId: string): Promise<ItemLookupDto[]> {
      const response = await http.get(`${inventoryMaster(companyId)}/items`);
      return unwrapArray<unknown>(response).map(normalizeItemLookup).filter(isItemLookupDto);
    },

    async uoms(companyId: string): Promise<UomLookupDto[]> {
      const response = await http.get(`${inventoryMaster(companyId)}/uoms`);
      return unwrapArray<unknown>(response).map(normalizeUom).map(toUomLookupDto).filter(isUomLookupDto);
    },

    /** Items with stock at a sending location of the branch (base unit). */
    async availableItems(companyId: string, branchId: string, fromLocationId: string): Promise<StockTransferAvailableItemDto[]> {
      const response = await http.get(`${root(companyId, branchId)}/available-items`, { params: { fromLocationId } });
      return unwrapArray<StockTransferAvailableItemDto>(response);
    },

    async lookups(companyId: string, branchId: string, toBranchId?: string | null): Promise<StockTransferLookupsDto> {
      const response = await http.get<StockTransferLookupsDto>(`${root(companyId, branchId)}/lookups`, {
        params: { toBranchId: toBranchId || undefined },
      });
      return response.data;
    },
  },

  documents: {
    async list(
      companyId: string,
      branchId: string,
      filter?: StockTransferListFilter | StockTransferStatus | null
    ): Promise<StockTransferListRowDto[]> {
      const f: StockTransferListFilter = typeof filter === "string" || filter == null ? { status: filter ?? null } : filter;
      const response = await http.get(root(companyId, branchId), {
        params: {
          status: f.status || undefined,
          direction: f.direction || undefined,
          type: f.type || undefined,
        },
      });
      return unwrapArray<StockTransferListRowDto>(response);
    },

    async get(companyId: string, branchId: string, id: string): Promise<StockTransferDocumentDto> {
      const response = await http.get<StockTransferDocumentDto>(`${root(companyId, branchId)}/${path(id)}`);
      return response.data;
    },

    async create(companyId: string, branchId: string, body: ReturnType<typeof toCreateBody> | CreateStockTransferRequest): Promise<string> {
      const response = await http.post<string>(root(companyId, branchId), body);
      return response.data;
    },

    async update(companyId: string, branchId: string, id: string, body: ReturnType<typeof toUpdateBody> | UpdateStockTransferRequest): Promise<void> {
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

    async reject(companyId: string, branchId: string, id: string, reason: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/reject`, { reason });
    },

    /** Within the branch: moves the stock. To another branch: dispatches it into transit. */
    async post(companyId: string, branchId: string, id: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/post`, {});
    },

    /** Called from the receiving branch. */
    async receive(companyId: string, branchId: string, id: string, body: ReceiveStockTransferRequest): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/receive`, body);
    },

    /** Reverses a posted transfer within the branch, or recalls one to another branch still in transit. */
    async reverse(companyId: string, branchId: string, id: string, reason: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/reverse`, { reason });
    },

    async cancel(companyId: string, branchId: string, id: string, reason: string): Promise<void> {
      await http.post(`${root(companyId, branchId)}/${path(id)}/cancel`, { reason });
    },
  },

  list: (companyId: string, branchId: string, filter?: StockTransferListFilter | StockTransferStatus | null) =>
    stockTransfersApi.documents.list(companyId, branchId, filter),

  get: (companyId: string, branchId: string, id: string) =>
    stockTransfersApi.documents.get(companyId, branchId, id) as Promise<StockTransferDocumentDto & StockTransferDetailDto>,

  create: (companyId: string, branchId: string, body: ReturnType<typeof toCreateBody> | CreateStockTransferRequest) =>
    stockTransfersApi.documents.create(companyId, branchId, body),

  update: (companyId: string, branchId: string, id: string, body: ReturnType<typeof toUpdateBody> | UpdateStockTransferRequest) =>
    stockTransfersApi.documents.update(companyId, branchId, id, body),

  submit: (companyId: string, branchId: string, id: string) => stockTransfersApi.workflow.submit(companyId, branchId, id),
  approve: (companyId: string, branchId: string, id: string) => stockTransfersApi.workflow.approve(companyId, branchId, id),
  reject: (companyId: string, branchId: string, id: string, reason: string) =>
    stockTransfersApi.workflow.reject(companyId, branchId, id, reason),
  post: (companyId: string, branchId: string, id: string) => stockTransfersApi.workflow.post(companyId, branchId, id),
  receive: (companyId: string, branchId: string, id: string, body: ReceiveStockTransferRequest) =>
    stockTransfersApi.workflow.receive(companyId, branchId, id, body),
  reverse: (companyId: string, branchId: string, id: string, reason: string) =>
    stockTransfersApi.workflow.reverse(companyId, branchId, id, reason),
  cancel: (companyId: string, branchId: string, id: string, reason: string) =>
    stockTransfersApi.workflow.cancel(companyId, branchId, id, reason),

  lookups: (companyId: string, branchId: string, toBranchId?: string | null) =>
    stockTransfersApi.catalog.lookups(companyId, branchId, toBranchId),
  listItems: (companyId: string) => stockTransfersApi.catalog.items(companyId),
  availableItems: (companyId: string, branchId: string, fromLocationId: string) =>
    stockTransfersApi.catalog.availableItems(companyId, branchId, fromLocationId),
  listUoms: (companyId: string) => stockTransfersApi.catalog.uoms(companyId),
};
