// src/features/inventory/siv/api/sivApi.ts

import { http } from "../../../../api/http";

export interface SivActionResultDto {
  id: string;
  number: string;
  docStatus: string;
  message: string;
}

export interface SivListItemDto {
  id: string;
  number: string;
  issueDate: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string | null;
  toLocationName: string | null;
  docStatus: string;
  totalLines: number;
  totalQuantity: number;
  requestedByName: string;
}

export interface SivLineDto {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  uomId: string;
  uomCode: string | null;
  qty: number;
  requestedQty: number;
  approvedQty: number | null;
  issuedBaseQty: number;
  remarks: string | null;
  batchNo: string | null;
  expiryDate: string | null;
}

export interface SivAuditDto {
  requestedByUserId: string | null;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  issuedByUserId: string | null;
  postedByUserId: string | null;
  reversedByUserId: string | null;
  submittedAtUtc: string | null;
  approvedAtUtc: string | null;
  issuedAtUtc: string | null;
  postedAtUtc: string | null;
  reversedAtUtc: string | null;
}

export interface SivDetailsDto {
  id: string;
  companyId: string;
  branchId: string;
  number: string;
  docStatus: string;
  status?: string;
  issueDate: string;
  departmentId: string | null;
  departmentName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string | null;
  toLocationName: string | null;
  remarks: string | null;
  rowVersion: string | null;
  lines: SivLineDto[];
  audit: SivAuditDto;
}

export interface FifoAllocationDto {
  fifoLayerId: string;
  sourceId: string;
  sourceNumber: string | null;
  receivedDate: string;
  availableQty: number;
  availableBaseQty: number;
  proposedIssueQty: number;
  proposedIssueBaseQty: number;
  batchNo: string | null;
  expiryDate: string | null;
}

export interface SivLineFifoPreviewDto {
  sivId: string;
  lineId: string;
  itemId: string;
  itemName: string | null;
  uomId: string;
  uomCode: string | null;
  requestedQty: number;
  allocations: FifoAllocationDto[];
}

export interface FifoIssueCandidateDto {
  fifoLayerId: string;
  sourceId: string | null;
  sourceNumber: string | null;
  itemId?: string;
  itemName?: string | null;
  uomId?: string;
  uomCode?: string | null;
  receivedDate: string;
  availableQty: number;
  availableBaseQty: number;
  batchNo: string | null;
  expiryDate: string | null;
}

export interface InventoryItemSearchResult {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  uomId: string;
  uomCode: string;
  baseUomId?: string;
  baseUomCode?: string;
  isActive: boolean;
}

export interface LocationOption {
  id: string;
  name: string;
  code: string | null;
}

export interface CreateSivDraftLineRequest {
  itemId: string;
  uomId: string;
  qty: number;
  remarks?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
}

export interface CreateSivDraftRequest {
  companyId: string;
  branchId: string;
  departmentId?: string | null;
  fromLocationId: string;
  toLocationId?: string | null;
  issueDate: string;
  remarks?: string | null;
  lines: CreateSivDraftLineRequest[];
}

export interface GetSivListParams {
  branchId?: string;
  departmentId?: string;
  fromLocationId?: string;
  docStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchInventoryItemsParams {
  branchId?: string;
  locationId?: string;
  q?: string;
}
export interface ApproveSivLineRequest {
  lineId: string;
  approvedQty: number;
}

export interface IssueSivLineRequest {
  lineId: string;
  issuedQty: number;
  batchNo?: string | null;
  expiryDate?: string | null;
}
const sivBase = (companyId: string) => `/companies/${companyId}/siv`;
const inventoryBase = (companyId: string) =>
  `/companies/${companyId}/inventory-items`;

export const sivApi = {
  getList(companyId: string, params: GetSivListParams = {}) {
    return http.get<unknown>(sivBase(companyId), { params });
  },

  getById(companyId: string, sivId: string) {
    return http.get<SivDetailsDto>(`${sivBase(companyId)}/${sivId}`);
  },

  createDraft(companyId: string, body: CreateSivDraftRequest) {
    return http.post<SivActionResultDto>(`${sivBase(companyId)}/drafts`, {
      ...body,
      companyId,
    });
  },

  submit(
    companyId: string,
    sivId: string,
    body: { rowVersion?: string | null; remarks?: string | null }
  ) {
    return http.post<SivActionResultDto>(
      `${sivBase(companyId)}/${sivId}/submit`,
      { companyId, sivId, ...body }
    );
  },

  approve(
    companyId: string,
    sivId: string,
    body: {
      rowVersion?: string | null;
      remarks?: string | null;
      lines?: { lineId: string; approvedQty: number }[] | null;
    }
  ) {
    return http.post<SivActionResultDto>(
      `${sivBase(companyId)}/${sivId}/approve`,
      { companyId, sivId, ...body }
    );
  },

  reject(
    companyId: string,
    sivId: string,
    body: { rowVersion?: string | null; remarks: string }
  ) {
    return http.post<SivActionResultDto>(
      `${sivBase(companyId)}/${sivId}/reject`,
      { companyId, sivId, ...body }
    );
  },

  requestChanges(
    companyId: string,
    sivId: string,
    body: { rowVersion?: string | null; remarks: string }
  ) {
    return http.post<SivActionResultDto>(
      `${sivBase(companyId)}/${sivId}/request-changes`,
      { companyId, sivId, ...body }
    );
  },

  issue(
    companyId: string,
    sivId: string,
    body: {
      rowVersion?: string | null;
      remarks?: string | null;
      lines?: {
        lineId: string;
        issuedQty: number;
        batchNo?: string | null;
        expiryDate?: string | null;
      }[] | null;
    }
  ) {
    return http.post<SivActionResultDto>(
      `${sivBase(companyId)}/${sivId}/issue`,
      { companyId, sivId, ...body }
    );
  },

  post(companyId: string, sivId: string) {
    return http.post<{ message?: string; error?: string }>(
      `${sivBase(companyId)}/${sivId}/post`
    );
  },

  reverse(
    companyId: string,
    sivId: string,
    body: { rowVersion?: string | null; reason: string }
  ) {
    return http.post<SivActionResultDto>(
      `${sivBase(companyId)}/${sivId}/reverse`,
      { companyId, sivId, ...body }
    );
  },

  getFifoPreview(companyId: string, sivId: string, lineId: string) {
    return http.get<SivLineFifoPreviewDto>(
      `${sivBase(companyId)}/${sivId}/lines/${lineId}/fifo-preview`
    );
  },

  // GET /api/companies/{companyId}/inventory-items/search
  searchInventoryItems(
    companyId: string,
    params: SearchInventoryItemsParams = {}
  ) {
    return http.get<InventoryItemSearchResult[]>(
      `${inventoryBase(companyId)}/search`,
      {
        params: {
          context: "Issue",
          branchId: params.branchId || undefined,
          locationId: params.locationId || undefined,
          q: params.q || undefined,
        },
      }
    );
  },

  // GET /api/companies/{companyId}/inventory-items/stock-locations?canIssue=true
  getStockLocations(companyId: string) {
    return http.get<LocationOption[]>(
      `${inventoryBase(companyId)}/stock-locations`,
      {
        params: {
          canIssue: true,
        },
      }
    );
  },

  // GET /api/companies/{companyId}/inventory-items/fifo-issue-candidates?itemId=&locationId=
  getItemFifoLots(companyId: string, itemId: string, locationId: string) {
    return http.get<FifoIssueCandidateDto[]>(
      `${inventoryBase(companyId)}/fifo-issue-candidates`,
      {
        params: {
          itemId,
          locationId,
        },
      }
    );
  },
};