import type {
  CreateSecurityUserRequest,
  PagedResult,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";
import type {
  AccessScopeRequest,
  AuthUserLike,
  UserFilter,
  UserWithEmployee,
} from "../types/userManagement.types";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export const ROLE_FILTERS = [
  { value: "", label: "All roles" },
  { value: "CompanyAdmin", label: "Company Admin" },
  { value: "BranchAdmin", label: "Branch Admin" },
  { value: "StoreManager", label: "Store Manager" },
  { value: "StoreKeeper", label: "Store Keeper" },
  { value: "WarehouseManager", label: "Warehouse Manager" },
  { value: "InventoryController", label: "Inventory Controller" },
  { value: "FnbController", label: "F&B Controller" },
  { value: "Kitchen", label: "Kitchen" },
  { value: "Chef", label: "Chef" },
  { value: "Cashier", label: "Cashier" },
  { value: "PurchasingOfficer", label: "Purchasing Officer" },
  { value: "ProductionManager", label: "Production Manager" },
  { value: "InventoryClerk", label: "Inventory Clerk" },
] as const;

const PROTECTED_ROLE_VALUES = new Set([
  "SYSTEMADMIN",
  "SYSADMIN",
  "COMPANYADMIN",
]);

export function emptyPage(
  filter: Pick<UserFilter, "page" | "pageSize">,
): PagedResult<UserDto> {
  return {
    items: [],
    total: 0,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeRoleValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
}

function roleValueFromUnknown(role: unknown): string {
  if (typeof role === "string") return normalizeRoleValue(role);
  if (!role || typeof role !== "object") return "";

  const candidate = role as Record<string, unknown>;
  return normalizeRoleValue(
    candidate.value ??
      candidate.normalizedName ??
      candidate.name ??
      candidate.displayName,
  );
}

export function distinctClean(
  values: Array<string | null | undefined>,
): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

export function distinctRoleValues(values: unknown[]): string[] {
  return [...new Set(values.map(roleValueFromUnknown).filter(Boolean))];
}

export function userRoles(user: AuthUserLike | UserDto | null | undefined): string[] {
  if (!user) return [];
  const candidate = user as AuthUserLike;
  const roles = candidate.roles ?? candidate.roleNames ?? [];
  return Array.isArray(roles) ? distinctRoleValues(roles) : [];
}

export function hasRole(
  user: AuthUserLike | UserDto | null | undefined,
  roleValue: string,
): boolean {
  return userRoles(user).includes(normalizeRoleValue(roleValue));
}

export function isSystemAdmin(user: AuthUserLike | UserDto | null | undefined): boolean {
  return hasRole(user, "SYSTEMADMIN") || hasRole(user, "SYSADMIN");
}

export function isCompanyAdmin(user: AuthUserLike | UserDto | null | undefined): boolean {
  return hasRole(user, "COMPANYADMIN");
}

export function includesProtectedRole(roleValues: string[]): boolean {
  return roleValues.some((role) => PROTECTED_ROLE_VALUES.has(normalizeRoleValue(role)));
}

export function canManageTargetUser(
  actor: AuthUserLike | UserDto | null | undefined,
  target: UserDto,
  hasPermission?: (permission: string) => boolean,
): boolean {
  if (isSystemAdmin(actor)) return true;
  if (isSystemAdmin(target) || isCompanyAdmin(target)) return false;

  return (
    isCompanyAdmin(actor) ||
    Boolean(hasPermission?.("users.manage")) ||
    Boolean(hasPermission?.("security.manage"))
  );
}

export function canCreateUsers(
  actor: AuthUserLike | UserDto | null | undefined,
  hasPermission?: (permission: string) => boolean,
): boolean {
  return (
    isSystemAdmin(actor) ||
    isCompanyAdmin(actor) ||
    Boolean(hasPermission?.("users.manage")) ||
    Boolean(hasPermission?.("security.manage"))
  );
}

export function protectedActionMessage(actor: unknown, target: UserDto): string {
  if (isCompanyAdmin(target) && !isSystemAdmin(actor as AuthUserLike)) {
    return "CompanyAdmin users can only be modified by SystemAdmin.";
  }
  if (isSystemAdmin(target) && !isSystemAdmin(actor as AuthUserLike)) {
    return "SystemAdmin users can only be modified by SystemAdmin.";
  }
  return "You do not have permission to manage this user.";
}

export function displayUser(user: UserDto): string {
  return user.fullName || user.userName || user.email || user.id;
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function roleValuesFromRequest(request: AccessScopeRequest): string[] {
  return distinctRoleValues([
    ...(request.roles ?? []),
    ...(request.roleNames ?? []),
  ]);
}

export function normalizeBranchIds(
  request: AccessScopeRequest,
  fallbackBranchId?: string | null,
): string[] {
  return distinctClean([
    ...(request.branchIds ?? []),
    request.branchId,
    fallbackBranchId,
  ]);
}

export function normalizeStockLocationIds(request: AccessScopeRequest): string[] {
  return distinctClean([
    ...(request.allowedStockLocationIds ?? []),
    ...(request.stockLocationIds ?? []),
    request.stockLocationId,
  ]);
}

export function resolveDefaultId(
  preferredId: string | null | undefined,
  candidates: string[],
): string | null {
  if (preferredId && candidates.includes(preferredId)) return preferredId;
  return candidates[0] ?? null;
}

export function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function employeeIdOf(user: UserDto): string {
  return String((user as UserWithEmployee).employeeId ?? "");
}

export function buildCreatePayload(
  request: CreateSecurityUserRequest,
  branchId?: string | null,
): CreateSecurityUserRequest {
  const branchIds = normalizeBranchIds(request, branchId);
  const roles = roleValuesFromRequest(request);

  return {
    ...request,
    branchId: resolveDefaultId(request.branchId ?? branchId, branchIds),
    branchIds,
    roles,
    isActive: request.isActive ?? true,
  };
}

export function buildUpdatePayload(
  request: UpdateSecurityUserRequest,
  branchId?: string | null,
): UpdateSecurityUserRequest {
  const branchIds = normalizeBranchIds(request, branchId);
  const roles = roleValuesFromRequest(request);

  return {
    ...request,
    branchId: resolveDefaultId(request.branchId ?? branchId, branchIds),
    branchIds,
    roles,
  };
}
