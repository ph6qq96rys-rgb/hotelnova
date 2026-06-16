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

export interface IssueSivLineRequest {
  lineId: string;
  issuedQty: number;
  batchNo?: string | null;
  expiryDate?: string | null;
}

/* =========================
   Routes
========================= */

const sivBase = (companyId: string) => `/companies/${companyId}/siv`;

const inventoryBase = (companyId: string) =>
  `/companies/${companyId}/inventory-items`;

const currentUserStockLocationsBase = (companyId: string) =>
  `/companies/${companyId}/users/me/stock-locations`;

/* =========================
   Helpers
========================= */

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      return value !== undefined && value !== null && value !== "";
    })
  );
}

function unwrap<T>(response: unknown): T {
  return (((response as any)?.data ?? response) as T);
}

function normalizeArray<T>(value: unknown): T[] {
  const data = unwrap<unknown>(value);

  if (Array.isArray(data)) return data as T[];

  const obj = data as any;

  if (Array.isArray(obj?.items)) return obj.items as T[];
  if (Array.isArray(obj?.data)) return obj.data as T[];
  if (Array.isArray(obj?.results)) return obj.results as T[];

  return [];
}

function sivListParams(params: GetSivListParams = {}): Record<string, unknown> {
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

function inventorySearchParams(
  params: SearchInventoryItemsParams = {}
): Record<string, unknown> {
  return cleanParams({
    context: "Issue",
    branchId: params.branchId,
    locationId: params.locationId,
    q: params.q,
  });
}

function stockLocationParams(
  params: StockLocationQueryParams = {}
): Record<string, unknown> {
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

function fifoLotParams(itemId: string, locationId: string): Record<string, unknown> {
  return cleanParams({ itemId, locationId });
}

/* =========================
   SIV CRUD / Workflow
========================= */

function getList(companyId: string, params: GetSivListParams = {}) {
  return http.get<unknown>(sivBase(companyId), {
    params: sivListParams(params),
  });
}

function getById(companyId: string, sivId: string) {
  return http.get<SivDetailsDto>(`${sivBase(companyId)}/${sivId}`);
}

function createDraft(companyId: string, body: CreateSivDraftRequest) {
  return http.post<SivActionResultDto>(`${sivBase(companyId)}/drafts`, {
    ...body,
    companyId,
  });
}

function updateDraft(
  companyId: string,
  sivId: string,
  body: UpdateSivDraftRequest
) {
  return http.put<SivActionResultDto>(
    `${sivBase(companyId)}/drafts/${sivId}`,
    {
      ...body,
      companyId,
      sivId,
    }
  );
}

function submit(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; remarks?: string | null }
) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/submit`,
    { companyId, sivId, ...body }
  );
}

function approve(
  companyId: string,
  sivId: string,
  body: {
    rowVersion?: string | null;
    remarks?: string | null;
    lines?: ApproveSivLineRequest[] | null;
  }
) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/approve`,
    { companyId, sivId, ...body }
  );
}

function reject(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; remarks: string }
) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/reject`,
    { companyId, sivId, ...body }
  );
}

function requestChanges(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; remarks: string }
) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/request-changes`,
    { companyId, sivId, ...body }
  );
}

function issue(
  companyId: string,
  sivId: string,
  body: {
    rowVersion?: string | null;
    remarks?: string | null;
    lines?: IssueSivLineRequest[] | null;
  }
) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/issue`,
    { companyId, sivId, ...body }
  );
}

function post(companyId: string, sivId: string, body: PostSivRequest = {}) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/post`,
    body
  );
}

function reverse(
  companyId: string,
  sivId: string,
  body: { rowVersion?: string | null; reason: string }
) {
  return http.post<SivActionResultDto>(
    `${sivBase(companyId)}/${sivId}/reverse`,
    { companyId, sivId, ...body }
  );
}

