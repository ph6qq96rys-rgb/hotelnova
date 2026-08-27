// src/modules/company/onboarding/utils/onboarding.utils.ts

import type { BranchRole } from "../../types/company.types";
import type { Nullable } from "../state/onboarding.types";
import { toUserFriendlyError } from "../../../../shared/errors/errorMessage.utils";

//  String utilities 

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Returns the trimmed string, or null if blank/nullish. */
export function trimOrNull(value: Nullable<string>): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Minimal email check - real validation happens server-side. */
export function isEmail(value: string): boolean {
  const v = value.trim();
  return v.length >= 5 && v.includes("@") && v.includes(".");
}

//  API error extraction 

/**
 * Converts a thrown Axios/fetch error into a human-readable string.
 *
 * Priority (matches the backend's Program.cs exception handler shape):
 *   1. data.detail  - our handler's detail field
 *   2. data.error   - our handler's error field
 *   3. data.message - generic convention
 *   4. data.title   - ASP.NET ProblemDetails
 *   5. data.errors  - ASP.NET validation errors dict to join first messages
 *   6. e.message    - Axios network message
 *   7. fallback
 */
export function extractApiError(
  error: unknown,
  fallback: string = "Something went wrong.",
): string {
  return toUserFriendlyError(error, fallback);
}

// -- Display helpers 

export function roleName(role: BranchRole | string | null | undefined): string {
  return role === "BranchAdmin" ? "Branch Admin" : (role || "Staff");
}

/**
 * Derives a display name from a branch-user record that may have any of
 * several field shapes depending on API version.
 */
export function branchUserDisplayName(user: Record<string, any>): string {
  if (user.fullName)   return user.fullName;
  const first = user.firstName ?? "";
  const last  = user.lastName  ?? "";
  const full  = `${first} ${last}`.trim();
  if (full)            return full;
  if (user.userName)   return user.userName;
  if (user.email)      return user.email;
  return "-";
}

//  Array utilities 

/**
 * Safely coerces an API response into an array.
 * Handles bare arrays, paged responses ({ data, items, result, results }),
 * and null/undefined gracefully.
 */
export function toArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.data))    return obj.data    as T[];
  if (Array.isArray(obj.items))   return obj.items   as T[];
  if (Array.isArray(obj.result))  return obj.result  as T[];
  if (Array.isArray(obj.results)) return obj.results as T[];
  return [];
}

/**
 * Upserts an item into a list by its `id` field (prepends if new, replaces if
 * existing).  Used to optimistically update the branches/stores/etc. lists
 * after a create or update without requiring a full reload.
 */
export function upsertById<T extends { id?: string; Id?: string }>(
  list: T[],
  item: T,
): T[] {
  const id = item.id ?? item.Id ?? "";
  if (!id) return list;
  const without = list.filter((x) => (x.id ?? (x as any).Id) !== id);
  return [item, ...without];
}

//  DEPRECATED - remove once all HTTP responses go through a camelCase
// response interceptor in http.ts. The backend should return camelCase;
// this is a temporary shim for endpoints that still return PascalCase.
// 
/** @deprecated Add a camelCase interceptor to http.ts instead. */
export function normalizeEntity<T extends Record<string, any>>(x: T): T {
  return {
    ...x,
    id:   x.id   ?? x.Id,
    name: x.name ?? x.Name,
    code: x.code ?? x.Code ?? x.storeCode ?? null,
  };
}