import type { UserDto } from "../types";

type UsersTableProps = {
  items: UserDto[];
  onEdit: (user: UserDto) => void;
  onToggleActive: (user: UserDto) => void;
  onResetPassword: (user: UserDto) => void;
  onLinkEmployee?: (user: UserDto) => void;
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

function hasSystemAdminRole(user: UserDto): boolean {
  const roles = ((user as any).roles ?? (user as any).roleNames ?? []) as string[];

  return roles.some(
    (role) => String(role).toLowerCase() === "systemadmin"
  );
}

function employeeLabel(user: UserDto): string {
  const employeeName =
    (user as any).employeeName ??
    (user as any).employeeFullName ??
    null;

  const employeeCode = (user as any).employeeCode ?? null;

  if (employeeName && employeeCode) return `${employeeCode} · ${employeeName}`;
  if (employeeName) return employeeName;
  if (employeeCode) return employeeCode;

  return "Not linked";
}

export default function UsersTable({
  items,
  onEdit,
  onToggleActive,
  onResetPassword,
  onLinkEmployee,
  busy = false,
}: UsersTableProps) {
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
              <th style={{ width: 300 }}>User</th>
              <th>Email</th>
              <th style={{ width: 220 }}>Username</th>
              <th style={{ width: 220 }}>Employee</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 380, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((u) => {
              const title = safe(u.userName ?? u.email);
              const subtitle = safe(u.email);
              const uname = safe(u.userName);
              const isSystemAdmin = hasSystemAdminRole(u);

              return (
                <tr key={u.id} className={busy ? "is-busy" : undefined}>
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

                  <td className="lux-mono">{safe(u.email)}</td>

                  <td className="lux-mono">{uname}</td>

                  <td>
                    <span
                      className={[
                        "lux-status",
                        employeeLabel(u) === "Not linked"
                          ? "lux-status--muted"
                          : "lux-status--ok",
                      ].join(" ")}
                      title={employeeLabel(u)}
                    >
                      <span className="lux-status__dot" aria-hidden="true" />
                      {employeeLabel(u)}
                    </span>
                  </td>

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
                        onClick={() => onToggleActive(u)}
                        disabled={busy || isSystemAdmin}
                        title={
                          isSystemAdmin
                            ? "SystemAdmin cannot be disabled here"
                            : u.isActive
                            ? "Disable user"
                            : "Enable user"
                        }
                      >
                        {u.isActive ? "Disable" : "Enable"}
                      </button>

                      {onLinkEmployee && (
                        <button
                          className="lux-btn lux-btn--soft lux-btn--sm"
                          type="button"
                          onClick={() => onLinkEmployee(u)}
                          disabled={busy || isSystemAdmin}
                          title={
                            isSystemAdmin
                              ? "SystemAdmin cannot be linked to employee"
                              : "Link employee"
                          }
                        >
                          Employee
                        </button>
                      )}

                      <button
                        className="lux-btn lux-btn--danger lux-btn--sm"
                        type="button"
                        onClick={() => onResetPassword(u)}
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

      {busy && (
        <div className="lux-table__foot" aria-live="polite">
          Working…
        </div>
      )}
    </div>
  );
}