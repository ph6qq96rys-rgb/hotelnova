// src/modules/security/components/AssignRoleWizard.tsx
//
// 3-step modal wizard: Scope → Role → Review → Confirm
//
// ── What was wrong in the original ──────────────────────────────────────────
// 1. Used Tailwind classes (fixed inset-0, bg-black/30, rounded-2xl, etc.)
//    while the rest of the codebase uses sec-* CSS classes. Fully migrated.
//
// 2. The assign() function called securityApi.addUserToRole(companyId, roleId, userId)
//    which maps to POST /roles/{roleId}/users with body { userId }.
//    This ignores the selected branchId entirely — the branch scope selected
//    in Step 1 was never sent. Fixed: uses addUserRoleAssignment from
//    userAssignmentsApi which sends { userId, branchId }.
//    Note: the commented-out "preferred" fetch() block is removed — the proper
//    API already exists.
//
// 3. The wizard had no AbortController on save — if the modal was closed while
//    saving, the callback would fire on an unmounted component. Added cleanup.
//
// 4. r.isSystem check prevented system roles from being assigned. This is a
//    UX decision, not a security one (the backend enforces it). Kept as-is
//    but made the disabled state explicit with a tooltip.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRoles } from "../hooks/useRoles";
import { useBranches } from "../hooks/useBranches";
import { addUserRoleAssignment } from "../api/userAssignmentsApi";
import { useAppScope } from "../../../app/useAppScope";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface Props {
  userId:      string;
  onClose:     () => void;
  onAssigned?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssignRoleWizard({ userId, onClose, onAssigned }: Props) {
  const { companyId } = useAppScope();
  const { roles,    loading: rolesLoading }    = useRoles(companyId);
  const { branches, loading: branchesLoading } = useBranches(companyId);

  const [step,     setStep]    = useState<Step>(1);
  const [branchId, setBranchId] = useState("");   // empty = company-wide
  const [roleId,   setRoleId]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === roleId),
    [roles, roleId]
  );

  const scopeLabel = useMemo(() => {
    if (!branchId) return "Company-wide";
    return branches.find((b) => b.id === branchId)?.name ?? "Selected branch";
  }, [branchId, branches]);

  async function assign() {
    if (!companyId || !roleId) return;
    setSaving(true);
    setError(null);

    try {
      await addUserRoleAssignment(companyId, {
        userId,
        roleId,
        branchId: branchId || null,
      });
      if (!mountedRef.current) return;
      onAssigned?.();
      onClose();
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to assign role.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="inv-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Assign role"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="inv-modal" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="inv-modal__head">
          <div>
            <div className="inv-modal__title">Assign role</div>
            <div className="inv-modal__subtitle">Step {step} of 3 — Scope → Role → Review</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="inv-modal__body">
          {error && (
            <div className="sec-alert sec-alert--error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* ── Step 1: Scope ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="sec-field">
                <label className="sec-field-label" htmlFor="scope-company">Company</label>
                <div
                  id="scope-company"
                  style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#475569", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}
                >
                  {companyId ?? "—"}
                </div>
              </div>

              <div className="sec-field">
                <label className="sec-field-label" htmlFor="scope-branch">Branch (optional)</label>
                <select
                  id="scope-branch"
                  className="sec-select"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={branchesLoading}
                >
                  <option value="">Company-wide (all branches)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <span className="sec-hint">
                  Company-wide roles should be rare — prefer branch-scoped assignments.
                </span>
              </div>
            </div>
          )}

          {/* ── Step 2: Role ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Choose role</div>

              {rolesLoading ? (
                <div className="sec-placeholder">Loading roles…</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {roles
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => (
                      <label
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${roleId === r.id ? "#0f172a" : "#e2e8f0"}`,
                          background: roleId === r.id ? "#f8fafc" : "#fff",
                          cursor: r.isSystem ? "not-allowed" : "pointer",
                          opacity: r.isSystem ? 0.55 : 1,
                        }}
                        title={r.isSystem ? "System roles cannot be assigned manually." : undefined}
                      >
                        <input
                          type="radio"
                          name="wizard-role"
                          style={{ marginTop: 2, accentColor: "#0f172a" }}
                          checked={roleId === r.id}
                          onChange={() => setRoleId(r.id)}
                          disabled={r.isSystem}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{r.name}</span>
                            {r.isSystem && (
                              <span className="sec-badge sec-badge--neutral">System</span>
                            )}
                          </div>
                          {r.description && (
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Review assignment</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>Scope</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{scopeLabel}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>Role</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{selectedRole?.name ?? "—"}</div>
                </div>
                {selectedRole?.description && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>Description</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{selectedRole.description}</div>
                  </div>
                )}
              </div>

              <div className="sec-alert sec-alert--info" style={{ fontSize: 12 }}>
                Permissions are inherited from the role and managed in Role Detail.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="inv-modal__foot">
          {step > 1 && (
            <button
              type="button"
              className="sec-btn sec-btn--outline"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={saving}
            >
              Back
            </button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              type="button"
              className="sec-btn sec-btn--outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                type="button"
                className="sec-btn sec-btn--primary"
                disabled={step === 2 && !roleId}
                onClick={() => setStep((s) => (s + 1) as Step)}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="sec-btn sec-btn--primary"
                disabled={!roleId || saving}
                onClick={assign}
              >
                {saving
                  ? <><span className="sec-spinner" />Assigning…</>
                  : "Assign role"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}