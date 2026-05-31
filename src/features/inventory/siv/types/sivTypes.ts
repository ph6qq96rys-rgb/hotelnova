// src/features/inventory/siv/types/sivTypes.ts
//
// Single source of truth for:
//   - Canonical SIV status values
//   - Status → CSS class mapping (uses existing badge system)
//   - Workflow permissions per status
//   - ViewModel shape (maps from SivDetailsDto)
//   - List item shape (maps from SivListItemDto)
//   - Shared formatters

import type {
  SivDetailsDto,
  SivListItemDto as SivListItemRaw,
} from "../api/sivApi";

// ─── Canonical status values ──────────────────────────────────────────────────
// The backend returns these as strings; normalise before any comparison.

export type SivStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "ChangesRequested"
  | "Issued"
  | "Posted"
  | "Reversed";

/** Normalise whatever the server returns to a canonical SivStatus. */
export function normalizeStatus(raw: unknown): SivStatus {
  const s = String(raw ?? "").trim();
  const map: Record<string, SivStatus> = {
    draft:            "Draft",
    submitted:        "Submitted",
    approved:         "Approved",
    rejected:         "Rejected",
    changesrequested: "ChangesRequested",
    requestedchanges: "ChangesRequested",
    pendingchanges:   "ChangesRequested",
    issued:           "Issued",
    posted:           "Posted",
    reversed:         "Reversed",
  };
  return map[s.toLowerCase()] ?? (s as SivStatus) ?? "Draft";
}

// ─── Badge CSS classes (maps to existing global badge classes) ────────────────

export const STATUS_BADGE: Record<SivStatus, string> = {
  Draft:            "badge badge-neutral",
  Submitted:        "badge badge-info",
  Approved:         "badge badge-success",
  Rejected:         "badge badge-danger",
  ChangesRequested: "badge badge-warn",
  Issued:           "badge badge-accent",
  Posted:           "badge badge-success",
  Reversed:         "badge badge-neutral",
};

// ─── Filter dropdown options ──────────────────────────────────────────────────

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "",                label: "All statuses" },
  { value: "Draft",           label: "Draft" },
  { value: "Submitted",       label: "Submitted" },
  { value: "Approved",        label: "Approved" },
  { value: "Rejected",        label: "Rejected" },
  { value: "ChangesRequested",label: "Changes Requested" },
  { value: "Issued",          label: "Issued" },
  { value: "Posted",          label: "Posted" },
  { value: "Reversed",        label: "Reversed" },
];

// ─── Workflow permissions ─────────────────────────────────────────────────────
// Pure function — no role-based guards here (that's the server's job).
// These drive which buttons render on the client.

export interface SivPermissions {
  canEdit:    boolean;  // Draft | ChangesRequested
  canSubmit:  boolean;  // Draft | ChangesRequested
  canApprove: boolean;  // Submitted
  canReject:  boolean;  // Submitted
  canRequestChanges: boolean; // Submitted
  canIssue:   boolean;  // Approved
  canPost:    boolean;  // Issued
  canReverse: boolean;  // Posted
  canPrint:   boolean;  // Issued | Posted
}

export function resolvePermissions(status: SivStatus): SivPermissions {
  return {
    canEdit:           status === "Draft" || status === "ChangesRequested",
    canSubmit:         status === "Draft" || status === "ChangesRequested",
    canApprove:        status === "Submitted",
    canReject:         status === "Submitted",
    canRequestChanges: status === "Submitted",
    canIssue:          status === "Approved",
    canPost:           status === "Issued",
    canReverse:        status === "Posted",
    canPrint:          status === "Issued" || status === "Posted",
  };
}

// ─── Workflow progress track ───────────────────────────────────────────────────

export const WORKFLOW_TRACK: SivStatus[] = [
  "Draft",
  "Submitted",
  "Approved",
  "Issued",
  "Posted",
];

