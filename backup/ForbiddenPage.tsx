// src/pages/ForbiddenPage.tsx

import { Link } from "react-router-dom";
import "./security.css";

export default function ForbiddenPage() {
  return (
    <div className="sec-error-page">
      <div className="sec-error-card">
        <div className="sec-error-code" aria-hidden="true">403</div>
        <h1 className="sec-error-title">Access denied</h1>
        <p className="sec-error-text">
          You don't have permission to view this page. Contact your administrator
          if you believe this is a mistake.
        </p>
        <Link to="/" className="sec-btn sec-btn--primary" style={{ display: "inline-flex" }}>
          Go to home
        </Link>
      </div>
    </div>
  );
}