// src/modules/security/pages/UserDetailPage.tsx

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Can } from "../../../auth/Can";
import { useAuth } from "../../../auth/AuthProvider";
import { securityApi } from "../api/securityApi";
import { useUser } from "../hooks/useUsers";
import { extractSecurityError } from "../utils/security.utils";
import { fmtDateTime } from "../../../features/hr/utils/hrUtils";

import "./security.css";

type RoleActor = {
  roles?: string[];
  roleNames?: string[];
  companyId?: string | null;
};

type AccessChip = {
  id: string;
  label: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function initials(value?: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/[\s.@_-]+/)
    .filter(Boolean);

  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function rolesOf(value: unknown): string[] {
  const row = value as any;

  return (((row?.roles ?? row?.roleNames ?? []) as string[]) || [])
    .filter(Boolean)
    .map(String);
}

function hasRole(value: unknown, roleName: string): boolean {
  return rolesOf(value).some(
    (role) => role.toLowerCase() === roleName.toLowerCase()
  );
}

function isSystemAdminUser(value: unknown): boolean {
  return hasRole(value, "SystemAdmin") || hasRole(value, "SysAdmin");
}

function isCompanyAdminUser(value: unknown): boolean {
  return hasRole(value, "CompanyAdmin");
}

function actorCanManageTarget(
  actor: RoleActor | null | undefined,
  target: unknown,
  hasPermission?: (permission: string) => boolean
): boolean {
  const actorIsSystemAdmin = isSystemAdminUser(actor);
  const actorIsCompanyAdmin = isCompanyAdminUser(actor);

  const targetIsSystemAdmin = isSystemAdminUser(target);
  const targetIsCompanyAdmin = isCompanyAdminUser(target);

  if (actorIsSystemAdmin) return true;
  if (targetIsSystemAdmin || targetIsCompanyAdmin) return false;

  return (
    actorIsCompanyAdmin ||
    Boolean(hasPermission?.("users.update"))
  );
}

function userDisplayName(user: any): string {
  return (
    user?.fullName ||
    user?.employee?.fullName ||
    user?.userName ||
    user?.email ||
    "User"
  );
}

function employeeName(user: any): string {
  return (
    user?.employeeName ||
    user?.employeeFullName ||
    user?.employee?.fullName ||
    "Not linked"
  );
}

function statusText(user: any): string {
  return user?.isActive ? "Active" : "Inactive";
}

function fmtDate(value: unknown): string {
  return fmtDateTime(value ? String(value) : null);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

function accessLabel(value: any, fallbackPrefix: string): string {
  if (typeof value === "string") return value;

  return (
    clean(value?.name) ||
    clean(value?.branchName) ||
    clean(value?.stockLocationName) ||
    clean(value?.storeName) ||
    clean(value?.code) ||
    clean(value?.id) ||
    fallbackPrefix
  );
}

function accessId(value: any): string {
  return clean(value?.id ?? value?.branchId ?? value?.stockLocationId ?? value);
}

function accessDescription(value: any): string | null {
  if (typeof value === "string") return null;

  return (
    clean(value?.code) ||
    clean(value?.city) ||
    clean(value?.type) ||
    clean(value?.locationType) ||
    null
  );
}

function normalizeAccess(values: unknown, fallbackPrefix: string): AccessChip[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value, index) => ({
      id: accessId(value) || `${fallbackPrefix}-${index}`,
      label: accessLabel(value, fallbackPrefix),
      description: accessDescription(value),
      isDefault: Boolean((value as any)?.isDefault || (value as any)?.isPrimary),
      isActive:
        typeof (value as any)?.isActive === "boolean"
          ? (value as any).isActive
          : null,
    }))
    .filter((x) => x.label);
}

function getBranchAccess(user: any): AccessChip[] {
  return normalizeAccess(user?.branches ?? user?.branchAccess ?? user?.branchIds, "Branch");
}

function getStockLocationAccess(user: any): AccessChip[] {
  return normalizeAccess(
    user?.stockLocations ?? user?.stockLocationAccess ?? user?.stockLocationIds,
    "Stock location"
  );
}

function getStoreAccess(user: any): AccessChip[] {
  return normalizeAccess(user?.stores ?? user?.storeAccess ?? user?.storeIds, "Store");
}

