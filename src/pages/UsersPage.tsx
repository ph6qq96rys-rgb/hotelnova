// src/pages/security/UsersPage.tsx

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Can } from "../auth/Can";
import { useUsers } from "../modules/security/hooks/useUsers";
import { useAppScope } from "../app/useAppScope";
import "./security.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserStatus = "Active" | "Pending" | "Disabled" | "Inactive" | string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadgeClass(status: UserStatus): string {
  switch (status) {
    case "Active":   return "sec-badge sec-badge--success";
    case "Pending":  return "sec-badge sec-badge--warning";
    default:         return "sec-badge sec-badge--neutral";
  }
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i}>
          <td style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="sec-skeleton" style={{ width: 34, height: 34, borderRadius: "999px" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="sec-skeleton" style={{ width: 140, height: 10 }} />
                <span className="sec-skeleton" style={{ width: 100, height: 8 }} />
              </div>
            </div>
          </td>
          <td style={{ padding: "12px 16px" }}><span className="sec-skeleton" style={{ width: 180, height: 10 }} /></td>
          <td style={{ padding: "12px 16px" }}><span className="sec-skeleton" style={{ width: 60,  height: 18, borderRadius: 999 }} /></td>
          <td style={{ padding: "12px 16px", textAlign: "right" }}><span className="sec-skeleton" style={{ width: 24, height: 10 }} /></td>
        </tr>
      ))}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const navigate    = useNavigate();
  const { companyId } = useAppScope();
  const { users = [], loading, error } = useUsers(companyId);

  const isEmpty = useMemo(
    () => !loading && !error && users.length === 0,
    [loading, error, users.length]
  );

  if (!companyId) {
    return (
      <div className="sec-page">
        <div className="sec-guard">
          <div className="sec-guard__inner">
            <div className="sec-guard__icon">👥</div>
            <div className="sec-guard__title">No company selected</div>
            <div className="sec-guard__text">Select a company to manage users.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sec-page">
      {/* Header */}
      <div className="sec-page-header">
        <div>
          <p className="sec-kicker">Security · Identity</p>
          <h1 className="sec-page-title">Users</h1>
          <p className="sec-page-subtitle">Manage people and their access enrollment.</p>
        </div>
        <div>
          <Can permission="users.manage">
            <button
              type="button"
              className="sec-btn sec-btn--primary"
              onClick={() => navigate("/security/users/invite")}
            >
              Invite user
            </button>
          </Can>
        </div>
      </div>

      {/* Table card */}
      <div className="sec-card">
        <div className="sec-card__head">
          <div>
            <p className="sec-card__title">User register</p>
            <p className="sec-card__subtitle">{loading ? "Loading…" : `${users.length} user${users.length !== 1 ? "s" : ""}`}</p>
          </div>
        </div>

        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th className="right" />
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows />}

              {!loading && error && (
                <tr>
                  <td colSpan={4}>
                    <div className="sec-placeholder" style={{ color: "#dc2626" }}>
                      Failed to load users: {error}
                    </div>
                  </td>
                </tr>
              )}

              {isEmpty && (
                <tr>
                  <td colSpan={4}>
                    <div className="sec-placeholder">
                      No users yet. Invite your first user to get started.
                    </div>
                  </td>
                </tr>
              )}

              {!loading && !error && users.map((u) => (
                <tr
                  key={u.id}
                  className="is-clickable"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${u.fullName}`}
                  onClick={() => navigate(`/security/users/${u.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/security/users/${u.id}`);
                    }
                  }}
                >
                  <td>
                    <div className="sec-user-cell">
                      <div className="sec-avatar" aria-hidden="true">{initials(u.fullName ?? "")}</div>
                      <div>
                        <div className="sec-user-name">{u.fullName}</div>
                        <div className="sec-user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={statusBadgeClass(u.status)}>{u.status}</span>
                  </td>
                  <td style={{ textAlign: "right", color: "#94a3b8" }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}