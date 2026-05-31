// src/features/inventory/adjustments/api/adjustmentApi.ts

import { http } from "../../../../api/http";
import type {
  InventoryAdjustmentDto,
  AdjustmentCandidateDto,
  AdjustmentFifoItemDto,
  CreateAdjustmentDraftCommand as CreateAdjustmentCommand,
  UpdateAdjustmentDraftCommand as UpdateAdjustmentCommand,
} from "../types";

// ── URL builder ───────────────────────────────────────────────────────────────

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}/inventory-adjustments`;

// ── Error extraction ──────────────────────────────────────────────────────────

/**
 * Extracts a human-readable message from any API error.
 * Handles:
 *  - 422 { error: "message" }   (our business-rule failures)
 *  - 400 { title, errors }       (ASP.NET validation)
 *  - plain string bodies
 *  - network/axios errors
 */
export function getApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.error)   return String(data.error);
  if (data?.message) return String(data.message);
  if (data?.title)   return String(data.title);
  return err?.message ?? fallback;
}

// ── API client ────────────────────────────────────────────────────────────────

export const adjustmentApi = {

  // ── Lookups ──────────────────────────────────────────────────────────────────

  /** FIFO-aware item list for the typeahead search at a location. */
  fifoItems: (
    companyId:  string,
    branchId:   string,
    locationId: string,
    q?:         string
  ): Promise<AdjustmentFifoItemDto[]> =>
    http
      .get<AdjustmentFifoItemDto[]>(
        `${base(companyId, branchId)}/lookups/fifo-items`,
        { params: { locationId, ...(q ? { q } : {}) } }
      )
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  /** Open FIFO lots at a location for the adjustment line picker. */
  candidates: (
    companyId:  string,
    branchId:   string,
    locationId: string,
    params?: { itemId?: string; search?: string }
  ): Promise<AdjustmentCandidateDto[]> =>
    http
      .get<AdjustmentCandidateDto[]>(
        `${base(companyId, branchId)}/lookups/candidates`,
        { params: { locationId, ...params } }
      )
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  // ── Queries ──────────────────────────────────────────────────────────────────

  list: (
    companyId: string,
    branchId:  string,
    params?: { locationId?: string | null; status?: string | null }
  ): Promise<InventoryAdjustmentDto[]> => {
    const query: Record<string, string> = {};
    if (params?.locationId) query.locationId = params.locationId;
    if (params?.status)     query.status     = params.status;
    return http
      .get<InventoryAdjustmentDto[]>(base(companyId, branchId), { params: query })
      .then((r) => (Array.isArray(r.data) ? r.data : []));
  },

  get: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string
  ): Promise<InventoryAdjustmentDto> =>
    http
      .get<InventoryAdjustmentDto>(`${base(companyId, branchId)}/${adjustmentId}`)
      .then((r) => r.data),

  // ── Draft lifecycle ───────────────────────────────────────────────────────────

  /**
   * Creates a new Draft adjustment.
   * CompanyId and BranchId are injected from route scope; do not include in cmd.
   */
  createDraft: (
    companyId: string,
    branchId:  string,
    cmd:       Omit<CreateAdjustmentCommand, "companyId" | "branchId">
  ): Promise<{ id: string }> =>
    http
      .post<{ id: string }>(base(companyId, branchId), cmd)
      .then((r) => r.data),

  /**
   * Replaces lines and header fields of a Draft adjustment.
   * CompanyId, BranchId, and Id are route params; do not include in cmd.
   */
  updateDraft: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string,
    cmd:          Omit<UpdateAdjustmentCommand, "companyId" | "branchId" | "id">
  ): Promise<void> =>
    http
      .put(`${base(companyId, branchId)}/${adjustmentId}`, cmd)
      .then(() => undefined),

  // ── Workflow transitions ──────────────────────────────────────────────────────

  submit: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string
  ): Promise<void> =>
    http
      .post(`${base(companyId, branchId)}/${adjustmentId}/submit`)
      .then(() => undefined),

  approve: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string,
    note?:        string
  ): Promise<void> =>
    http
      .post(`${base(companyId, branchId)}/${adjustmentId}/approve`, { note: note ?? null })
      .then(() => undefined),

  reject: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string,
    note:         string
  ): Promise<void> =>
    http
      .post(`${base(companyId, branchId)}/${adjustmentId}/reject`, { note })
      .then(() => undefined),

  post: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string
  ): Promise<void> =>
    http
      .post(`${base(companyId, branchId)}/${adjustmentId}/post`)
      .then(() => undefined),

  reverse: (
    companyId:    string,
    branchId:     string,
    adjustmentId: string,
    reason:       string
  ): Promise<void> =>
    http
      .post(`${base(companyId, branchId)}/${adjustmentId}/reverse`, { reason })
      .then(() => undefined),
};