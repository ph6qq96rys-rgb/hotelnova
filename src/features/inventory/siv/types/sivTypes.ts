// src/features/inventory/siv/types/sivTypes.ts

import type {
  SivDetailsDto,
  SivListItemDto as SivListItemRaw,
} from "../api/sivApi";

export type SivStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "ChangesRequested"
  | "Issued"
  | "Posted"
  | "Reversed";

const STATUS_MAP: Record<string, SivStatus> = {
  draft: "Draft",
  submitted: "Submitted",
  pendingapproval: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  changesrequested: "ChangesRequested",
  requestedchanges: "ChangesRequested",
  pendingchanges: "ChangesRequested",
  issued: "Issued",
  posted: "Posted",
  reversed: "Reversed",
};

export function normalizeStatus(raw: unknown): SivStatus {
  const key = String(raw ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

  return STATUS_MAP[key] ?? "Draft";
}

export const STATUS_BADGE: Record<SivStatus, string> = {
  Draft: "badge badge-neutral",
  Submitted: "badge badge-info",
  Approved: "badge badge-success",
  Rejected: "badge badge-danger",
  ChangesRequested: "badge badge-warn",
  Issued: "badge badge-accent",
  Posted: "badge badge-success",
  Reversed: "badge badge-neutral",
};

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "ChangesRequested", label: "Changes Requested" },
  { value: "Issued", label: "Issued" },
  { value: "Posted", label: "Posted" },
  { value: "Reversed", label: "Reversed" },
];

export interface SivPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
  canIssue: boolean;
  canPost: boolean;
  canReverse: boolean;
  canPrint: boolean;
}

export function resolvePermissions(status: SivStatus): SivPermissions {
  return {
    canEdit: status === "Draft" || status === "ChangesRequested",
    canSubmit: status === "Draft" || status === "ChangesRequested",
    canApprove: status === "Submitted",
    canReject: status === "Submitted",
    canRequestChanges: status === "Submitted",
    canIssue: status === "Approved",
    canPost: status === "Issued",
    canReverse: status === "Posted",
    canPrint: status === "Issued" || status === "Posted",
  };
}

export const WORKFLOW_TRACK: SivStatus[] = [
  "Draft",
  "Submitted",
  "Approved",
  "Issued",
  "Posted",
];

export const WORKFLOW_ROLES: Record<string, string> = {
  Draft: "Consuming Location",
  Submitted: "F&B Controller",
  Approved: "Warehouse",
  Issued: "Warehouse",
  Posted: "Finance",
};

export function workflowStep(status: SivStatus): number {
  return WORKFLOW_TRACK.indexOf(status);
}

export interface SivLineVm {
  id: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomId: string;
  uomCode: string;
  uomName: string;
  qty: number;
  requestedQty: number;
  approvedQty: number | null;
  issuedQty: number;
  batchNo: string;
  expiryDate: string | null;
  remarks: string;
  availableQty: number | null;
}

