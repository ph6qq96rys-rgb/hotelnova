// src/features/inventory/siv/api/sivApi.ts

import { http } from "../../../../api/http";
import type { PostSivRequest } from "../types/sivTypes";

/* =========================
   DTOs
========================= */

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
  departmentId: string | null;
  departmentName: string | null;
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

  // Optional FIFO/edit metadata. Returned by newer backends.
  fifoLayerId?: string | null;
  inventoryLayerId?: string | null;
  sourceId?: string | null;
  sourceNumber?: string | null;
  grnNumber?: string | null;
  receiptNumber?: string | null;
  documentNumber?: string | null;
  receivedDate?: string | null;
  availableQty?: number | null;
  availableBaseQty?: number | null;
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
  departmentName: string | null;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string | null;
  toLocationName: string | null;
  remarks: string | null;
  rowVersion: string | null;
  lines: SivLineDto[];
  audit: SivAuditDto;
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
  locationType?: string | null;
  canIssue?: boolean;
  canReceive?: boolean;
  canSell?: boolean;
  canProduce?: boolean;
  isActive?: boolean;
}

export interface UserStockLocationDto {
  stockLocationId: string;
  stockLocationName: string;
  stockLocationCode?: string | null;
  branchId: string;
  branchName?: string | null;
  locationType?: string | null;
  isDefault: boolean;
  canReceive: boolean;
  canIssue: boolean;
  canTransfer: boolean;
  canSell: boolean;
  canAdjust: boolean;
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
  grnNumber?: string | null;
  receiptNumber?: string | null;
  documentNumber?: string | null;
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

/* =========================
   Requests
========================= */

export interface SivDraftLineRequest {
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
  requestedByUserId?: string | null;
  fromLocationId: string;
  toLocationId: string;
  issueDate: string;
  remarks?: string | null;
  lines: SivDraftLineRequest[];
}

export interface UpdateSivDraftRequest extends CreateSivDraftRequest {
  sivId: string;
  rowVersion?: string | null;
}

export interface GetSivListParams {
  branchId?: string;
  departmentId?: string;
  fromLocationId?: string;
  toLocationId?: string;
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

export interface StockLocationQueryParams {
  branchId?: string;
  locationType?: string;
  canIssue?: boolean;
  canReceive?: boolean;
  canSell?: boolean;
  canProduce?: boolean;
  isActive?: boolean;
  q?: string;
}

export interface ApproveSivLineRequest {
  lineId: string;
  approvedQty: number;
}

export interface ApproveSivRequest {
  rowVersion?: string | null;
  remarks?: string | null;
  lines?: ApproveSivLineRequest[] | null;