export const WORKFLOW_ROLES: Record<string, string> = {
  Draft:     "Consuming Location",
  Submitted: "F&B Controller",
  Approved:  "Warehouse",
  Issued:    "Warehouse",
  Posted:    "Finance",
};

/** Returns the zero-based index in WORKFLOW_TRACK, or -1 for terminal states. */
export function workflowStep(status: SivStatus): number {
  return WORKFLOW_TRACK.indexOf(status);
}

// ─── View models ──────────────────────────────────────────────────────────────

export interface SivLineVm {
  id:           string;
  lineNo:       number;
  itemId:       string;
  itemCode:     string;
  itemName:     string;
  uomId:        string;
  uomCode:      string;
  uomName:      string;
  qty:          number;
  requestedQty: number;
  approvedQty:  number | null;
  issuedQty:    number;
  batchNo:      string;
  expiryDate:   string | null;
  remarks:      string;
  availableQty: number | null;
}

export interface SivAuditVm {
  requestedByUserId: string | null;
  submittedByUserId: string | null;
  approvedByUserId:  string | null;
  issuedByUserId:    string | null;
  postedByUserId:    string | null;
  reversedByUserId:  string | null;
  submittedAtUtc:    string | null;
  approvedAtUtc:     string | null;
  issuedAtUtc:       string | null;
  postedAtUtc:       string | null;
  reversedAtUtc:     string | null;
}

export interface SivVm {
  id:               string;
  companyId:        string;
  branchId:         string;
  number:           string;
  docStatus:        SivStatus;
  issueDate:        string;
  departmentId:     string | null;
  departmentName:   string;
  fromLocationId:   string;
  fromLocationName: string;
  toLocationId:     string | null;
  toLocationName:   string | null;
  remarks:          string;
  notes:            string;         // alias for remarks — some pages use notes
  rowVersion:       string | null;
  lines:            SivLineVm[];
  audit:            SivAuditVm;
  // Backwards-compat aliases kept for existing page code
  id_alias:         string;
  createdAt:        string | null;
  updatedAt:        string | null;
}

/** Maps a raw SivDetailsDto from the API to the SivVm used by detail pages. */
export function mapToVm(raw: SivDetailsDto): SivVm {
  const status = normalizeStatus(raw.docStatus);
  const lines: SivLineVm[] = (raw.lines ?? []).map((l) => ({
    id:           l.id            ?? "",
    lineNo:       l.lineNo        ?? 0,
    itemId:       l.itemId        ?? "",
    itemCode:     l.itemCode      ?? "",
    itemName:     l.itemName      ?? "",
    uomId:        l.uomId         ?? "",
    uomCode:      l.uomCode       ?? "",
    uomName:      l.uomCode       ?? "",   // backend returns code, use as name fallback
    qty:          Number(l.qty)   ?? 0,
    requestedQty: Number(l.requestedQty) ?? Number(l.qty) ?? 0,
    approvedQty:  l.approvedQty != null ? Number(l.approvedQty) : null,
    issuedQty:    Number(l.issuedBaseQty) ?? 0,
    batchNo:      l.batchNo       ?? "",
    expiryDate:   l.expiryDate    ?? null,
    remarks:      l.remarks       ?? "",
    availableQty: null,           // not returned by detail endpoint; loaded lazily via FIFO preview
  }));

  const audit: SivAuditVm = {
    requestedByUserId: raw.audit?.requestedByUserId ?? null,
    submittedByUserId: raw.audit?.submittedByUserId ?? null,
    approvedByUserId:  raw.audit?.approvedByUserId  ?? null,
    issuedByUserId:    raw.audit?.issuedByUserId    ?? null,
    postedByUserId:    raw.audit?.postedByUserId    ?? null,
    reversedByUserId:  raw.audit?.reversedByUserId  ?? null,
    submittedAtUtc:    raw.audit?.submittedAtUtc    ?? null,
    approvedAtUtc:     raw.audit?.approvedAtUtc     ?? null,
    issuedAtUtc:       raw.audit?.issuedAtUtc       ?? null,
    postedAtUtc:       raw.audit?.postedAtUtc       ?? null,
    reversedAtUtc:     raw.audit?.reversedAtUtc     ?? null,
  };

  return {
    id:               raw.id              ?? "",
    companyId:        raw.companyId       ?? "",
    branchId:         raw.branchId        ?? "",
    number:           raw.number          ?? raw.id ?? "",
    docStatus:        status,
    issueDate:        raw.issueDate       ?? "",
    departmentId:     raw.departmentId    ?? null,
    departmentName:   raw.departmentName  ?? "",
    fromLocationId:   raw.fromLocationId  ?? "",
    fromLocationName: raw.fromLocationName?? "",
    toLocationId:     raw.toLocationId    ?? null,
    toLocationName:   raw.toLocationName  ?? null,
    remarks:          raw.remarks         ?? "",
    notes:            raw.remarks         ?? "",
    rowVersion:       raw.rowVersion      ?? null,
    lines,
    audit,
    id_alias:         raw.id              ?? "",
    createdAt:        raw.audit?.submittedAtUtc ?? null,
    updatedAt:        raw.audit?.postedAtUtc    ?? raw.audit?.approvedAtUtc ?? null,
  };
}

