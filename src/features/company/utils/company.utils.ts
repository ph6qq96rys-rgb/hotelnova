// src/modules/company/utils/company.utils.ts

import type { BranchUserDto, StockLocationType } from "../types/company.types";
import { CompanyStatus } from "../types/company.types";

// ── String helpers ────────────────────────────────────────────────────────────

export function trimOrNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return "—"; }
}

// ── Status helpers ────────────────────────────────────────────────────────────

export function companyStatusLabel(s: CompanyStatus): string {
  return { [CompanyStatus.Draft]: "Draft", [CompanyStatus.Active]: "Active",
           [CompanyStatus.Inactive]: "Inactive", [CompanyStatus.Suspended]: "Suspended" }[s] ?? "Unknown";
}

export function companyStatusTone(s: CompanyStatus): "ok" | "warn" | "danger" | "muted" {
  if (s === CompanyStatus.Active)    return "ok";
  if (s === CompanyStatus.Suspended) return "danger";
  if (s === CompanyStatus.Inactive)  return "warn";
  return "muted";
}

export function stockLocationTypeLabel(t: StockLocationType | string | number | null | undefined): string {
  if (typeof t === "string") return t;
  const map: Record<number, string> = { 1: "Warehouse", 2: "Kitchen", 3: "Bar", 4: "Transit", 5: "WIP", 6: "Store" };
  return (typeof t === "number" ? map[t] : null) ?? "—";
}

// ── User helpers ──────────────────────────────────────────────────────────────

export function branchUserDisplayName(u: BranchUserDto): string {
  return (
    u.fullName?.trim() ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.userName ||
    u.email ||
    u.userId
  );
}

// ── Error extraction ──────────────────────────────────────────────────────────

export function extractApiError(e: unknown, fallback = "An unexpected error occurred."): string {
  const err = e as any;
  return (
    err?.response?.data?.message ??
    err?.response?.data?.title   ??
    err?.message                 ??
    fallback
  );
}