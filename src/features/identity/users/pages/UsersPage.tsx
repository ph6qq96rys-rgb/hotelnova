import { useMemo, useState } from "react";
import { usersApi } from "../api/usersApi";
import { useUsers } from "../hooks/useUsers";
import type { CreateUserDto, UpdateUserDto, UserDto } from "../types";
import UsersTable from "../components/UsersTable";
import UserForm from "../components/UserForm";
import "../../../../styles/modules.identity.css"

type Modal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; user: UserDto };

export default function UsersPage() {
  const { filter, setFilter, data, loading, error, refresh, canPrev, canNext } =
    useUsers({ page: 1, pageSize: 10 });

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);

  const closeModal = () => setModal({ kind: "none" });

  const onCreate = async (dto: CreateUserDto) => {
    try {
      setBusy(true);
      await usersApi.create(dto);
      closeModal();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onEditSubmit = async (dto: UpdateUserDto) => {
    if (modal.kind !== "edit") return;

    try {
      setBusy(true);
      await usersApi.update(modal.user.id, dto);
      closeModal();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onToggleActive = async (u: UserDto) => {
    try {
      setBusy(true);
      await usersApi.setActive(u.id, !u.isActive);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onResetPassword = async (u: UserDto) => {
    const newPassword = prompt(
      `Enter new password for ${u.email ?? u.userName ?? u.id}:`
    );
    if (!newPassword) return;

    try {
      setBusy(true);
      await usersApi.resetPassword(u.id, newPassword);
      alert("Password updated.");
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
            Create users, assign roles, and manage scope (company/branch/store).
          </p>
        </div>

        <div className="lux-hero__actions">
          <div className="lux-search">
            <span className="lux-search__icon">⌕</span>
            <input
              className="lux-input lux-input--search"
              placeholder="Search users by name or email…"
              value={filter.q ?? ""}
              onChange={(e) =>
                setFilter((f) => ({ ...f, q: e.target.value, page: 1 }))
              }
            />
          </div>

          <button
            className="lux-btn lux-btn--primary"
            onClick={() => setModal({ kind: "create" })}
            disabled={busy}
          >
            + New User
          </button>
        </div>
      </div>
    </div>

    {error ? (
      <div className="lux-alert lux-alert--danger">
        <strong>Error:</strong> {error?.message ?? "Request failed"} (HTTP{" "}
        {(error as any)?.status ?? "?"})
      </div>
    ) : null}

    {loading ? <div className="lux-muted">Loading…</div> : null}

    <div className="lux-card">
      <div className="lux-card__header">
        <div>
          <div className="lux-card__title">Users</div>
          <div className="lux-card__hint">{items.length} results</div>
        </div>

        <div className="lux-card__tools">
          <button className="lux-btn lux-btn--soft" disabled={busy} onClick={() => refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Keep your existing table component */}
      <div className="lux-tableWrap">
        <UsersTable
          items={items}
          onEdit={(u) => setModal({ kind: "edit", user: u })}
          onToggleActive={onToggleActive}
          onResetPassword={onResetPassword}
          busy={busy}
        />
      </div>
    </div>

    <div className="lux-pager">
      <button
        className="lux-btn"
        disabled={!canPrev || busy}
        onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
      >
        Prev
      </button>

      <span className="lux-muted">
        Page {data?.page ?? filter.page ?? 1} /{" "}
        {data ? Math.max(1, Math.ceil(data.total / (data.pageSize || 10))) : "?"}
      </span>

      <button
        className="lux-btn"
        disabled={!canNext || busy}
        onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
      >
        Next
      </button>
    </div>

    {modal.kind !== "none" ? (
      <div className="lux-modalOverlay" onClick={() => !busy && closeModal()}>
        <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
          {modal.kind === "create" ? (
            <UserForm mode="create" onSubmit={onCreate} onCancel={closeModal} busy={busy} />
          ) : (
            <UserForm mode="edit" initial={modal.user} onSubmit={onEditSubmit} onCancel={closeModal} busy={busy} />
          )}
        </div>
      </div>
    ) : null}
  </div>
);
}
