// src/modules/security/utils/security.utils.ts
//
// Pure utility functions. No React, no side effects, fully testable.

import type { UserDetailDto, UserRowDto, UserAssignmentDto } from "../types/security.types";

export function normalize(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

export function toTitleCase(s: string): string {
  return s.split(/[-_.\s]+/).filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export function groupLabel(group?: string | null): string {
  const g = normalize(group);
  return g ? toTitleCase(g) : "General";
}

export function uniqSorted(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function userDisplayName(
  u?: { fullName?: string | null; email?: string; id?: string } | null
): string {
  return u?.fullName?.trim() || u?.email || u?.id || "Unknown";
}

export function userInitials(u: { fullName?: string | null; email: string }): string {
  const name = u.fullName?.trim();
  if (name) {
    return name.split(" ").filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join("");
  }
  return u.email[0]?.toUpperCase() ?? "?";
}

export function toUserRow(u: unknown): UserRowDto {
  const s = u as Record<string, unknown>;
  return {
    id:       String(s?.id       ?? ""),
    email:    String(s?.email    ?? ""),
    fullName: String(s?.fullName ?? ""),
    status:   (s?.status ?? "Active") as UserRowDto["status"],
  };
}

export function toUserDetail(u: unknown): UserDetailDto {
  const s = u as Record<string, unknown>;
  const assignments: UserAssignmentDto[] = Array.isArray(s?.assignments)
    ? s.assignments.map((a: unknown) => {
        const av = a as Record<string, unknown>;
        return {
          id:              String(av?.id              ?? ""),
          roleId:          String(av?.roleId          ?? ""),
          roleName:        String(av?.roleName        ?? ""),
          branchId:        av?.branchId   ? String(av.branchId)   : null,
          branchName:      av?.branchName ? String(av.branchName) : null,
          permissionCount: Number(av?.permissionCount ?? 0),
        };
      })
    : [];
  return {
    id:          String(s?.id       ?? ""),
    email:       String(s?.email    ?? ""),
    fullName:    String(s?.fullName ?? ""),
    status:      (s?.status ?? "Active") as UserDetailDto["status"],
    assignments,
  };
}

export function extractSecurityError(e: unknown, fallback = "An unexpected error occurred."): string {
  const err = e as any;
  return (
    err?.response?.data?.message ??
    err?.response?.data?.title   ??
    err?.message                 ??
    fallback
  );
}

export function isCancelled(e: unknown): boolean {
  const name = (e as any)?.name;
  return name === "AbortError" || name === "CanceledError";
}