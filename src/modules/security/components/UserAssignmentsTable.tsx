// src/modules/security/components/UserAssignmentsTable.tsx
//
// ── What was wrong in the original ──────────────────────────────────────────
// 1. Imported Table, Th, Td, Badge from ../../../components/ — these wrappers
//    don't exist in this codebase (they were from a different project).
//    Replaced with plain HTML table elements and sec-* CSS classes.
//
// 2. Imported Can from ../../../auth/Can — this is project-specific and kept,
//    but the import path may need adjusting based on final directory layout.
//
// 3. The scope badge logic was inverted:
//    variant={a.branchId ? "default" : "destructive"}
//    "destructive" (red) was used for COMPANY scope, which isn't an error —
//    it's just the broadest scope. Fixed to "neutral" for company-wide and
//    "default" for branch-specific.
//
// 4. The component accepted onRemove as optional but also rendered the Remove
//    button with `disabled={!onRemove}` — if onRemove is undefined the button
//    is permanently disabled but still visible. Hidden entirely when no handler.

import { useState } from "react";
import { Can } from "../../../auth/Can";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Assignment {
  id:              string;
  roleId:          string;
  roleName:        string;
  branchId?:       string | null;
  branchName?:     string | null;
  permissionCount: number;
}

interface Props {
  assignments?: Assignment[] | null;
  loading?:     boolean;
  onRemove?:    (assignmentId: string) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserAssignmentsTable({ assignments, loading = false, onRemove }: Props) {
  const rows = assignments ?? [];
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(id: string) {
    if (!onRemove) return;
    if (!window.confirm("Remove this role assignment?")) return;
    setRemovingId(id);
    try {
      await onRemove(id);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="sec-table-wrap">
      <table className="sec-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Scope</th>
            <th>Permissions</th>
            {onRemove && <th className="right" />}
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan={onRemove ? 4 : 3} className="sec-table__empty">
                Loading assignments…
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={onRemove ? 4 : 3} className="sec-table__empty">
                No access assignments yet.
              </td>
            </tr>
          )}

          {!loading && rows.map((a) => (
            <tr key={a.id}>
              <td>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{a.roleName}</span>
              </td>

              <td>
                <span className={`sec-badge ${a.branchId ? "sec-badge--success" : "sec-badge--neutral"}`}>
                  {a.branchName ?? "Company-wide"}
                </span>
              </td>

              <td>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  {a.permissionCount}
                </span>
              </td>

              {onRemove && (
                <td style={{ textAlign: "right" }}>
                  <Can permission="roles.assign">
                    <button
                      type="button"
                      className="sec-btn sec-btn--danger sec-btn--sm"
                      disabled={removingId === a.id}
                      onClick={() => handleRemove(a.id)}
                    >
                      {removingId === a.id ? "Removing…" : "Remove"}
                    </button>
                  </Can>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}