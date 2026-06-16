// src/modules/security/pages/UsersPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../api/securityApi";
import type {
  CreateSecurityUserRequest,
  EmployeeOption,
  PagedResult,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";
import UserForm from "../components/UserForm";
import UsersTable from "../components/UsersTable";
import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";
import { extractSecurityError } from "../utils/security.utils";
import "../../../styles/modules.identity.css";

type Modal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; user: UserDto }
  | { kind: "resetPassword"; user: UserDto }
  | { kind: "linkEmployee"; user: UserDto };

type UserFilter = {
  q?: string;
  page: number;
  pageSize: number;
};

type AccessScopeRequest = CreateSecurityUserRequest | UpdateSecurityUserRequest;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function emptyPage(filter: UserFilter): PagedResult<UserDto> {
  return {
    items: [],
    total: 0,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distinctClean(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(Boolean).map(String).map((x) => x.trim()).filter(Boolean))];
}

function userRoles(user: UserDto): string[] {
  return (((user as any).roles ?? (user as any).roleNames ?? []) as string[])
    .filter(Boolean)
    .map(String);
}

function isSystemAdmin(user: UserDto): boolean {
  return userRoles(user).some((role) => role.toLowerCase() === "systemadmin");
}

function displayUser(user: UserDto): string {
  return user.fullName || user.userName || user.email || user.id;
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

function roleNamesFromRequest(
  request: CreateSecurityUserRequest | UpdateSecurityUserRequest
): string[] {
  return distinctClean([...(request.roleNames ?? []), ...(request.roles ?? [])]);
}

function normalizeBranchIds(
  request: AccessScopeRequest,
  fallbackBranchId?: string | null
): string[] {
  return distinctClean([
    ...(request.branchIds ?? []),
    request.branchId,
    fallbackBranchId,
  ]);
}

function normalizeStockLocationIds(request: AccessScopeRequest): string[] {
  return distinctClean([
    ...(request.allowedStockLocationIds ?? []),
    request.stockLocationId,
  ]);
}

function resolveDefaultId(
  preferredId: string | null | undefined,
  candidates: string[]
): string | null {
  if (preferredId && candidates.includes(preferredId)) return preferredId;
  return candidates[0] ?? null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="lux-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function UsersPage() {
  const { companyId, branchId } = useAppScope();
  const { hasPermission, user } = useAuth() as any;

  const loggedInRoles = (((user?.roles ?? user?.roleNames ?? []) as string[]) || [])
    .filter(Boolean)
    .map(String);

  const loggedInIsSystemAdmin = loggedInRoles.some(
    (role) => role.toLowerCase() === "systemadmin"
  );

  const canManageUsers =
    loggedInIsSystemAdmin ||
    hasPermission?.("users.manage") ||
    hasPermission?.("security.manage");

  const [filter, setFilter] = useState<UserFilter>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const [data, setData] = useState<PagedResult<UserDto>>(() =>
    emptyPage({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  );

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, 350);

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const debouncedEmployeeSearch = useDebouncedValue(employeeSearch, 300);

  const effectiveFilter = useMemo<UserFilter>(
    () => ({
      ...filter,
      q: debouncedSearch || undefined,
      pageSize: clamp(filter.pageSize, 1, MAX_PAGE_SIZE),
    }),
    [filter, debouncedSearch]
  );

  const refresh = () => setRefreshKey((current) => current + 1);

  const closeModal = () => {
    if (!busy) {
      setActionError(null);
      setPasswordError(null);
      setModal({ kind: "none" });
    }
  };

  useEffect(() => {
    setFilter((current) => ({
      ...current,
      page: 1,
    }));
  }, [debouncedSearch]);

  useEffect(() => {
    if (!companyId) {
      setData(emptyPage(effectiveFilter));
      return;
    }

    const controller = new AbortController();

    async function loadUsers() {
      try {
        setLoading(true);
        setLoadError(null);

        const result = await securityApi.listUsersPage(
          companyId,
          {
            ...effectiveFilter,
            branchId: branchId || undefined,
          },
          controller.signal
        );

        setData(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(extractSecurityError(error, "Failed to load users."));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => controller.abort();
  }, [companyId, branchId, effectiveFilter, refreshKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && modal.kind !== "none" && !busy) {
        closeModal();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        document.getElementById("users-search")?.focus();
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.kind, busy]);

  useEffect(() => {
    if (modal.kind === "resetPassword") {
      setNewPassword("");
      setPasswordError(null);
      setActionError(null);
      window.setTimeout(() => passwordInputRef.current?.focus(), 0);
    }
  }, [modal.kind]);

  useEffect(() => {
    if (modal.kind !== "linkEmployee") return;

    setEmployeeSearch("");
    setSelectedEmployeeId((modal.user as any).employeeId ?? "");
    setActionError(null);
  }, [modal]);

  useEffect(() => {
    if (modal.kind !== "linkEmployee" || !companyId) return;

    const controller = new AbortController();

    async function loadEmployees() {
      try {
        setEmployeesLoading(true);

        const rows = await securityApi.searchEmployees(
          companyId,
          {
            branchId: branchId || undefined,
            q: debouncedEmployeeSearch || undefined,
            page: 1,
            pageSize: 30,
          },
          controller.signal
        );

        setEmployeeOptions(rows);
      } catch {
        if (!controller.signal.aborted) {
          setEmployeeOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setEmployeesLoading(false);
        }
      }
    }

    void loadEmployees();

    return () => controller.abort();
  }, [modal.kind, companyId, branchId, debouncedEmployeeSearch]);

  async function persistUserSecurityProfile(
    userId: string,
    request: AccessScopeRequest,
    roleNames: string[]
  ): Promise<void> {
    if (!companyId) throw new Error("Company context is missing.");

    await securityApi.setUserRoles(companyId, {
      userId,
      roleNames,
    });

    const branchIds = normalizeBranchIds(request, branchId);
    const defaultBranchId = resolveDefaultId(request.branchId ?? branchId, branchIds);

    if (branchIds.length > 0) {
      await securityApi.assignUserBranches(companyId, userId, {
        branchIds,
        defaultBranchId,
      });
    }

    const stockLocationIds = normalizeStockLocationIds(request);
    const defaultStockLocationId = resolveDefaultId(
      request.stockLocationId,
      stockLocationIds
    );

    if (stockLocationIds.length > 0) {
      await securityApi.assignUserStockLocations(companyId, userId, {
        stockLocationIds,
        defaultStockLocationId,
        canReceive: toBoolean(request.canSubmitWarehouseRequests, true),
        canIssue: toBoolean(request.canIssueStock, true),
        canTransfer: true,
        canSell: true,
        canAdjust: false,
      });
    }
  }

  async function onCreate(
    dto: CreateSecurityUserRequest | UpdateSecurityUserRequest
  ) {
    if (!companyId) {
      setActionError("Company context is missing.");
      return;
    }

    if (!canManageUsers) {
      setActionError("You do not have permission to create users.");
      return;
    }

    const request = dto as CreateSecurityUserRequest;
    const roleNames = roleNamesFromRequest(request);
    const branchIds = normalizeBranchIds(request, branchId);

    try {
      setBusy(true);
      setActionError(null);

      const payload: CreateSecurityUserRequest = {
        ...request,
        branchId: resolveDefaultId(request.branchId ?? branchId, branchIds),
        branchIds,
        roleNames,
        roles: roleNames,
        isActive: request.isActive ?? true,
      };

      const created = await securityApi.createUser(companyId, payload);

      if (!created?.id) {
        throw new Error("User was created, but the API did not return a user id.");
      }

      await persistUserSecurityProfile(created.id, payload, roleNames);

      setModal({ kind: "none" });
      refresh();
    } catch (error) {
      setActionError(extractSecurityError(error, "Failed to create user."));
    } finally {
      setBusy(false);
    }
  }

  async function onEditSubmit(
    dto: CreateSecurityUserRequest | UpdateSecurityUserRequest
  ) {
    if (!companyId) {
      setActionError("Company context is missing.");
      return;
    }

    if (modal.kind !== "edit") {
      setActionError("No user is selected for editing.");
      return;
    }

    if (!canManageUsers) {
      setActionError("You do not have permission to update users.");
      return;
    }

    const request = dto as UpdateSecurityUserRequest;
    const roleNames = roleNamesFromRequest(request);
    const branchIds = normalizeBranchIds(request, branchId);

    try {
      setBusy(true);
      setActionError(null);

      const payload: UpdateSecurityUserRequest = {
        ...request,
        branchId: resolveDefaultId(request.branchId ?? branchId, branchIds),
        branchIds,
        roleNames,
        roles: roleNames,
      };

      await securityApi.updateUser(companyId, modal.user.id, payload);
      await persistUserSecurityProfile(modal.user.id, payload, roleNames);

      setModal({ kind: "none" });
      refresh();
    } catch (error) {
      setActionError(extractSecurityError(error, "Failed to update user."));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(selectedUser: UserDto) {
    if (!companyId || !canManageUsers || isSystemAdmin(selectedUser)) return;

    try {
      setBusy(true);
      setActionError(null);

      await securityApi.setUserActive(
        companyId,
        selectedUser.id,
        !selectedUser.isActive
      );

      refresh();
    } catch (error) {
      setActionError(
        extractSecurityError(error, "Failed to update user status.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitResetPassword() {
    if (!companyId || modal.kind !== "resetPassword" || !canManageUsers) return;

    const password = newPassword.trim();

    if (!isStrongPassword(password)) {
      setPasswordError(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number."
      );
      return;
    }

    try {
      setBusy(true);
      setActionError(null);

      await securityApi.resetUserPassword(companyId, modal.user.id, password);

      setModal({ kind: "none" });
    } catch (error) {
      setActionError(extractSecurityError(error, "Failed to reset password."));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmployeeLink() {
    if (
      !companyId ||
      modal.kind !== "linkEmployee" ||
      !selectedEmployeeId ||
      !canManageUsers
    ) {
      return;
    }

    if (isSystemAdmin(modal.user)) return;

    if ((modal.user as any).employeeId) {
      const confirmed = window.confirm(
        "This user is already linked to an employee. Replace the employee link?"
      );

      if (!confirmed) return;
    }

    try {
      setBusy(true);
      setActionError(null);

      await securityApi.linkUserEmployee(
        companyId,
        modal.user.id,
        selectedEmployeeId
      );

      setModal({ kind: "none" });
      refresh();
    } catch (error) {
      setActionError(extractSecurityError(error, "Failed to link employee."));
    } finally {
      setBusy(false);
    }
  }

  const items = data.items ?? [];
  const total = data.total ?? 0;
  const page = data.page ?? filter.page;
  const pageSize = data.pageSize ?? filter.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const pageSafe = clamp(page, 1, pageCount);

  const canPrev = pageSafe > 1;
  const canNext = pageSafe < pageCount;

  const activeUsers = items.filter((item) => item.isActive).length;
  const disabledUsers = items.filter((item) => !item.isActive).length;
  const systemAdmins = items.filter(isSystemAdmin).length;
  const linkedEmployees = items.filter((item) => Boolean((item as any).employeeId)).length;

  const shownCountText = loading
    ? "Loading…"
    : `${items.length} shown • ${total} total`;

  const showEmpty = !loading && !loadError && items.length === 0;

  if (!companyId) {
    return (
      <div className="lux-page">
        <div className="lux-empty">
          <div className="lux-empty__title">No company selected</div>
          <div className="lux-empty__hint">
            Select a company workspace before managing users.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lux-page">
      <div className="lux-hero">
        <div className="lux-hero__bg" />

        <div className="lux-hero__content">
          <div>
            <div className="lux-kicker">Identity</div>
            <h1 className="lux-title">ERP User Management</h1>
            <p className="lux-subtitle">
              Create employee-linked login accounts with branch, role, and
              stock-location access.
            </p>

            <div className="lux-ribbon" role="status" aria-live="polite">
              <span className="lux-chip">
                <span className="lux-dot" />
                {shownCountText}
              </span>
              <span className="lux-chip">
                Page <strong>{pageSafe}</strong> / <strong>{pageCount}</strong>
              </span>
              <span className="lux-chip">
                Page size <strong>{pageSize}</strong>
              </span>
            </div>
          </div>

          <div className="lux-hero__actions">
            <div className="lux-search" role="search" aria-label="Search users">
              <span className="lux-search__icon">⌕</span>
              <input
                id="users-search"
                className="lux-input lux-input--search"
                placeholder="Search users by name or email…"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                disabled={busy}
              />
              <span className="lux-kbd">⌘K</span>

              {searchText && (
                <button
                  className="lux-iconBtn"
                  type="button"
                  onClick={() => setSearchText("")}
                  disabled={busy}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {canManageUsers && (
              <button
                className="lux-btn lux-btn--primary"
                onClick={() => {
                  setActionError(null);
                  setModal({ kind: "create" });
                }}
                disabled={busy}
                type="button"
              >
                + New User
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lux-kpis">
        <KpiCard label="Users" value={total} />
        <KpiCard label="Active" value={activeUsers} />
        <KpiCard label="Disabled" value={disabledUsers} />
        <KpiCard label="System Admins" value={systemAdmins} />
        <KpiCard label="Employee Linked" value={linkedEmployees} />
      </div>

      {(loadError || actionError) && (
        <div className="lux-alert lux-alert--danger" role="alert">
          <div className="lux-alert__row">
            <div>
              <strong>Error:</strong> {loadError || actionError}
            </div>

            <button
              className="lux-btn lux-btn--soft"
              onClick={() => {
                setActionError(null);
                refresh();
              }}
              disabled={busy}
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="lux-card">
        <div className="lux-card__header">
          <div>
            <div className="lux-card__title">Users</div>
            <div className="lux-card__hint">{shownCountText}</div>
          </div>

          <div className="lux-row">
            {canManageUsers && (
              <button
                className="lux-btn lux-btn--primary"
                onClick={() => {
                  setActionError(null);
                  setModal({ kind: "create" });
                }}
                disabled={busy}
                type="button"
              >
                + New User
              </button>
            )}

            <button
              className="lux-btn lux-btn--soft"
              disabled={busy}
              onClick={refresh}
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="lux-tableWrap">
          <div
            className="lux-tableSurface"
            aria-busy={loading ? "true" : "false"}
          >
            {showEmpty ? (
              <div className="lux-empty">
                <div className="lux-empty__title">No users found</div>
                <div className="lux-empty__hint">
                  Try a different search, or create a new user.
                </div>

                <div className="lux-empty__actions">
                  {canManageUsers && (
                    <button
                      className="lux-btn lux-btn--primary"
                      onClick={() => {
                        setActionError(null);
                        setModal({ kind: "create" });
                      }}
                      disabled={busy}
                      type="button"
                    >
                      + New User
                    </button>
                  )}

                  <button
                    className="lux-btn"
                    onClick={() => {
                      setSearchText("");
                      setFilter((current) => ({
                        ...current,
                        q: undefined,
                        page: 1,
                      }));
                    }}
                    disabled={busy}
                    type="button"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : (
              <UsersTable
                items={items}
                onEdit={(selectedUser) => {
                  setActionError(null);
                  setModal({ kind: "edit", user: selectedUser });
                }}
                onToggleActive={onToggleActive}
                onResetPassword={(selectedUser) => {
                  setActionError(null);
                  setModal({ kind: "resetPassword", user: selectedUser });
                }}
                onLinkEmployee={(selectedUser) =>
                  !isSystemAdmin(selectedUser) &&
                  setModal({ kind: "linkEmployee", user: selectedUser })
                }
                busy={busy}
              />
            )}

            {loading && (
              <div className="lux-veil">
                <div className="lux-spinner" />
                <div className="lux-muted">Loading users…</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lux-pager" aria-label="Pagination">
        <button
          className="lux-btn"
          disabled={!canPrev || busy || loading}
          onClick={() =>
            setFilter((current) => ({
              ...current,
              page: Math.max(1, current.page - 1),
            }))
          }
          type="button"
        >
          Prev
        </button>

        <span className="lux-muted">
          Page <strong>{pageSafe}</strong> / <strong>{pageCount}</strong>
        </span>

        <button
          className="lux-btn"
          disabled={!canNext || busy || loading}
          onClick={() =>
            setFilter((current) => ({
              ...current,
              page: current.page + 1,
            }))
          }
          type="button"
        >
          Next
        </button>
      </div>

      {modal.kind !== "none" && (
        <div
          className="lux-modalOverlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={
              modal.kind === "create" || modal.kind === "edit"
                ? "lux-modal lux-modal--xl"
                : "lux-modal lux-modal--md"
            }
            onClick={(event) => event.stopPropagation()}
          >
            {busy && <div className="lux-modalBusy" />}

            {actionError && (
              <div className="lux-alert lux-alert--danger" role="alert">
                {actionError}
              </div>
            )}

            {modal.kind === "create" && (
              <UserForm
                mode="create"
                onSubmit={onCreate}
                onCancel={closeModal}
                busy={busy}
              />
            )}

            {modal.kind === "edit" && (
              <UserForm
                mode="edit"
                initial={modal.user}
                onSubmit={onEditSubmit}
                onCancel={closeModal}
                busy={busy}
              />
            )}

            {modal.kind === "resetPassword" && (
              <div className="lux-resetPw">
                <div className="lux-resetPw__title">Reset password</div>
                <div className="lux-resetPw__subtitle">
                  For <strong>{displayUser(modal.user)}</strong>
                </div>

                <label className="lux-label">
                  New password
                  <input
                    ref={passwordInputRef}
                    className="lux-input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="Minimum 8 characters, uppercase, lowercase, number…"
                    disabled={busy}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !busy) {
                        void submitResetPassword();
                      }
                    }}
                  />
                </label>

                {passwordError && (
                  <div className="lux-alert lux-alert--danger">
                    {passwordError}
                  </div>
                )}

                <div className="lux-row">
                  <button
                    className="lux-btn"
                    onClick={closeModal}
                    disabled={busy}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    className="lux-btn lux-btn--primary"
                    onClick={submitResetPassword}
                    disabled={busy || !isStrongPassword(newPassword.trim())}
                    type="button"
                  >
                    Update password
                  </button>
                </div>
              </div>
            )}

            {modal.kind === "linkEmployee" && (
              <div className="lux-resetPw">
                <div className="lux-resetPw__title">Link user to employee</div>
                <div className="lux-resetPw__subtitle">
                  User: <strong>{displayUser(modal.user)}</strong>
                </div>

                <label className="lux-label">
                  Search employee
                  <input
                    className="lux-input"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search by employee name or code…"
                    disabled={busy}
                  />
                </label>

                <label className="lux-label">
                  Employee
                  <select
                    className="lux-input"
                    value={selectedEmployeeId}
                    onChange={(event) =>
                      setSelectedEmployeeId(event.target.value)
                    }
                    disabled={busy || employeesLoading}
                  >
                    <option value="">
                      {employeesLoading
                        ? "Loading employees…"
                        : "— Select employee —"}
                    </option>

                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employeeCode
                          ? `${employee.employeeCode} · `
                          : ""}
                        {employee.fullName}
                        {employee.departmentName
                          ? ` · ${employee.departmentName}`
                          : ""}
                        {employee.branchName ? ` · ${employee.branchName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="lux-row">
                  <button
                    className="lux-btn"
                    onClick={closeModal}
                    disabled={busy}
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    className="lux-btn lux-btn--primary"
                    onClick={submitEmployeeLink}
                    disabled={busy || !selectedEmployeeId}
                    type="button"
                  >
                    Link employee
                  </button>
                </div>

                <div className="lux-hint">
                  SystemAdmin users cannot be linked to employees from this screen.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}