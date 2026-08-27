// src/modules/security/pages/UsersPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import "../../../styles/modules.identity.css";

import type {
  CreateSecurityUserRequest,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";
import UserForm from "../components/UserForm";
import UsersTable from "../components/UsersTable";
import { LinkEmployeeDialog } from "../components/LinkEmployeeDialog";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { UserKpis } from "../components/UserKpis";
import { UsersFilters } from "../components/UsersFilters";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useEmployeeSearch } from "../hooks/useEmployeeSearch";
import { useUserActions } from "../hooks/useUserActions";
import { useUsersQuery } from "../hooks/useUsersQuery";
import type { AuthUserLike, UserFilter, UserModal } from "../types/userManagement.types";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  canCreateUsers,
  canManageTargetUser,
  clamp,
  employeeIdOf,
  includesProtectedRole,
  isCompanyAdmin,
  isSystemAdmin,
  protectedActionMessage,
  roleValuesFromRequest,
} from "../utils/userManagement.utils";

type AuthContextValue = {
  user?: AuthUserLike | null;
  hasPermission?: (permission: string) => boolean;
};

export default function UsersPage() {
  const navigate = useErpNavigate();
  const { companyId: routeCompanyId } = useParams<{ companyId: string }>();
  const scope = useAppScope();
  const companyId = routeCompanyId ?? scope.companyId;
  const branchId = scope.branchId;
  const { user: currentUser, hasPermission } = useAuth() as AuthContextValue;

  const [filter, setFilter] = useState<UserFilter>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [searchText, setSearchText] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState<UserModal>({ kind: "none" });
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const debouncedSearch = useDebouncedValue(searchText, 350);
  const debouncedEmployeeSearch = useDebouncedValue(employeeSearch, 300);

  const effectiveFilter = useMemo<UserFilter>(
    () => ({
      ...filter,
      q: debouncedSearch || undefined,
      role: filter.role || undefined,
      branchId: filter.branchId || undefined,
      storeId: filter.storeId || undefined,
      stockLocationId: filter.stockLocationId || undefined,
      pageSize: clamp(filter.pageSize, 1, MAX_PAGE_SIZE),
    }),
    [debouncedSearch, filter],
  );

  const usersQuery = useUsersQuery(companyId, effectiveFilter, refreshKey);
  const actions = useUserActions(companyId, branchId);
  const employeeQuery = useEmployeeSearch(
    modal.kind === "linkEmployee",
    companyId,
    debouncedEmployeeSearch,
  );

  const loggedInIsSystemAdmin = isSystemAdmin(currentUser);
  const canCreate = canCreateUsers(currentUser, hasPermission);
  const busy = actions.busy;
  const usersListPath = companyId ? `/companies/${companyId}/users` : "/";

  useEffect(() => {
    setFilter((current) => ({ ...current, page: 1 }));
  }, [
    debouncedSearch,
    filter.role,
    filter.branchId,
    filter.storeId,
    filter.stockLocationId,
    filter.isActive,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && modal.kind !== "none" && !busy) closeModal();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        document.getElementById("users-search")?.focus();
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, modal.kind]);

  function refresh(): void {
    setRefreshKey((current) => current + 1);
  }

  function resetFilters(): void {
    setSearchText("");
    setFilter({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  }

  function clearMessages(): void {
    setNotice(null);
    setLocalError(null);
    actions.setError(null);
  }

  function closeModal(): void {
    if (busy) return;
    clearMessages();
    setEmployeeSearch("");
    setModal({ kind: "none" });
  }

  function completeMutation(message: string, user?: UserDto): void {
    if (user) {
      usersQuery.upsertUser(user);
    }

    setModal({ kind: "none" });
    setEmployeeSearch("");
    setLocalError(null);
    setNotice(message);
    navigate(usersListPath, { replace: true });
  }

  function guardManage(user: UserDto): boolean {
    if (canManageTargetUser(currentUser, user, hasPermission)) return true;
    setLocalError(protectedActionMessage(currentUser, user));
    return false;
  }

  function guardRoles(request: CreateSecurityUserRequest | UpdateSecurityUserRequest): boolean {
    if (loggedInIsSystemAdmin) return true;
    if (!includesProtectedRole(roleValuesFromRequest(request))) return true;
    setLocalError("Only SystemAdmin can assign SystemAdmin or CompanyAdmin roles.");
    return false;
  }

  async function onCreate(dto: CreateSecurityUserRequest | UpdateSecurityUserRequest): Promise<void> {
    if (!canCreate) {
      setLocalError("You do not have permission to create users.");
      return;
    }
    const request = dto as CreateSecurityUserRequest;
    if (!guardRoles(request)) return;

    clearMessages();
    try {
      const created = await actions.create(request);
      completeMutation("User created successfully.", created);
    } catch {
      // Error is exposed by useUserActions.
    }
  }

  async function onEdit(dto: CreateSecurityUserRequest | UpdateSecurityUserRequest): Promise<void> {
    if (modal.kind !== "edit") return;
    if (!guardManage(modal.user)) return;
    const request = dto as UpdateSecurityUserRequest;
    if (!guardRoles(request)) return;

    clearMessages();
    try {
      const updated = await actions.update(modal.user.id, request);
      completeMutation("User updated successfully.", updated);
    } catch {
      // Error is exposed by useUserActions.
    }
  }

  async function toggleActive(user: UserDto): Promise<void> {
    if (!guardManage(user)) return;
    clearMessages();
    try {
      await actions.setActive(user);
      setNotice(user.isActive ? "User deactivated." : "User activated.");
      refresh();
    } catch {
      // Error is exposed by useUserActions.
    }
  }

  async function resetPassword(password: string): Promise<void> {
    if (modal.kind !== "resetPassword" || !guardManage(modal.user)) return;
    clearMessages();
    try {
      await actions.resetPassword(modal.user.id, password);
      completeMutation("Password reset successfully.");
    } catch {
      // Error is exposed by useUserActions.
    }
  }

  async function linkEmployee(employeeId: string): Promise<void> {
    if (modal.kind !== "linkEmployee" || !guardManage(modal.user)) return;
    if (!employeeId) {
      setLocalError("Select an employee before linking.");
      return;
    }

    if (employeeIdOf(modal.user)) {
      const confirmed = window.confirm(
        "This user is already linked to an employee. Replace the employee link?",
      );
      if (!confirmed) return;
    }

    clearMessages();
    try {
      await actions.linkEmployee(modal.user.id, employeeId);
      completeMutation("Employee linked successfully.");
    } catch {
      // Error is exposed by useUserActions.
    }
  }

  const items = usersQuery.data.items ?? [];
  const total = usersQuery.data.total ?? 0;
  const page = usersQuery.data.page ?? filter.page;
  const pageSize = usersQuery.data.pageSize ?? filter.pageSize;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const pageSafe = clamp(page, 1, pageCount);
  const loading = usersQuery.loading;
  const error = usersQuery.error || actions.error || localError;
  const shownCountText = loading ? "Loading..." : `${items.length} shown - ${total} total`;

  const hasActiveFilters =
    Boolean(searchText) ||
    Boolean(filter.role) ||
    Boolean(filter.branchId) ||
    Boolean(filter.storeId) ||
    Boolean(filter.stockLocationId) ||
    filter.isActive !== undefined ||
    filter.pageSize !== DEFAULT_PAGE_SIZE;

  if (!companyId) {
    return (
      <div className="lux-page">
        <div className="lux-empty">
          <div className="lux-empty__title">No company selected</div>
          <div className="lux-empty__hint">Select a company workspace before managing users.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lux-page">
      <header className="lux-hero">
        <div className="lux-hero__bg" />
        <div className="lux-hero__content">
          <div>
            <div className="lux-kicker">Identity</div>
            <h1 className="lux-title">ERP User Management</h1>
            <p className="lux-subtitle">
              Company-scoped security portal for roles, branch access, employee links, and stock-location access.
            </p>
            <div className="lux-ribbon" role="status" aria-live="polite">
              <span className="lux-chip"><span className="lux-dot" />{shownCountText}</span>
              <span className="lux-chip">Page <strong>{pageSafe}</strong> / <strong>{pageCount}</strong></span>
              <span className="lux-chip">Scope <strong>Company</strong></span>
            </div>
          </div>

          <div className="lux-hero__actions">
            <div className="lux-search" role="search" aria-label="Search users">
              <span className="lux-search__icon">Search</span>
              <input
                id="users-search"
                className="lux-input lux-input--search"
                placeholder="Search users by name, email, phone, or employee code..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                disabled={busy}
              />
              <span className="lux-kbd">Ctrl+K</span>
              {searchText && (
                <button className="lux-iconBtn" type="button" onClick={() => setSearchText("")} disabled={busy} aria-label="Clear search">x</button>
              )}
            </div>
            {canCreate && (
              <button
                className="lux-btn lux-btn--primary"
                onClick={() => {
                  clearMessages();
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
      </header>

      <UserKpis items={items} total={total} showSystemAdmins={loggedInIsSystemAdmin} />

      {notice && <div className="lux-alert lux-alert--success" role="status">{notice}</div>}
      {error && (
        <div className="lux-alert lux-alert--danger" role="alert">
          <div className="lux-alert__row">
            <div><strong>Error:</strong> {error}</div>
            <button
              className="lux-btn lux-btn--soft"
              onClick={() => {
                clearMessages();
                usersQuery.setError(null);
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

      <UsersFilters
        filter={filter}
        setFilter={setFilter}
        disabled={busy || loading}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      <section className="lux-card">
        <div className="lux-card__header">
          <div>
            <div className="lux-card__title">Users</div>
            <div className="lux-card__hint">{shownCountText}</div>
          </div>
          <div className="lux-row">
            <button className="lux-btn lux-btn--soft" disabled={busy || loading} onClick={refresh} type="button">Refresh</button>
          </div>
        </div>

        <div className="lux-tableWrap">
          <div className="lux-tableSurface" aria-busy={loading}>
            {!loading && !usersQuery.error && items.length === 0 ? (
              <div className="lux-empty">
                <div className="lux-empty__title">No users found</div>
                <div className="lux-empty__hint">Try a different filter, or create a new user.</div>
                <div className="lux-empty__actions">
                  {canCreate && <button className="lux-btn lux-btn--primary" onClick={() => setModal({ kind: "create" })} type="button">+ New User</button>}
                  <button className="lux-btn" onClick={resetFilters} type="button">Clear filters</button>
                </div>
              </div>
            ) : (
              <UsersTable
                items={items}
                onEdit={(user) => guardManage(user) && setModal({ kind: "edit", user })}
                onToggleActive={toggleActive}
                onResetPassword={(user) => guardManage(user) && setModal({ kind: "resetPassword", user })}
                onLinkEmployee={(user) => guardManage(user) && setModal({ kind: "linkEmployee", user })}
                busy={busy}
              />
            )}
            {loading && <div className="lux-veil"><div className="lux-spinner" /><div className="lux-muted">Loading users...</div></div>}
          </div>
        </div>
      </section>

      <nav className="lux-pager" aria-label="Pagination">
        <button className="lux-btn" disabled={pageSafe <= 1 || busy || loading} onClick={() => setFilter((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} type="button">Prev</button>
        <span className="lux-muted">Page <strong>{pageSafe}</strong> / <strong>{pageCount}</strong></span>
        <button className="lux-btn" disabled={pageSafe >= pageCount || busy || loading} onClick={() => setFilter((current) => ({ ...current, page: current.page + 1 }))} type="button">Next</button>
      </nav>

      {modal.kind !== "none" && (
        <div className="lux-modalOverlay" onClick={closeModal} role="dialog" aria-modal="true">
          <div
            className={modal.kind === "create" || modal.kind === "edit" ? "lux-modal lux-modal--xl" : "lux-modal lux-modal--md"}
            onClick={(event) => event.stopPropagation()}
          >
            {busy && <div className="lux-modalBusy" />}
            {modal.kind === "create" && <UserForm mode="create" onSubmit={onCreate} onCancel={closeModal} busy={busy} />}
            {modal.kind === "edit" && <UserForm mode="edit" initial={modal.user} onSubmit={onEdit} onCancel={closeModal} busy={busy} />}
            {modal.kind === "resetPassword" && (
              <ResetPasswordDialog user={modal.user} busy={busy} error={actions.error || localError} onCancel={closeModal} onSubmit={resetPassword} />
            )}
            {modal.kind === "linkEmployee" && (
              <LinkEmployeeDialog
                user={modal.user}
                options={employeeQuery.items}
                loading={employeeQuery.loading}
                busy={busy}
                error={actions.error || localError}
                onSearch={setEmployeeSearch}
                onCancel={closeModal}
                onSubmit={linkEmployee}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
