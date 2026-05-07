import type { UserDto } from "../types";

type Props = {
  items: UserDto[];
  onEdit: (u: UserDto) => void;
  onToggleActive: (u: UserDto) => Promise<void>;
  onResetPassword: (u: UserDto) => Promise<void>;
  busy?: boolean;
};

function safe(v?: string | null) {
  return v && v.trim().length ? v : "—";
}

function initials(nameOrEmail?: string | null) {
  const s = (nameOrEmail ?? "").trim();
  if (!s) return "U";
  const parts = s.split(/[\s.@_-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function UsersTable({
  items,
  onEdit,
  onToggleActive,
  onResetPassword,
  busy = false,
}: Props) {
  if (!items || items.length === 0) {
    return (
      <div className="lux-emptyInline">
        <div className="lux-emptyInline__title">No users found</div>
        <div className="lux-emptyInline__hint">Try adjusting your filters.</div>
      </div>
    );
  }

  return (
    <div className="lux-table">
      <div className="lux-table__scroll" role="region" aria-label="Users table">
        <table className="lux-table__el">
          <thead>
            <tr>
              <th style={{ width: 320 }}>User</th>
              <th>Email</th>
              <th style={{ width: 220 }}>Username</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 320, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((u) => {
              const title = safe(u.userName ?? u.email);
              const subtitle = safe(u.email);
              const uname = safe(u.userName);

              return (
                <tr key={u.id} className={busy ? "is-busy" : undefined}>
                  {/* User */}
                  <td>
                    <div className="lux-userCell">
                      <div className="lux-avatar" aria-hidden="true">
                        {initials(u.userName ?? u.email)}
                      </div>
                      <div className="lux-userCell__meta">
                        <div className="lux-userCell__title">{title}</div>
                        <div className="lux-userCell__sub">{subtitle}</div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="lux-mono">{safe(u.email)}</td>

                  {/* Username */}
                  <td className="lux-mono">{uname}</td>

                  {/* Status */}
                  <td>
                    <span
                      className={[
                        "lux-status",
                        u.isActive ? "lux-status--ok" : "lux-status--muted",
                      ].join(" ")}
                    >
                      <span className="lux-status__dot" aria-hidden="true" />
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: "right" }}>
                    <div className="lux-actions">
                      <button
                        className="lux-btn lux-btn--soft lux-btn--sm"
                        type="button"
                        onClick={() => onEdit(u)}
                        disabled={busy}
                        title="Edit user"
                      >
                        Edit
                      </button>

                      <button
                        className="lux-btn lux-btn--sm"
                        type="button"
                        onClick={() => void onToggleActive(u)}
                        disabled={busy}
                        title={u.isActive ? "Disable user" : "Enable user"}
                      >
                        {u.isActive ? "Disable" : "Enable"}
                      </button>

                      <button
                        className="lux-btn lux-btn--danger lux-btn--sm"
                        type="button"
                        onClick={() => void onResetPassword(u)}
                        disabled={busy}
                        title="Reset password"
                      >
                        Reset PW
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {busy ? (
        <div className="lux-table__foot" aria-live="polite">
          Working…
        </div>
      ) : null}
    </div>
  );
}
