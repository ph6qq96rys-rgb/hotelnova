// src/pages/security/RolesPage.tsx

import "./security.css";

// This page will list roles and manage role-permission assignments.
// Stub intentionally kept minimal — wire up securityApi.listRoles() when ready.

export default function RolesPage() {
  return (
    <div className="sec-page">
      <div className="sec-page-header">
        <div>
          <p className="sec-kicker">Security · Access</p>
          <h1 className="sec-page-title">Roles</h1>
          <p className="sec-page-subtitle">
            Define roles and manage the permissions assigned to each role.
          </p>
        </div>
        <button type="button" className="sec-btn sec-btn--primary">
          + New role
        </button>
      </div>

      <div className="sec-card">
        <div className="sec-card__head">
          <div>
            <p className="sec-card__title">Role catalogue</p>
            <p className="sec-card__subtitle">All roles available in this company.</p>
          </div>
        </div>
        <div className="sec-placeholder">
          Role list coming soon. Connect <code>securityApi.listRoles()</code> to populate this table.
        </div>
      </div>
    </div>
  );
}