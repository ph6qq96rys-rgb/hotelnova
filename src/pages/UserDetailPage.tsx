// src/pages/security/UserDetailPage.tsx

import { useNavigate, useParams } from "react-router-dom";
import { Can } from "../auth/Can";
import { useUser } from "../modules/security/hooks/useUsers";
import { AssignRoleButton } from "../modules/security/components/AssignRoleButton";
import { UserAssignmentsTable } from "../modules/security/components/UserAssignmentsTable";
import "./security.css";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
}

export default function UserDetailPage() {
  const navigate    = useNavigate();
  const { userId }  = useParams<{ userId: string }>();
  const { companyId } = useParams<{ companyId?: string }>();

  const { user, refresh, loading, error } = useUser(companyId ?? "", userId!);

  // Loading state
  if (loading) {
    return (
      <div className="sec-page">
        <div className="sec-placeholder">Loading user…</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="sec-page">
        <div className="sec-alert sec-alert--error" role="alert">{error}</div>
      </div>
    );
  }

  // Not found
  if (!user) {
    return (
      <div className="sec-page">
        <div className="sec-guard">
          <div className="sec-guard__inner">
            <div className="sec-guard__icon">🔍</div>
            <div className="sec-guard__title">User not found</div>
            <div className="sec-guard__text">This user doesn't exist or you don't have access.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sec-page">
      {/* Header */}
      <div className="sec-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="sec-avatar" style={{ width: 48, height: 48, fontSize: 16 }} aria-hidden="true">
            {initials(user.fullName ?? "")}
          </div>
          <div>
            <p className="sec-kicker">Security · Users</p>
            <h1 className="sec-page-title" style={{ fontSize: 20 }}>{user.fullName}</h1>
            <p className="sec-page-subtitle" style={{ fontSize: 12, marginTop: 0 }}>{user.email}</p>
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

      {/* Access assignments card */}
      <div className="sec-card">
        <div className="sec-card__head">
          <div>
            <p className="sec-card__title">Access assignments</p>
            <p className="sec-card__subtitle">Branch-scoped role assignments for this user.</p>
          </div>
          <Can permission="roles.assign">
            <AssignRoleButton userId={user.id} onAssigned={refresh} />
          </Can>
        </div>
        <div className="sec-card__body">
          <UserAssignmentsTable assignments={user.assignments} />
        </div>
      </div>
    </div>
  );
}