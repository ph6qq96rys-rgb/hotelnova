// src/modules/security/components/UsersTable.tsx

import type { UserDto } from "../api/securityApi";

type UsersTableProps = {
  items: UserDto[];
  onEdit: (user: UserDto) => void;
  onToggleActive: (user: UserDto) => void;
  onResetPassword: (user: UserDto) => void;
  onLinkEmployee?: (user: UserDto) => void;
  busy?: boolean;
};

function safe(value?: string | null): string {
  return value?.trim() || "—";
}

function initials(value?: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2);

  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? ""))
    .toUpperCase();
}

function rolesOf(user: UserDto): string[] {
  return (((user as any).roles ?? (user as any).roleNames ?? []) as string[])
    .filter(Boolean)
    .map(String);
}

function hasRole(user: UserDto, roleName: string): boolean {
  return rolesOf(user).some(
    (role) => role.toLowerCase() === roleName.toLowerCase()
  );
}

function displayUser(user: UserDto): string {
  return (
    user.fullName?.trim() ||
    user.userName?.trim() ||
    user.email?.trim() ||
    user.id
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

function locationLabel(user: UserDto): string {
  const name =
    (user as any).stockLocationName ??
    (user as any).defaultStockLocationName ??
    null;

  const code =
    (user as any).stockLocationCode ??
    (user as any).defaultStockLocationCode ??
    null;

  if (name && code) return `${code} · ${name}`;
  return name ?? code ?? "No location";
}

function warehouseAccessLabel(user: UserDto): string {
  const flags: string[] = [];

  if ((user as any).canSubmitWarehouseRequests) flags.push("Request");
  if ((user as any).canApproveWarehouseRequests) flags.push("Approve");
  if ((user as any).canIssueStock) flags.push("Issue");

  return flags.length ? flags.join(" / ") : "—";
}

function StatusPill({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={[
        "lux-status",
        ok ? "lux-status--ok" : "lux-status--muted",
      ].join(" ")}
    >
      <span className="lux-status__dot" />
      {children}
    </span>
  );
}

export default function UsersTable({
  items,
  onEdit,
  onToggleActive,
  onResetPassword,
  onLinkEmployee,
  busy = false,
}: UsersTableProps) {
  if (!items.length) {
    return (
      <div className="lux-emptyInline">
        <div className="lux-emptyInline__title">No users found</div>
        <div className="lux-emptyInline__hint">
          Try adjusting your filters.
        </div>
      </div>
    );
  }

  return (
    <div className="lux-table">
      <div
        className="lux-table__scroll"
        role="region"
        aria-label="Users table"
      >
        <table className="lux-table__el">
          <thead>
            <tr>
              <th>User</th>
              <th>Employee</th>
              <th>Default Location</th>
              <th>Warehouse Access</th>
              <th>Status</th>
              <th className="lux-text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((user) => {
              const userLabel = displayUser(user);
              const employee = employeeLabel(user);
              const location = locationLabel(user);
              const systemAdmin = hasRole(user, "SystemAdmin");

              const isEmployeeLinked = employee !== "Not linked";
              const hasDefaultLocation = location !== "No location";

              return (
                <tr
                  key={user.id}
                  className={busy ? "is-busy" : undefined}
                >
                  <td>
                    <div className="lux-userCell">
                      <div className="lux-avatar" aria-hidden="true">
                        {initials(userLabel)}
                      </div>

                      <div className="lux-userCell__meta">
                        <div className="lux-userCell__title">
                          {userLabel}
                        </div>
                        <div className="lux-userCell__sub">
                          {safe(user.email)}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <StatusPill ok={isEmployeeLinked}>
                      {employee}
                    </StatusPill>
                  </td>

                  <td>
                    <StatusPill ok={hasDefaultLocation}>
                      {location}
                    </StatusPill>
                  </td>

                  <td className="lux-mono">
                    {warehouseAccessLabel(user)}
                  </td>

                  <td>
                    <StatusPill ok={Boolean(user.isActive)}>
                      {user.isActive ? "Active" : "Disabled"}
                    </StatusPill>
                  </td>

                  <td className="lux-text-right">
                    <div className="lux-actions">
                      <button
                        className="lux-btn lux-btn--soft lux-btn--sm"
                        type="button"
                        onClick={() => onEdit(user)}
                        disabled={busy}
                      >
                        Edit
                      </button>

                      <button
                        className="lux-btn lux-btn--sm"
                        type="button"
                        onClick={() => onToggleActive(user)}
                        disabled={busy || systemAdmin}
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>

                      {onLinkEmployee && (
                        <button
                          className="lux-btn lux-btn--soft lux-btn--sm"
                          type="button"
                          onClick={() => onLinkEmployee(user)}
                          disabled={busy || systemAdmin}
                        >
                          Employee
                        </button>
                      )}

                      <button
                        className="lux-btn lux-btn--danger lux-btn--sm"
                        type="button"
                        onClick={() => onResetPassword(user)}
                        disabled={busy}
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