function getFifoPreview(companyId: string, sivId: string, lineId: string) {
  return http.get<SivLineFifoPreviewDto>(
    `${sivBase(companyId)}/${sivId}/lines/${lineId}/fifo-preview`
  );
}

/* =========================
   Inventory Search
========================= */

function searchInventoryItems(
  companyId: string,
  params: SearchInventoryItemsParams = {}
) {
  return http.get<InventoryItemSearchResult[]>(
    `${inventoryBase(companyId)}/search`,
    {
      params: inventorySearchParams(params),
    }
  );
}

function getStockLocations(
  companyId: string,
  params: StockLocationQueryParams = {}
) {
  return http.get<LocationOption[]>(
    `${inventoryBase(companyId)}/stock-locations`,
    {
      params: stockLocationParams({
        isActive: true,
        ...params,
      }),
    }
  );
}

/**
 * Legacy helper.
 * Use getMyIssueLocations() for permission-aware SIV source selection.
 */
function getIssueLocations(companyId: string, branchId?: string) {
  return getStockLocations(companyId, {
    branchId,
    canIssue: true,
    isActive: true,
  });
}

/**
 * Legacy helper.
 * Use getMyDestinationLocations() for permission-aware SIV destination selection.
 */
function getConsumptionLocations(companyId: string, branchId?: string) {
  return getStockLocations(companyId, {
    branchId,
    canReceive: true,
    isActive: true,
  });
}

function getItemFifoLots(companyId: string, itemId: string, locationId: string) {
  return http.get<FifoIssueCandidateDto[]>(
    `${inventoryBase(companyId)}/fifo-issue-candidates`,
    {
      params: fifoLotParams(itemId, locationId),
    }
  );
}

/* =========================
   Current User Stock Locations
   ERP-grade many-to-many access
========================= */

async function getMyStockLocations(
  companyId: string
): Promise<UserStockLocationDto[]> {
  const response = await http.get<UserStockLocationDto[]>(
    currentUserStockLocationsBase(companyId)
  );

  return normalizeArray<UserStockLocationDto>(response);
}

async function getMyBranchStockLocations(
  companyId: string,
  branchId?: string | null
): Promise<UserStockLocationDto[]> {
  const rows = await getMyStockLocations(companyId);

  if (!branchId) return rows;

  return rows.filter((location) => location.branchId === branchId);
}

async function getMyIssueLocations(
  companyId: string,
  branchId?: string | null
): Promise<UserStockLocationDto[]> {
  const rows = await getMyBranchStockLocations(companyId, branchId);

  return rows.filter(
    (location) => location.canIssue || location.canTransfer
  );
}

async function getMyDestinationLocations(
  companyId: string,
  branchId?: string | null
): Promise<UserStockLocationDto[]> {
  const rows = await getMyBranchStockLocations(companyId, branchId);

  return rows.filter(
    (location) => location.canReceive || location.canTransfer
  );
}

async function getMyDefaultDestinationLocation(
  companyId: string,
  branchId?: string | null
): Promise<UserStockLocationDto | null> {
  const destinations = await getMyDestinationLocations(companyId, branchId);

  return (
    destinations.find((location) => location.isDefault) ??
    destinations[0] ??
    null
  );
}

async function getMyDefaultIssueLocation(
  companyId: string,
  branchId?: string | null
): Promise<UserStockLocationDto | null> {
  const sources = await getMyIssueLocations(companyId, branchId);

  return (
    sources.find((location) => location.isDefault) ??
    sources[0] ??
    null
  );
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

  // Legacy branch-level location APIs.
  getIssueLocations,
  getConsumptionLocations,

  // ERP-grade current-user many-to-many stock-location APIs.
  getMyStockLocations,
  getMyBranchStockLocations,
  getMyIssueLocations,
  getMyDestinationLocations,
  getMyDefaultDestinationLocation,
  getMyDefaultIssueLocation,

  getItemFifoLots,
};