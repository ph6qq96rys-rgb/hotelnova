// src/modules/security/pages/UserDetailPage.tsx

import { useNavigate, useParams } from "react-router-dom";
import { Can } from "../../../auth/Can";
import { useUser } from "../hooks/useUsers";
import "./security.css";

function initials(value?: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/[\s.@_-]+/)
    .filter(Boolean);

  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? ""))
    .toUpperCase();
}

export default function UserDetailPage() {
  const navigate = useNavigate();
  const { companyId, userId } = useParams<{
    companyId: string;
    userId: string;
  }>();

  const { user, loading, error } = useUser(companyId ?? "", userId ?? "");

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
        <div className="sec-placeholder">Loading user…</div>
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
            <div className="sec-guard__icon">🔍</div>
            <div className="sec-guard__title">User not found</div>
            <div className="sec-guard__text">
              This user does not exist or you do not have access.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.fullName || user.fullName || user.email || "User";
  const roles = ((user as any).roles ?? (user as any).roleNames ?? []) as string[];

  return (
    <div className="sec-page">
      <div className="sec-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            className="sec-avatar"
            style={{ width: 48, height: 48, fontSize: 16 }}
            aria-hidden="true"
          >
            {initials(displayName)}
          </div>

          <div>
            <p className="sec-kicker">Security · Users</p>
            <h1 className="sec-page-title" style={{ fontSize: 20 }}>
              {displayName}
            </h1>
            <p className="sec-page-subtitle" style={{ fontSize: 12, marginTop: 0 }}>
              {user.email ?? "No email"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="sec-btn sec-btn--outline"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <Can permission="users.manage">
            <button type="button" className="sec-btn sec-btn--danger">
              Suspend user
            </button>
          </Can>
        </div>
      </div>

      <div className="sec-card">
        <div className="sec-card__head">
          <div>
            <p className="sec-card__title">User profile</p>
            <p className="sec-card__subtitle">
              Identity, status, employee link, and operational access.
            </p>
          </div>
        </div>

        <div className="sec-card__body">
          <div className="sec-detail-grid">
            <div>
              <div className="sec-muted">Username</div>
              <strong>{user.fullName ?? "—"}</strong>
            </div>

            <div>
              <div className="sec-muted">Status</div>
              <strong>{user.status ? "Active" : "Disabled"}</strong>
            </div>

            <div>
              <div className="sec-muted">Employee</div>
              <strong>
                {(user as any).employeeName ??
                  (user as any).employeeFullName ??
                  "Not linked"}
              </strong>
            </div>

            <div>
              <div className="sec-muted">Default stock location</div>
              <strong>
                {(user as any).stockLocationName ??
                  (user as any).defaultStockLocationName ??
                  "No location"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="sec-card">
        <div className="sec-card__head">
          <div>
            <p className="sec-card__title">Assigned roles</p>
            <p className="sec-card__subtitle">
              Roles currently attached to this user.
            </p>
          </div>
        </div>

        <div className="sec-card__body">
          {roles.length === 0 ? (
            <div className="sec-placeholder">No roles assigned.</div>
          ) : (
            <div className="sec-chip-list">
              {roles.map((role) => (
                <span key={role} className="sec-chip">
                  {role}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}