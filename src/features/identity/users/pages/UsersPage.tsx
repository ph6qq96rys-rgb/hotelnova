import { useEffect, useMemo, useRef, useState } from "react";
import { usersApi } from "../api/usersApi";
import { useUsers } from "../hooks/useUsers";
import type { CreateUserDto, UserDto } from "../types";
import UsersTable from "../components/UsersTable";
import UserForm from "../components/UserForm";
import "../../../../styles/modules.identity.css";
import { useAppScope } from "../../../../app/useAppScope";

type Modal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; user: UserDto }
  | { kind: "resetPassword"; user: UserDto };

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

export default function UsersPage() {
  const { companyId,branchId } = useAppScope();

  const { filter, setFilter, data, loading, error, refresh, canPrev, canNext } =
    useUsers(companyId, { page: 1, pageSize: 10 });

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [busy, setBusy] = useState(false);

  // Local search input (debounced -> updates filter.q)
  const [searchText, setSearchText] = useState(filter.q ?? "");
  const debouncedSearch = useDebouncedValue(searchText, 350);

  useEffect(() => {
    setFilter((f) => ({ ...f, q: debouncedSearch || undefined, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep input in sync if filter.q changes elsewhere
  useEffect(() => {
    setSearchText(filter.q ?? "");
  }, [filter.q]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const page = data?.page ?? filter.page ?? 1;
  const pageSize = data?.pageSize ?? filter.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  const closeModal = () => setModal({ kind: "none" });

  // ESC to close modal (when not busy)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal.kind !== "none" && !busy) closeModal();
      // Cmd/Ctrl+K focuses search (nice admin UX)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        const el = document.getElementById("users-search");
        (el as HTMLInputElement | null)?.focus?.();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.kind, busy]);

  const onCreate = async (dto: CreateUserDto) => {
    try {
      setBusy(true);
      dto.branchId = branchId ? branchId : null;
      await usersApi.create(companyId, dto);
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
    try {
      setBusy(true);
      await usersApi.setActive(companyId, u.id, !u.isActive);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  // Password reset modal state
  const [newPassword, setNewPassword] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (modal.kind === "resetPassword") {
      setNewPassword("");
      setTimeout(() => passwordInputRef.current?.focus(), 0);
    }
  }, [modal.kind]);

  const onResetPassword = async (u: UserDto) => {
    setModal({ kind: "resetPassword", user: u });
  };

  const submitResetPassword = async () => {
    if (modal.kind !== "resetPassword") return;
    const pw = newPassword.trim();
    if (pw.length < 6) return;
    try {
      setBusy(true);
      await usersApi.resetPassword(companyId, modal.user.id, pw);
      closeModal();
      // Keep your alert if you don't have toasts yet
      // eslint-disable-next-line no-alert
      alert("Password updated.");
    } finally {
      setBusy(false);
    }
  };

  const showEmpty = !loading && !error && items.length === 0;

  const shownCountText = loading ? "Loading…" : `${items.length} shown • ${total} total`;
  const pageSafe = clamp(page, 1, pageCount);

  return (
    <div className="lux-page">
      {/* HERO */}
      <div className="lux-hero">
        <div className="lux-hero__bg" />
        <div className="lux-hero__content">
          <div>
            <div className="lux-kicker">Identity</div>
            <h1 className="lux-title">User Management</h1>
            <p className="lux-subtitle">
              Create users, manage access, and maintain operational hygiene.
            </p>

            {/* Stats ribbon (feels premium, improves scanning) */}
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
              {(filter.q ?? "").trim() ? (
                <span className="lux-chip lux-chip--soft">
                  Filter: <strong>{filter.q}</strong>
                </span>
              ) : null}
            </div>
          </div>

          <div className="lux-hero__actions">
            <div className="lux-search" role="search" aria-label="Search users">
              <span className="lux-search__icon" aria-hidden="true">
                ⌕
              </span>
              <input
                id="users-search"
                className="lux-input lux-input--search"
                placeholder="Search users by name or email…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={busy}
              />
              <span className="lux-kbd" aria-hidden="true">
                ⌘K
              </span>
              {searchText ? (
                <button
                  className="lux-iconBtn"
                  type="button"
                  onClick={() => setSearchText("")}
                  disabled={busy}
                  aria-label="Clear search"
                  title="Clear"
                >
                  ×
                </button>
              ) : null}
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

      {/* ERROR */}
      {error ? (
        <div className="lux-alert lux-alert--danger" role="alert">
          <div className="lux-alert__row">
            <div>
              <strong>Error:</strong>{" "}
              {error?.message ?? "Request failed"} (HTTP{" "}
              {(error as any)?.status ?? "?"})
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
      ) : null}

      {/* TABLE CARD */}
      <div className="lux-card">
        <div className="lux-card__header">
          <div>
            <div className="lux-card__title">Users</div>
            <div className="lux-card__hint">{shownCountText}</div>
          </div>

          <div className="lux-card__tools">
            <button
              className="lux-btn lux-btn--soft"
              disabled={busy}
              onClick={() => refresh()}
              type="button"
              title="Refresh data"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="lux-tableWrap">
          {/* Premium “veil” loading state (less jarring than swapping whole UI) */}
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
                onResetPassword={onResetPassword}
                busy={busy}
              />
            )}

            {loading ? (
              <div className="lux-veil" aria-hidden="true">
                <div className="lux-spinner" />
                <div className="lux-muted">Loading users…</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* PAGER */}
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

      {/* MODAL */}
      {modal.kind !== "none" ? (
        <div
          className="lux-modalOverlay"
          onClick={() => !busy && closeModal()}
          role="dialog"
          aria-modal="true"
          aria-label={
            modal.kind === "create"
              ? "Create user"
              : modal.kind === "edit"
              ? "Edit user"
              : "Reset password"
          }
        >
          <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
            {/* Subtle busy bar for luxury feel */}
            {busy ? <div className="lux-modalBusy" aria-hidden="true" /> : null}

            {modal.kind === "create" ? (
              <UserForm
                mode="create"
                onSubmit={onCreate}
                onCancel={closeModal}
                busy={busy}
              />
            ) : modal.kind === "edit" ? (
              <UserForm
                mode="edit"
                initial={modal.user}
                onSubmit={onEditSubmit}
                onCancel={closeModal}
                busy={busy}
              />
            ) : (
              <div className="lux-resetPw">
                <div className="lux-resetPw__title">Reset password</div>
                <div className="lux-resetPw__subtitle">
                  For{" "}
                  <strong>
                    {modal.user.email ?? modal.user.userName ?? modal.user.id}
                  </strong>
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
                    disabled={busy || newPassword.trim().length < 6}
                    type="button"
                  >
                    Update password
                  </button>
                </div>

                <div className="lux-hint">
                  Tip: Use at least 6 characters (your server policy still
                  applies).
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
