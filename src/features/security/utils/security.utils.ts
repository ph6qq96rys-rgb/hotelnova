// ─── Security Utilities ───────────────────────────────────────────────────────

import type { PermissionDto } from "../api/securityApi";

// ── Permission grouping ───────────────────────────────────────────────────────

export interface PermissionGroup {
  group: string;
  items: PermissionDto[];
}

export function groupPermissions(perms: PermissionDto[]): PermissionGroup[] {
  const map = new Map<string, PermissionDto[]>();
  for (const p of perms) {
    const g = p.group?.trim() || "Other";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(p);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => a.key.localeCompare(b.key)),
    }));
}

// ── Dirty check ───────────────────────────────────────────────────────────────

export function isPermissionsDirty(original: string[], staged: string[]): boolean {
  const base = new Set(original);
  const next = new Set(staged);
  if (base.size !== next.size) return true;
  for (const k of next) if (!base.has(k)) return true;
  return false;
}

// ── Error extraction ──────────────────────────────────────────────────────────

export function extractSecurityError(e: unknown, fallback: string): string {
  const err = e as any;
  return (
    err?.response?.data?.message ??
    err?.response?.data?.title ??
    err?.message ??
    fallback
  );
}

// ── User display ──────────────────────────────────────────────────────────────

export function userDisplayName(user: { fullName?: string | null; email: string }): string {
  return user.fullName?.trim() || user.email;
}

export function userInitials(user: { fullName?: string | null; email: string }): string {
  const name = user.fullName?.trim();
  if (name) {
    return name.split(" ").filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join("");
  }
  return user.email[0].toUpperCase();
}