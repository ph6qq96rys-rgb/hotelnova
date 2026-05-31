// src/pages/security/PermissionsPage.tsx

import "./security.css";

export default function PermissionsPage() {
  return (
    <div className="sec-page">
      <div className="sec-page-header">
        <div>
          <p className="sec-kicker">Security · Access</p>
          <h1 className="sec-page-title">Permissions</h1>
          <p className="sec-page-subtitle">
            Browse the full permission catalogue. Assign permissions to roles, not to users directly — except for overrides.
          </p>
        </div>
      </div>

      <div className="sec-card">
        <div className="sec-card__head">
          <div>
            <p className="sec-card__title">Permission catalogue</p>
            <p className="sec-card__subtitle">Grouped by domain module.</p>
          </div>
          <input
            className="sec-search"
            placeholder="Search permissions…"
            style={{ maxWidth: 260 }}
            readOnly
          />
        </div>
        <div className="sec-placeholder">
          Permission list coming soon. Connect <code>securityApi.listPermissions()</code> to populate.
        </div>
      </div>
    </div>
  );
}