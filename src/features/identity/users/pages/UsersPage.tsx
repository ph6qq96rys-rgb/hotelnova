import { useEffect, useMemo, useRef, useState } from "react";
import { usersApi } from "../api/usersApi";
import { useUsers } from "../hooks/useUsers";
import type { CreateUserDto, UserDto } from "../types";
import UsersTable from "../components/UsersTable";
import UserForm from "../components/UserForm";
import "../../../../styles/modules.identity.css";
import { useAppScope } from "../../../../app/useAppScope";

type EmployeeOption = {
  id: string;
  employeeCode?: string | null;
  fullName: string;
  branchName?: string | null;
  departmentName?: string | null;
};

type Modal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; user: UserDto }
  | { kind: "resetPassword"; user: UserDto }
  | { kind: "linkEmployee"; user: UserDto };

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hasSystemAdminRole(user: UserDto): boolean {
  const roles = ((user as any).roles ?? (user as any).roleNames ?? []) as string[];
  return roles.some((r) => String(r).toLowerCase() === "systemadmin");
}

function displayUser(user: UserDto) {
  return user.email ?? user.userName ?? user.id;
}

export default function UsersPage() {
  const { companyId, branchId } = useAppScope();

  const { filter, setFilter, data, loading, error, refresh, canPrev, canNext } =
    useUsers(companyId, { page: 1, pageSize: 10 });

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [busy, setBusy] = useState(false);

  const [searchText, setSearchText] = useState(filter.q ?? "");
  const debouncedSearch = useDebouncedValue(searchText, 350);

  const [newPassword, setNewPassword] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const debouncedEmployeeSearch = useDebouncedValue(employeeSearch, 300);

  useEffect(() => {
    setFilter((f) => ({ ...f, q: debouncedSearch || undefined, page: 1 }));
  }, [debouncedSearch, setFilter]);

  useEffect(() => {
    setSearchText(filter.q ?? "");
  }, [filter.q]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal.kind !== "none" && !busy) {
        setModal({ kind: "none" });
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        document.getElementById("users-search")?.focus();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.kind, busy]);

  useEffect(() => {
    if (modal.kind === "resetPassword") {
      setNewPassword("");
      setTimeout(() => passwordInputRef.current?.focus(), 0);
    }
  }, [modal.kind]);

  useEffect(() => {
    if (modal.kind !== "linkEmployee") return;

    setEmployeeSearch("");
    setSelectedEmployeeId((modal.user as any).employeeId ?? "");
  }, [modal]);

  useEffect(() => {
    if (modal.kind !== "linkEmployee" || !companyId) return;

    let active = true;

    async function loadEmployees() {
      try {
        setEmployeesLoading(true);

        const res = await usersApi.searchEmployees(companyId, {
          branchId: branchId || undefined,
          q: debouncedEmployeeSearch || undefined,
          unlinkedOnly: true,
          page: 1,
          pageSize: 30,
        });

        const data = (res as any)?.data ?? res;
        const rows = Array.isArray(data)
          ? data
          : data?.items ?? data?.data ?? data?.results ?? [];

        if (active) setEmployeeOptions(rows);
      } finally {
        if (active) setEmployeesLoading(false);
      }
    }

    void loadEmployees();

    return () => {
      active = false;
    };
  }, [modal.kind, companyId, branchId, debouncedEmployeeSearch]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const page = data?.page ?? filter.page ?? 1;
  const pageSize = data?.pageSize ?? filter.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const pageSafe = clamp(page, 1, pageCount);

  const shownCountText = loading
    ? "Loading…"
    : `${items.length} shown • ${total} total`;

  const showEmpty = !loading && !error && items.length === 0;

  const closeModal = () => setModal({ kind: "none" });

  const onCreate = async (dto: CreateUserDto) => {
    try {
      setBusy(true);
      await usersApi.create(companyId, {
        ...dto,
        branchId: branchId || null,
      });
      closeModal();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onEditSubmit = async (dto: any) => {
    if (modal.kind !== "edit") return;

    try {
      setBusy(true);
      await usersApi.update(companyId, modal.user.id, dto);
      closeModal();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onToggleActive = async (u: UserDto) => {
    if (hasSystemAdminRole(u)) return;

    try {
      setBusy(true);
      await usersApi.setActive(companyId, u.id, !u.isActive);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const submitResetPassword = async () => {
    if (modal.kind !== "resetPassword") return;

    const pw = newPassword.trim();
    if (pw.length < 6) return;

    try {
      setBusy(true);
      await usersApi.resetPassword(companyId, modal.user.id, pw);
      closeModal();
      alert("Password updated.");
    } finally {
      setBusy(false);
    }
  };

  const submitEmployeeLink = async () => {
    if (modal.kind !== "linkEmployee") return;
    if (!selectedEmployeeId) return;
    if (hasSystemAdminRole(modal.user)) return;

    try {
      setBusy(true);
      await usersApi.linkEmployee(companyId, modal.user.id, {
        employeeId: selectedEmployeeId,
      });
      closeModal();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lux-page">
      <div className="lux-hero">
        <div className="lux-hero__bg" />
        <div className="lux-hero__content">
          <div>
            <div className="lux-kicker">Identity</div>
            <h1 className="lux-title">User Management</h1>
            <p className="lux-subtitle">
              Create users, manage access, and link operational users to employees.
            </p>

            <div className="lux-ribbon" role="status" aria-live="polite">
              <span className="lux-chip">
                <span className="lux-dot" aria-hidden="true" />
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
              <span className="lux-search__icon" aria-hidden="true">⌕</span>
              <input
                id="users-search"
                className="lux-input lux-input--search"
                placeholder="Search users by name or email…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={busy}
              />
              <span className="lux-kbd" aria-hidden="true">⌘K</span>
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

            <button
              className="lux-btn lux-btn--primary"
              onClick={() => setModal({ kind: "create" })}
              disabled={busy}
              type="button"
            >
              + New User
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="lux-alert lux-alert--danger" role="alert">
          <div className="lux-alert__row">
            <div>
              <strong>Error:</strong> {error?.message ?? "Request failed"}{" "}
              (HTTP {(error as any)?.status ?? "?"})
            </div>
            <button
              className="lux-btn lux-btn--soft"
              onClick={() => refresh()}
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

          <button
            className="lux-btn lux-btn--soft"
            disabled={busy}
            onClick={() => refresh()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="lux-tableWrap">
          <div className="lux-tableSurface" aria-busy={loading ? "true" : "false"}>
            {showEmpty ? (
              <div className="lux-empty">
                <div className="lux-empty__title">No users found</div>
                <div className="lux-empty__hint">
                  Try a different search, or create a new user.
                </div>
                <div className="lux-empty__actions">
                  <button
                    className="lux-btn lux-btn--primary"
                    onClick={() => setModal({ kind: "create" })}
                    disabled={busy}
                    type="button"
                  >
                    + New User
                  </button>
                  <button
                    className="lux-btn"
                    onClick={() => {
                      setSearchText("");
                      setFilter((f) => ({ ...f, q: undefined, page: 1 }));
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
                onEdit={(u) => setModal({ kind: "edit", user: u })}
                onToggleActive={onToggleActive}
                onResetPassword={(u) => setModal({ kind: "resetPassword", user: u })}
                onLinkEmployee={(u: UserDto) => {
                  if (!hasSystemAdminRole(u)) {
                    setModal({ kind: "linkEmployee", user: u });
                  }
                }}
                busy={busy}
              />
            )}

            {loading && (
              <div className="lux-veil" aria-hidden="true">
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
          onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
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
          onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          type="button"
        >
          Next
        </button>
      </div>

      {modal.kind !== "none" && (
        <div
          className="lux-modalOverlay"
          onClick={() => !busy && closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={
              modal.kind === "create" || modal.kind === "edit"
                ? "lux-modal lux-modal--xl"
                : "lux-modal lux-modal--md"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {busy && <div className="lux-modalBusy" aria-hidden="true" />}

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
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter a new password…"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) submitResetPassword();
                    }}
                  />
                </label>

                <div className="lux-row">
                  <button className="lux-btn" onClick={closeModal} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    className="lux-btn lux-btn--primary"
                    onClick={submitResetPassword}
                    disabled={busy || newPassword.trim().length < 6}
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
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search by employee name or code…"
                    disabled={busy}
                  />
                </label>

                <label className="lux-label">
                  Employee
                  <select
                    className="lux-input"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    disabled={busy || employeesLoading}
                  >
                    <option value="">
                      {employeesLoading ? "Loading employees…" : "— Select employee —"}
                    </option>

                    {employeeOptions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.employeeCode ? `${e.employeeCode} · ` : ""}
                        {e.fullName}
                        {e.departmentName ? ` · ${e.departmentName}` : ""}
                        {e.branchName ? ` · ${e.branchName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="lux-row">
                  <button className="lux-btn" onClick={closeModal} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    className="lux-btn lux-btn--primary"
                    onClick={submitEmployeeLink}
                    disabled={busy || !selectedEmployeeId}
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