// ─── List item VM ─────────────────────────────────────────────────────────────

export interface SivListItemDto {
  id:               string;
  number:           string;
  issueDate:        string;
  branchId:         string;
  branchName:       string;
  departmentId:     string;
  departmentName:   string;
  fromLocationId:   string;
  fromLocationName: string;
  toLocationId:     string | null;
  toLocationName:   string | null;
  docStatus:        SivStatus;
  lineCount:        number;
  totalQty:         number;
  requestedByName:  string;
  remarks:          string | null;
}

/** Maps a raw list item to a normalised SivListItemDto. */
export function mapToListItem(raw: any): SivListItemDto | null {
  if (!raw?.id) return null;
  return {
    id:               String(raw.id               ?? ""),
    number:           String(raw.number           ?? raw.sivNo ?? raw.id ?? ""),
    issueDate:        String(raw.issueDate         ?? ""),
    branchId:         String(raw.branchId          ?? ""),
    branchName:       String(raw.branchName        ?? ""),
    departmentId:     String(raw.departmentId      ?? ""),
    departmentName:   String(raw.departmentName    ?? ""),
    fromLocationId:   String(raw.fromLocationId    ?? ""),
    fromLocationName: String(raw.fromLocationName  ?? ""),
    toLocationId:     raw.toLocationId             ?? null,
    toLocationName:   raw.toLocationName           ?? null,
    docStatus:        normalizeStatus(raw.docStatus ?? raw.status),
    lineCount:        Number(raw.totalLines        ?? raw.lineCount ?? 0),
    totalQty:         Number(raw.totalQuantity     ?? raw.totalQty  ?? 0),
    requestedByName:  String(raw.requestedByName   ?? ""),
    remarks:          raw.remarks                  ?? null,
  };
}

export interface PagedResult<T> {
  items:      T[];
  page:       number;
  pageSize:   number;
  totalCount: number;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return s;
  }
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function fmtQty(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "—";
  return v === Math.floor(v)
    ? v.toLocaleString()
    : v.toFixed(3).replace(/\.?0+$/, "");
}

export function fmt$(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `$${v.toFixed(2)}`;
}

export function getApiError(e: unknown, fallback = "An error occurred."): string {
  if (!e) return fallback;
  const err = e as any;
  return (
    err?.response?.data?.error    ??
    err?.response?.data?.Error    ??
    err?.response?.data?.message  ??
    err?.message                  ??
    fallback
  );
}

// ─── Re-exports from sivApi for consumers that import from sivTypes ───────────
// SivDraftEditorScreen imports FifoIssueCandidateDto from ../types/sivTypes.
export type {
  FifoIssueCandidateDto,
  InventoryItemSearchResult,
  LocationOption,
} from "../api/sivApi";