function accountType(user: unknown): string {
  if (isSystemAdminUser(user)) return "SystemAdmin";
  if (isCompanyAdminUser(user)) return "CompanyAdmin";
  return "Company User";
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <div className="sec-muted">{label}</div>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="sec-card" style={{ margin: 0 }}>
      <div className="sec-card__body" style={{ padding: 14 }}>
        <div className="sec-muted" style={{ textTransform: "uppercase", fontSize: 11 }}>
          {label}
        </div>
        <strong style={{ display: "block", fontSize: 20, marginTop: 4 }}>{value}</strong>
        {hint && <div className="sec-muted" style={{ marginTop: 4 }}>{hint}</div>}
      </div>
    </div>
  );
}

function AccessList({ values, empty }: { values: AccessChip[]; empty: string }) {
  if (values.length === 0) {
    return <div className="sec-placeholder">{empty}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {values.map((value) => (
        <div
          key={value.id}
          className="sec-card"
          style={{ margin: 0, borderRadius: 12 }}
        >
          <div className="sec-card__body" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong>{value.label}</strong>
                {value.description && (
                  <div className="sec-muted" style={{ marginTop: 2 }}>{value.description}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {value.isDefault && <span className="sec-chip">Default</span>}
                {value.isActive === false && <span className="sec-chip">Inactive</span>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChipList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <div className="sec-placeholder">{empty}</div>;
  }

  return (
    <div className="sec-chip-list">
      {values.map((value) => (
        <span key={value} className="sec-chip">
          {value}
        </span>
      ))}
    </div>
  );
}

export default function UserDetailPage() {
  const navigate = useNavigate();
  const { companyId, userId } = useParams<{
    companyId: string;
    userId: string;
  }>();

  const { hasPermission, user: currentUser } = useAuth() as any;
  const { user, loading, error, reload } = useUser(
    companyId ?? "",
    userId ?? ""
  ) as any;

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const currentIsSystemAdmin = isSystemAdminUser(currentUser);

  const displayName = userDisplayName(user);
  const roles = useMemo(() => rolesOf(user), [user]);
  const branchAccess = useMemo(() => getBranchAccess(user), [user]);
  const stockLocationAccess = useMemo(() => getStockLocationAccess(user), [user]);
  const storeAccess = useMemo(() => getStoreAccess(user), [user]);

  const selectedIsSystemAdmin = isSystemAdminUser(user);
  const selectedIsCompanyAdmin = isCompanyAdminUser(user);

  const canManageSelectedUser =
    Boolean(user) && actorCanManageTarget(currentUser, user, hasPermission);

  const governanceFlags = useMemo(() => {
    const flags: string[] = [];

    if (selectedIsSystemAdmin) flags.push("Platform administrator account");
    if (selectedIsCompanyAdmin) flags.push("Company administrator account");
    if (!user?.isActive) flags.push("Account inactive");
    if (roles.length === 0) flags.push("No roles assigned");
    if (branchAccess.length === 0 && !selectedIsSystemAdmin) flags.push("No branch access");
    if (stockLocationAccess.length === 0 && !selectedIsSystemAdmin) flags.push("No stock-location access");
    if (!user?.employeeId && !user?.employee?.id) flags.push("No employee link");

    return flags;
  }, [branchAccess.length, roles.length, selectedIsCompanyAdmin, selectedIsSystemAdmin, stockLocationAccess.length, user]);

  async function toggleActive() {
    if (!companyId || !userId || !user || !canManageSelectedUser) return;

    setBusy(true);
    setActionError(null);
    setNotice(null);

    try {
      await securityApi.setUserActive(companyId, userId, !user.isActive);
      setNotice(user.isActive ? "User deactivated." : "User activated.");
      await reload?.();
    } catch (err) {
      setActionError(extractSecurityError(err, "Failed to update user status."));
    } finally {
      setBusy(false);
    }
  }

  async function submitResetPassword() {
    if (!companyId || !userId || !user || !canManageSelectedUser) return;

    const password = newPassword.trim();

    if (!isStrongPassword(password)) {
      setPasswordError(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number."
      );
      return;
    }

    setBusy(true);
    setActionError(null);
    setNotice(null);
    setPasswordError(null);

    try {
      await securityApi.resetUserPassword(companyId, userId, password);
      setPasswordModalOpen(false);
      setNewPassword("");
      setNotice("Password reset successfully.");
    } catch (err) {
      setActionError(extractSecurityError(err, "Failed to reset password."));
    } finally {
      setBusy(false);
    }
  }

  function openPasswordModal() {
    setActionError(null);
    setNotice(null);
    setPasswordError(null);
    setNewPassword("");
    setPasswordModalOpen(true);
  }

  if (!companyId || !userId) {
    return (
      <div className="sec-page">
        <div className="sec-alert sec-alert--error">
          Missing company or user context.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sec-page">
        <div className="sec-placeholder">Loading user security profile'</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sec-page">
        <div className="sec-alert sec-alert--error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="sec-page">
        <div className="sec-guard">
          <div className="sec-guard__inner">
            <div className="sec-guard__icon"></div>
            <div className="sec-guard__title">User not found</div>
            <div className="sec-guard__text">
              This user does not exist or you do not have access.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sec-page">
      <div className="sec-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            className="sec-avatar"
            style={{ width: 58, height: 58, fontSize: 18 }}
            aria-hidden="true"
          >
            {initials(displayName)}
          </div>

          <div>
            <p className="sec-kicker">Security '- User Control Center</p>
            <h1 className="sec-page-title" style={{ fontSize: 24 }}>
              {displayName}
            </h1>
            <p className="sec-page-subtitle" style={{ marginTop: 0 }}>
              {user.email ?? "No email"} '-'- {statusText(user)}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="sec-btn sec-btn--outline"
            onClick={() => navigate(-1)}
            disabled={busy}
          >
              Back
          </button>

          <Can permission="users.update">
            <button
              type="button"
              className="sec-btn"
              disabled={busy}
              onClick={() => navigate(`/companies/${companyId}/users`)}
            >
              User Register
            </button>

            <button
              type="button"
              className="sec-btn"
              disabled={busy || !canManageSelectedUser}
              onClick={openPasswordModal}
            >
              Reset Password
            </button>

            <button
              type="button"
              className={
                user.isActive
                  ? "sec-btn sec-btn--danger"
                  : "sec-btn sec-btn--primary"
              }
              disabled={busy || !canManageSelectedUser}
              onClick={toggleActive}
            >
              {user.isActive ? "Deactivate" : "Activate"}
            </button>
          </Can>
        </div>
      </div>

      {notice && (
        <div className="sec-alert sec-alert--success" role="status">
          {notice}
        </div>
      )}

      {actionError && (
        <div className="sec-alert sec-alert--error" role="alert">
          {actionError}
        </div>
      )}

      {selectedIsSystemAdmin && (
        <div className="sec-alert sec-alert--warning">
          This is a platform SystemAdmin account. Tenant-level user actions are restricted from this page.
        </div>
      )}

      {selectedIsCompanyAdmin && !currentIsSystemAdmin && (
        <div className="sec-alert sec-alert--warning">
          CompanyAdmin accounts can only be modified by SystemAdmin.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <MetricCard label="Status" value={statusText(user)} hint={user.isActive ? "Operational" : "Access blocked"} />
        <MetricCard label="Roles" value={roles.length} hint="Assigned role count" />
        <MetricCard label="Branches" value={branchAccess.length} hint="Operating scope" />
        <MetricCard label="Locations" value={stockLocationAccess.length} hint="Inventory scope" />
        <MetricCard label="Risk flags" value={governanceFlags.length} hint="Governance review" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 16 }}>
        <main style={{ display: "grid", gap: 16 }}>
          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Identity & account profile</p>
                <p className="sec-card__subtitle">
                  Master identity, employee linkage, login status, and ownership context.
                </p>
              </div>
              <span className="sec-chip">{accountType(user)}</span>
            </div>

            <div className="sec-card__body">
              <div className="sec-detail-grid">
                <DetailItem label="Username" value={user.userName} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Status" value={statusText(user)} />
                <DetailItem label="Employee" value={employeeName(user)} />
                <DetailItem label="Employee code" value={user.employeeCode ?? user.employee?.employeeCode} />
                <DetailItem label="Department" value={user.departmentName ?? user.employee?.departmentName} />
                <DetailItem label="Default store" value={user.storeName ?? user.storeId} />
                <DetailItem label="Account type" value={accountType(user)} />
              </div>
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Assigned roles</p>
                <p className="sec-card__subtitle">
                  Role memberships that drive this user&apos;s effective permissions.
                </p>
              </div>
            </div>

            <div className="sec-card__body">
              <ChipList values={roles} empty="No roles assigned. This user will have limited access." />
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Branch operating scope</p>
                <p className="sec-card__subtitle">
                  Branches where this user can transact, approve, or view records.
                </p>
              </div>
            </div>

            <div className="sec-card__body">
              <AccessList values={branchAccess} empty="No branches assigned." />
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Inventory and POS scope</p>
                <p className="sec-card__subtitle">
                  Stores and stock locations available for stock issue, receipt, transfer, sale, or production workflows.
                </p>
              </div>
            </div>

            <div className="sec-card__body" style={{ display: "grid", gap: 16 }}>
              <section>
                <div className="sec-muted" style={{ marginBottom: 8 }}>Stores / POS terminals</div>
                <AccessList values={storeAccess} empty="No stores assigned." />
              </section>

              <section>
                <div className="sec-muted" style={{ marginBottom: 8 }}>Stock locations</div>
                <AccessList values={stockLocationAccess} empty="No stock locations assigned." />
              </section>
            </div>
          </div>
        </main>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Security posture</p>
                <p className="sec-card__subtitle">Operational status and protection rules.</p>
              </div>
            </div>
            <div className="sec-card__body" style={{ display: "grid", gap: 12 }}>
              <DetailItem label="Manageable by you" value={canManageSelectedUser ? "Yes" : "No"} />
              <DetailItem label="Protected account" value={selectedIsSystemAdmin || selectedIsCompanyAdmin ? "Yes" : "No"} />
              <DetailItem label="Last login" value={fmtDate(user.lastLoginAtUtc ?? user.lastLoginAt)} />
              <DetailItem label="Password changed" value={fmtDate(user.passwordChangedAtUtc ?? user.passwordChangedAt)} />
              <DetailItem label="MFA" value={user.mfaEnabled === true ? "Enabled" : user.mfaEnabled === false ? "Disabled" : "-"} />
              <DetailItem label="Lockout" value={user.lockoutEnabled || user.lockedOut ? "Locked / controlled" : "Not locked"} />
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Governance checklist</p>
                <p className="sec-card__subtitle">Items to review before granting production access.</p>
              </div>
            </div>
            <div className="sec-card__body">
              {governanceFlags.length === 0 ? (
                <div className="sec-alert sec-alert--success">No obvious governance issues detected.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                  {governanceFlags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="sec-card">
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Audit metadata</p>
                <p className="sec-card__subtitle">Change trace available from the user record.</p>
              </div>
            </div>
            <div className="sec-card__body" style={{ display: "grid", gap: 12 }}>
              <DetailItem label="Created" value={fmtDate(user.createdAtUtc ?? user.createdAt)} />
              <DetailItem label="Created by" value={user.createdByName ?? user.createdBy} />
              <DetailItem label="Last modified" value={fmtDate(user.updatedAtUtc ?? user.modifiedAtUtc ?? user.updatedAt)} />
              <DetailItem label="Modified by" value={user.updatedByName ?? user.modifiedByName ?? user.updatedBy} />
            </div>
          </div>
        </aside>
      </div>

      {passwordModalOpen && (
        <div
          className="sec-modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setPasswordModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className="sec-card"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(520px, 100%)", margin: 0 }}
          >
            <div className="sec-card__head">
              <div>
                <p className="sec-card__title">Reset password</p>
                <p className="sec-card__subtitle">
                  Issue a new temporary password for {displayName}.
                </p>
              </div>
            </div>
            <div className="sec-card__body" style={{ display: "grid", gap: 14 }}>
              <label>
                <div className="sec-muted" style={{ marginBottom: 6 }}>New temporary password</div>
                <input
                  className="sec-input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Minimum 8 characters, uppercase, lowercase, number"
                  disabled={busy}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !busy) void submitResetPassword();
                  }}
                />
              </label>

              {passwordError && (
                <div className="sec-alert sec-alert--error">{passwordError}</div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="sec-btn sec-btn--outline"
                  disabled={busy}
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sec-btn sec-btn--primary"
                  disabled={busy || !isStrongPassword(newPassword.trim())}
                  onClick={submitResetPassword}
                >
                  {busy ? "Updating..." : "Update password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