  overrideReason?: string | null;
  recommendationEvaluatedAtUtc?: string | null;
}

export interface IssueSivLineRequest {
  lineId: string;
  issuedQty: number;
  batchNo?: string | null;
  expiryDate?: string | null;
}

/* =========================
   Routes
========================= */

const companySivBase = (companyId: string) =>
  `/companies/${encodeURIComponent(companyId)}/siv`;

const branchSivBase = (
  companyId: string,
  branchId: string,
) =>
  `/companies/${encodeURIComponent(companyId)}` +
  `/branches/${encodeURIComponent(branchId)}/siv`;

const inventoryBase = (companyId: string) =>
  `/companies/${encodeURIComponent(companyId)}/inventory-items`;

const currentUserStockLocationsBase = (companyId: string) =>
  `/companies/${encodeURIComponent(companyId)}/users/me/stock-locations`;

/* =========================
   Helpers
========================= */

type QueryParams = Record<string, unknown>;

function cleanParams<TParams extends object>(params: TParams): QueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function unwrap<T>(response: unknown): T {
  return (((response as { data?: unknown })?.data ?? response) as T);
}

function normalizeArray<T>(response: unknown): T[] {
  const data = unwrap<unknown>(response);

  if (Array.isArray(data)) return data as T[];

  const obj = data as {
    items?: unknown;
    data?: unknown;
    results?: unknown;
    value?: unknown;
  };

  if (Array.isArray(obj.items)) return obj.items as T[];
  if (Array.isArray(obj.data)) return obj.data as T[];
  if (Array.isArray(obj.results)) return obj.results as T[];
  if (Array.isArray(obj.value)) return obj.value as T[];

  return [];
}

function sivListParams(params: GetSivListParams = {}): QueryParams {
  return cleanParams({
    branchId: params.branchId,
    departmentId: params.departmentId,
    fromLocationId: params.fromLocationId,
    toLocationId: params.toLocationId,
    docStatus: params.docStatus,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    q: params.q,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function inventorySearchParams(params: SearchInventoryItemsParams = {}): QueryParams {
  return cleanParams({
    context: "Issue",
    branchId: params.branchId,
    locationId: params.locationId,
    q: params.q,
  });
}

function stockLocationParams(params: StockLocationQueryParams = {}): QueryParams {
  return cleanParams({
    branchId: params.branchId,
    locationType: params.locationType,
    canIssue: params.canIssue,
    canReceive: params.canReceive,
    canSell: params.canSell,
    canProduce: params.canProduce,
    isActive: params.isActive,
    q: params.q,
  });
}

function fifoLotParams(itemId: string, locationId: string): QueryParams {
  return cleanParams({ itemId, locationId });
}

/* =========================
   SIV CRUD / Workflow
   Public contract: all functions return DTO/data directly.
   Components must never use `.data`.
========================= */

async function getList(
  companyId: string,
  params: GetSivListParams = {},
): Promise<SivListItemDto[]> {
  const response = await http.get<unknown>(companySivBase(companyId), {
    params: sivListParams(params),
  });

  return normalizeArray<SivListItemDto>(response);
}

async function getById(companyId: string, sivId: string): Promise<SivDetailsDto> {
  const response = await http.get<SivDetailsDto>(`${companySivBase(companyId)}/${encodeURIComponent(sivId)}`);
  return unwrap<SivDetailsDto>(response);
}

async function createDraft(
  companyId: string,
  branchId: string,
  body: CreateSivDraftRequest,
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(
    `${branchSivBase(companyId, branchId)}/drafts`,
    body,
  );

  return unwrap<SivActionResultDto>(response);
}

async function updateDraft(
  companyId: string,
  branchId: string,
  sivId: string,
  body: UpdateSivDraftRequest,
): Promise<SivActionResultDto> {
  const response = await http.put<SivActionResultDto>(
    `${branchSivBase(companyId, branchId)}` +
      `/drafts/${encodeURIComponent(sivId)}`,
    body,
  );

  return unwrap<SivActionResultDto>(response);
}

async function submit(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; remarks?: string | null },
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(`${companySivBase(companyId)}/${encodeURIComponent(sivId)}/submit`, {
    companyId,
    sivId,
    ...body,
  });

  return unwrap<SivActionResultDto>(response);
}

async function approve(
  companyId: string,
  sivId: string,
  request: ApproveSivRequest,
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(
    `${companySivBase(companyId)}` +
      `/${encodeURIComponent(sivId)}/approve`,
    request,
  );

  return unwrap<SivActionResultDto>(response);
}



async function reject(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; remarks: string },
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(`${companySivBase(companyId)}/${encodeURIComponent(sivId)}/reject`, {
    companyId,
    sivId,
    ...body,
  });

  return unwrap<SivActionResultDto>(response);
}

async function requestChanges(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; remarks: string },
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(
    `${companySivBase(companyId)}/${encodeURIComponent(sivId)}/request-changes`,
    {
      companyId,
      sivId,
      ...body,
    },
  );

  return unwrap<SivActionResultDto>(response);
}

async function issue(
  companyId: string,
  sivId: string,
  body: {
    rowVersion?: string | null;
    remarks?: string | null;
    lines?: IssueSivLineRequest[] | null;
  },
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(`${companySivBase(companyId)}/${encodeURIComponent(sivId)}/issue`, {
    companyId,
    sivId,
    ...body,
  });

  return unwrap<SivActionResultDto>(response);
}

async function post(
  companyId: string,
  sivId: string,
  body: PostSivRequest = {},
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(`${companySivBase(companyId)}/${encodeURIComponent(sivId)}/post`, body);
  return unwrap<SivActionResultDto>(response);
}

async function reverse(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; reason: string },
): Promise<SivActionResultDto> {
  const response = await http.post<SivActionResultDto>(`${companySivBase(companyId)}/${encodeURIComponent(sivId)}/reverse`, {
    companyId,
    sivId,
    ...body,
  });

  return unwrap<SivActionResultDto>(response);
}

async function getFifoPreview(
  companyId: string,
  sivId: string,
  lineId: string,
): Promise<SivLineFifoPreviewDto> {
  const response = await http.get<SivLineFifoPreviewDto>(
    `${companySivBase(companyId)}/${encodeURIComponent(sivId)}` +
      `/lines/${encodeURIComponent(lineId)}/fifo-preview`,
  );

  return unwrap<SivLineFifoPreviewDto>(response);
}

/* =========================
   Inventory Search
========================= */

async function searchInventoryItems(
  companyId: string,
  params: SearchInventoryItemsParams = {},
): Promise<InventoryItemSearchResult[]> {
  const response = await http.get<InventoryItemSearchResult[]>(`${inventoryBase(companyId)}/search`, {
    params: inventorySearchParams(params),
  });

  return normalizeArray<InventoryItemSearchResult>(response);
}

async function getStockLocations(
  companyId: string,
  params: StockLocationQueryParams = {},
): Promise<LocationOption[]> {
  const response = await http.get<LocationOption[]>(`${inventoryBase(companyId)}/stock-locations`, {
    params: stockLocationParams({
      isActive: true,
      ...params,
    }),
  });

  return normalizeArray<LocationOption>(response);
}

/**
 * Legacy branch-level location APIs.
 * Prefer current-user stock-location APIs when the backend supports them.
 */
function getIssueLocations(companyId: string, branchId?: string): Promise<LocationOption[]> {
  return getStockLocations(companyId, {
    branchId,
    canIssue: true,
    isActive: true,
  });
}

function getConsumptionLocations(companyId: string, branchId?: string): Promise<LocationOption[]> {
  return getStockLocations(companyId, {
    branchId,
    canReceive: true,
    isActive: true,
  });
}

async function getItemFifoLots(
  companyId: string,
  itemId: string,
  locationId: string,
): Promise<FifoIssueCandidateDto[]> {
  const response = await http.get<FifoIssueCandidateDto[]>(
    `${inventoryBase(companyId)}/fifo-issue-candidates`,
    {
      params: fifoLotParams(itemId, locationId),
    },
  );

  return normalizeArray<FifoIssueCandidateDto>(response);
}

/* =========================
   Current User Stock Locations
========================= */

async function getMyStockLocations(companyId: string): Promise<UserStockLocationDto[]> {
  const response = await http.get<UserStockLocationDto[]>(currentUserStockLocationsBase(companyId));
  return normalizeArray<UserStockLocationDto>(response);
}

async function getMyBranchStockLocations(
  companyId: string,
  branchId?: string | null,
): Promise<UserStockLocationDto[]> {
  const rows = await getMyStockLocations(companyId);
  return branchId ? rows.filter((location) => location.branchId === branchId) : rows;
}

async function getMyIssueLocations(
  companyId: string,
  branchId?: string | null,
): Promise<UserStockLocationDto[]> {
  const rows = await getMyBranchStockLocations(companyId, branchId);
  return rows.filter((location) => location.canIssue || location.canTransfer);
}

async function getMyDestinationLocations(
  companyId: string,
  branchId?: string | null,
): Promise<UserStockLocationDto[]> {
  const rows = await getMyBranchStockLocations(companyId, branchId);
  return rows.filter((location) => location.canReceive || location.canTransfer);
}

async function getMyDefaultDestinationLocation(
  companyId: string,
  branchId?: string | null,
): Promise<UserStockLocationDto | null> {
  const destinations = await getMyDestinationLocations(companyId, branchId);
  return destinations.find((location) => location.isDefault) ?? destinations[0] ?? null;
}

async function getMyDefaultIssueLocation(
  companyId: string,
  branchId?: string | null,
): Promise<UserStockLocationDto | null> {
  const sources = await getMyIssueLocations(companyId, branchId);
  return sources.find((location) => location.isDefault) ?? sources[0] ?? null;
}

/* =========================
   Export
========================= */

export const sivApi = {
  getList,
  getById,

  createDraft,
  updateDraft,

  submit,
  approve,
  reject,
  requestChanges,
  issue,
  post,
  reverse,

  getFifoPreview,
  searchInventoryItems,

  getStockLocations,
  getIssueLocations,
  getConsumptionLocations,

  getMyStockLocations,
  getMyBranchStockLocations,
  getMyIssueLocations,
  getMyDestinationLocations,
  getMyDefaultDestinationLocation,
  getMyDefaultIssueLocation,

  getItemFifoLots,
};
