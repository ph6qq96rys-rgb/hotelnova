// src/features/inventory/adjustments/api/adjustmentApi.ts

import { http } from "../../../../api/http";
import { toUserFriendlyError } from "../../../../shared/errors/errorMessage.utils";
import type {
  AdjustmentCandidateDto,
  AdjustmentFifoItemDto,
  AdjustmentTypeOption,
  CreateAdjustmentDraftCommand,
  InventoryAdjustmentDto,
  UpdateAdjustmentDraftCommand,
} from "../types";

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/inventory-adjustments`;

/** A readable message from any API error (business rules, validation, conflicts, network). */
export function getApiError(e: unknown, fallback: string): string {
  return toUserFriendlyError(e, fallback);
}

const list = <T>(r: { data: unknown }): T[] => (Array.isArray(r.data) ? (r.data as T[]) : []);

export const adjustmentApi = {
  //  Lookups

  /** Open lots at a location, in each item's counting unit. */
  candidates: (
    companyId: string,
    branchId: string,
    locationId: string,
    params?: { itemId?: string; search?: string }
  ): Promise<AdjustmentCandidateDto[]> =>
    http
      .get(`${base(companyId, branchId)}/lookups/candidates`, { params: { locationId, ...params } })
      .then(list<AdjustmentCandidateDto>),

  /** Items counted as a whole at a location (found stock, items without an open lot). */
  items: (companyId: string, branchId: string, locationId: string, search?: string): Promise<AdjustmentCandidateDto[]> =>
    http
      .get(`${base(companyId, branchId)}/lookups/items`, { params: { locationId, ...(search ? { search } : {}) } })
      .then(list<AdjustmentCandidateDto>),

  types: (companyId: string, branchId: string): Promise<AdjustmentTypeOption[]> =>
    http.get(`${base(companyId, branchId)}/lookups/types`).then(list<AdjustmentTypeOption>),

  /** Legacy typeahead. */
  fifoItems: (companyId: string, branchId: string, locationId: string, q?: string): Promise<AdjustmentFifoItemDto[]> =>
    http
      .get(`${base(companyId, branchId)}/lookups/fifo-items`, { params: { locationId, ...(q ? { q } : {}) } })
      .then(list<AdjustmentFifoItemDto>),

  //  Queries

  list: (
    companyId: string,
    branchId: string,
    params?: { locationId?: string | null; status?: string | null }
  ): Promise<InventoryAdjustmentDto[]> => {
    const query: Record<string, string> = {};
    if (params?.locationId) query.locationId = params.locationId;
    if (params?.status) query.status = params.status;
    return http.get(base(companyId, branchId), { params: query }).then(list<InventoryAdjustmentDto>);
  },

  get: (companyId: string, branchId: string, adjustmentId: string): Promise<InventoryAdjustmentDto> =>
    http.get<InventoryAdjustmentDto>(`${base(companyId, branchId)}/${adjustmentId}`).then((r) => r.data),

  //  Drafts

  createDraft: (companyId: string, branchId: string, cmd: CreateAdjustmentDraftCommand): Promise<{ id: string }> =>
    http.post<{ id: string }>(base(companyId, branchId), cmd).then((r) => r.data),

  /** Saves a draft, or corrects a rejected adjustment (which returns it to Draft). */
  updateDraft: (companyId: string, branchId: string, adjustmentId: string, cmd: UpdateAdjustmentDraftCommand): Promise<void> =>
    http.put(`${base(companyId, branchId)}/${adjustmentId}`, cmd).then(() => undefined),

  //  Workflow (each step sends the version the user is looking at)

  submit: (companyId: string, branchId: string, adjustmentId: string, version?: string): Promise<void> =>
    http.post(`${base(companyId, branchId)}/${adjustmentId}/submit`, { version: version ?? null }).then(() => undefined),

  approve: (companyId: string, branchId: string, adjustmentId: string, note?: string, version?: string): Promise<void> =>
    http
      .post(`${base(companyId, branchId)}/${adjustmentId}/approve`, { note: note?.trim() || null, version: version ?? null })
      .then(() => undefined),

  reject: (companyId: string, branchId: string, adjustmentId: string, note: string, version?: string): Promise<void> =>
    http.post(`${base(companyId, branchId)}/${adjustmentId}/reject`, { note, version: version ?? null }).then(() => undefined),

  cancel: (companyId: string, branchId: string, adjustmentId: string, reason: string, version?: string): Promise<void> =>
    http.post(`${base(companyId, branchId)}/${adjustmentId}/cancel`, { note: reason, version: version ?? null }).then(() => undefined),

  post: (companyId: string, branchId: string, adjustmentId: string, version?: string): Promise<void> =>
    http.post(`${base(companyId, branchId)}/${adjustmentId}/post`, { version: version ?? null }).then(() => undefined),

  reverse: (companyId: string, branchId: string, adjustmentId: string, reason: string, version?: string): Promise<void> =>
    http.post(`${base(companyId, branchId)}/${adjustmentId}/reverse`, { reason, version: version ?? null }).then(() => undefined),
};