export interface SivAuditVm {
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

export interface SivVm {
  id: string;
  companyId: string;
  branchId: string;
  number: string;
  docStatus: SivStatus;
  issueDate: string;
  departmentId: string | null;
  departmentName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string | null;
  toLocationName: string | null;
  remarks: string;
  notes: string;
  rowVersion: string | null;
  lines: SivLineVm[];
  audit: SivAuditVm;
  id_alias: string;
  createdAt: string | null;
  updatedAt: string | null;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapToVm(raw: SivDetailsDto): SivVm {
  const status = normalizeStatus(raw.docStatus ?? raw.status);

  const lines: SivLineVm[] = (raw.lines ?? []).map((line) => ({
    id: line.id ?? "",
    lineNo: num(line.lineNo),
    itemId: line.itemId ?? "",
    itemCode: line.itemCode ?? "",
    itemName: line.itemName ?? "",
    uomId: line.uomId ?? "",
    uomCode: line.uomCode ?? "",
    uomName: line.uomCode ?? "",
    qty: num(line.qty),
    requestedQty: num(line.requestedQty, num(line.qty)),
    approvedQty: line.approvedQty != null ? num(line.approvedQty) : null,
    issuedQty: num(line.issuedBaseQty),
    batchNo: line.batchNo ?? "",
    expiryDate: line.expiryDate ?? null,
    remarks: line.remarks ?? "",
    availableQty: null,
  }));

  const audit: SivAuditVm = {
    requestedByUserId: raw.audit?.requestedByUserId ?? null,
    submittedByUserId: raw.audit?.submittedByUserId ?? null,
    approvedByUserId: raw.audit?.approvedByUserId ?? null,
    issuedByUserId: raw.audit?.issuedByUserId ?? null,
    postedByUserId: raw.audit?.postedByUserId ?? null,
    reversedByUserId: raw.audit?.reversedByUserId ?? null,
    submittedAtUtc: raw.audit?.submittedAtUtc ?? null,
    approvedAtUtc: raw.audit?.approvedAtUtc ?? null,
    issuedAtUtc: raw.audit?.issuedAtUtc ?? null,
    postedAtUtc: raw.audit?.postedAtUtc ?? null,
    reversedAtUtc: raw.audit?.reversedAtUtc ?? null,
  };

  return {
    id: raw.id ?? "",
    companyId: raw.companyId ?? "",
    branchId: raw.branchId ?? "",
    number: raw.number ?? raw.id ?? "",
    docStatus: status,
    issueDate: raw.issueDate ?? "",
    departmentId: raw.departmentId ?? null,
    departmentName: raw.departmentName ?? "",
    fromLocationId: raw.fromLocationId ?? "",
    fromLocationName: raw.fromLocationName ?? "",
    toLocationId: raw.toLocationId ?? null,
    toLocationName: raw.toLocationName ?? null,
    remarks: raw.remarks ?? "",
    notes: raw.remarks ?? "",
    rowVersion: raw.rowVersion ?? null,
    lines,
    audit,
    id_alias: raw.id ?? "",
    createdAt: raw.audit?.submittedAtUtc ?? null,
    updatedAt: raw.audit?.postedAtUtc ?? raw.audit?.approvedAtUtc ?? null,
  };
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
  docStatus: SivStatus;
  lineCount: number;
  totalQty: number;
  requestedByName: string;
  remarks: string | null;
}

export interface PostSivRequest {
  locationId?: string | null;
  rowVersion?: string | null;
  remarks?: string | null;
}

export interface PostSivResultDto {
  id: string;
  number: string;
  docStatus: string;
  message: string;
}

export function mapToListItem(
  raw: SivListItemRaw | any,
): SivListItemDto | null {
  if (!raw?.id) return null;

  return {
    id: String(raw.id ?? ""),
    number: String(raw.number ?? raw.sivNo ?? raw.id ?? ""),
    issueDate: String(raw.issueDate ?? ""),
    branchId: String(raw.branchId ?? ""),
    branchName: String(raw.branchName ?? ""),
    departmentId: String(raw.departmentId ?? ""),
    departmentName: String(raw.departmentName ?? ""),
    fromLocationId: String(raw.fromLocationId ?? ""),
    fromLocationName: String(raw.fromLocationName ?? ""),
    toLocationId: raw.toLocationId ?? null,
    toLocationName: raw.toLocationName ?? null,
    docStatus: normalizeStatus(raw.docStatus ?? raw.status),
    lineCount: num(raw.totalLines ?? raw.lineCount),
    totalQty: num(raw.totalQuantity ?? raw.totalQty),
    requestedByName: String(raw.requestedByName ?? ""),
    remarks: raw.remarks ?? null,
  };
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function fmtQty(n: number | null | undefined): string {
  const value = Number(n ?? 0);
  if (!Number.isFinite(value)) return "—";
  return value === Math.floor(value)
    ? value.toLocaleString()
    : value.toFixed(3).replace(/\.?0+$/, "");
}

export function fmt$(n: number | null | undefined): string {
  const value = Number(n ?? 0);
  return `$${value.toFixed(2)}`;
}

export function getApiError(
  e: unknown,
  fallback = "An error occurred.",
): string {
  if (!e) return fallback;

  const err = e as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  return (
    data?.error ??
    data?.Error ??
    data?.message ??
    data?.title ??
    err?.message ??
    fallback
  );
}

export type {
  FifoIssueCandidateDto,
  InventoryItemSearchResult,
  LocationOption,
} from "../api/sivApi";
