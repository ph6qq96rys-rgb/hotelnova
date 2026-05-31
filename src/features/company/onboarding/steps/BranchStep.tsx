// src/modules/company/onboarding/steps/BranchStep.tsx
//
// Self-contained: fetches its own branch list whenever companyId changes.
// The parent no longer needs to pass a pre-loaded branches array.

import { useEffect, useState } from "react";
import type React from "react";
import type { BranchDto, CreateBranchDto } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import { DEFAULT_BRANCH_FORM } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError, trimOrNull } from "../utils/onboarding.utils";
import {
  Field, Input, TextArea, Checkbox,
  Btn, Alert, SectionTitle, EmptyState, Spinner,
} from "../components/company.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getId(b: BranchDto): string { return String((b as any).id ?? ""); }

function dtoToForm(b: BranchDto): CreateBranchDto {
  return {
    code:        (b as any).code        ?? "",
    name:        (b as any).name        ?? "",
    region:      (b as any).region      ?? "",
    city:        (b as any).city        ?? "",
    addressLine: (b as any).addressLine ?? "",
    isMain:      !!(b as any).isMain,
  } as CreateBranchDto;
}

function validate(
  form: CreateBranchDto,
  setErrors: (e: FieldErrors) => void,
): boolean {
  const e: FieldErrors = {};
  if (!String(form.code ?? "").trim()) e.code = "Branch code is required.";
  if (!String(form.name ?? "").trim()) e.name = "Branch name is required.";
  setErrors(e);
  return Object.keys(e).length === 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BranchStep(props: {
  companyId:      string | null;
  /** Active/selected branch ID — highlighted in the list. */
  activeBranchId: string | null;
  saving:         boolean;
  onCreated:      (branch: BranchDto) => Promise<void> | void;
  onSelected:     (branchId: string)  => void;
  onUpdated?:     (branch: BranchDto) => Promise<void> | void;
  dispatch:       React.Dispatch<OnboardingAction>;
}) {
  // ── Own data fetching ─────────────────────────────────────────────────────
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!props.companyId) { setBranches([]); return; }
    setLoading(true);
    onboardingApi
      .listBranches(props.companyId)
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, [props.companyId]);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [editForm,     setEditForm]     = useState<CreateBranchDto>({ ...DEFAULT_BRANCH_FORM });
  const [editErrors,   setEditErrors]   = useState<FieldErrors>({});
  const [editSaving,   setEditSaving]   = useState(false);

  // ── Create state ──────────────────────────────────────────────────────────
  const [showCreate,   setShowCreate]   = useState(false);
  const [createForm,   setCreateForm]   = useState<CreateBranchDto>({ ...DEFAULT_BRANCH_FORM });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  // Auto-open create form when no branches exist
  useEffect(() => {
    if (!loading && branches.length === 0) setShowCreate(true);
  }, [loading, branches.length]);

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function openEdit(b: BranchDto) {
    setExpandedId(getId(b));
    setEditForm(dtoToForm(b));
    setEditErrors({});
  }

  function closeEdit() { setExpandedId(null); setEditErrors({}); }

  async function saveEdit(bid: string) {
    if (!props.companyId || !validate(editForm, setEditErrors)) return;
    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });
    try {
      const updated = await onboardingApi.updateBranch(props.companyId, bid, {
        code:        String(editForm.code ?? "").trim().toUpperCase(),
        name:        String(editForm.name ?? "").trim(),
        region:      trimOrNull(editForm.region),
        city:        trimOrNull(editForm.city),
        addressLine: trimOrNull(editForm.addressLine),
        isMain:      !!editForm.isMain,
      });
      // Refresh local list
      setBranches((prev) =>
        prev.map((b) => getId(b) === bid ? updated : b),
      );
      closeEdit();
      if (props.onUpdated) await props.onUpdated(updated);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Branch updated." });
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to update branch."),
      });
    } finally { setEditSaving(false); }
  }

  // ── Create handler ────────────────────────────────────────────────────────

  async function create() {
    if (!props.companyId || !validate(createForm, setCreateErrors)) return;
    props.dispatch({ type: "SAVE_START" });
    try {
      const created = await onboardingApi.createBranch(props.companyId, {
        ...createForm,
        code:        String(createForm.code ?? "").trim().toUpperCase(),
        name:        String(createForm.name ?? "").trim(),
        region:      trimOrNull(createForm.region),
        city:        trimOrNull(createForm.city),
        addressLine: trimOrNull(createForm.addressLine),
        isMain:      !!createForm.isMain,
      });
      // Append to local list immediately — no full reload needed
      setBranches((prev) => [...prev, created]);
      setCreateForm({ ...DEFAULT_BRANCH_FORM });
      setShowCreate(false);
      await props.onCreated(created);
    } catch (err) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: extractApiError(err, "Failed to create branch."),
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading branches…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {branches.length === 0 && !showCreate && (
        <EmptyState
          title="No branches yet"
          sub="Use the form below to add the first branch for this company."
        />
      )}

      {/* ── Branch list ───────────────────────────────────────────────────── */}
      {branches.map((b) => {
        const id         = getId(b);
        const isActive   = id === props.activeBranchId;
        const isExpanded = expandedId === id;
        const a          = b as any;

        return (
          <div key={id} style={{
            border:       isActive ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
            borderRadius: 12,
            background:   isActive ? "#f5f3ff" : "#fff",
            overflow:     "hidden",
            transition:   "border-color 0.15s",
          }}>

            {/* ── Row summary ────────────────────────────────────────────── */}
            <div style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              alignItems: "center", gap: 12, padding: "12px 16px",
            }}>
              {/* Active dot */}
              <div style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: isActive ? "#6366f1" : "#e2e8f0",
                border:     isActive ? "2px solid #a5b4fc" : "2px solid #e2e8f0",
              }} />

              {/* Info */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{b.name}</span>
                  {a.code && (
                    <span style={{
                      fontFamily: "monospace", fontSize: 11, color: "#64748b",
                      background: "#f1f5f9", padding: "1px 6px", borderRadius: 5,
                    }}>{a.code}</span>
                  )}
                  {a.isMain && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#059669",
                      background: "#d1fae5", padding: "1px 7px",
                      borderRadius: 999, border: "1px solid #6ee7b7",
                    }}>Main</span>
                  )}
                  {isActive && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#6366f1",
                      background: "#ede9fe", padding: "1px 7px",
                      borderRadius: 999, border: "1px solid #c4b5fd",
                    }}>Active</span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: "#94a3b8", marginTop: 3,
                  display: "flex", gap: 10, flexWrap: "wrap",
                }}>
                  {a.city   && <span>{a.city}</span>}
                  {a.region && <span>{a.region}</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!isActive && (
                  <Btn variant="primary" onClick={() => props.onSelected(id)}
                    disabled={props.saving || editSaving}
                    style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}>
                    Select
                  </Btn>
                )}
                <Btn variant="ghost"
                  onClick={() => isExpanded ? closeEdit() : openEdit(b)}
                  disabled={editSaving}
                  style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}>
                  {isExpanded ? "Close" : "Configure"}
                </Btn>
              </div>
            </div>

            {/* ── Inline configure form ─────────────────────────────────── */}
            {isExpanded && (
              <div style={{
                borderTop: "1px solid #e2e8f0", background: "#f8fafc",
                padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16,
              }}>
                {editErrors.code && (
                  <Alert tone="danger" title="Validation" message={editErrors.code} />
                )}
                {editErrors.name && (
                  <Alert tone="danger" title="Validation" message={editErrors.name} />
                )}

                <SectionTitle title="Branch details" subtitle="Location profile and address" />

                <div className="ob-grid-2">
                  <Field label="Branch code" required>
                    <Input value={String(editForm.code ?? "")}
                      onChange={(v) => setEditForm((x) => ({ ...x, code: v.toUpperCase() }))}
                      placeholder="BOLE-01" />
                  </Field>
                  <Field label="Branch name" required>
                    <Input value={String(editForm.name ?? "")}
                      onChange={(v) => setEditForm((x) => ({ ...x, name: v }))}
                      placeholder="Bole Branch" />
                  </Field>
                  <Field label="Region">
                    <Input value={String(editForm.region ?? "")}
                      onChange={(v) => setEditForm((x) => ({ ...x, region: v }))}
                      placeholder="Oromia" />
                  </Field>
                  <Field label="City">
                    <Input value={String(editForm.city ?? "")}
                      onChange={(v) => setEditForm((x) => ({ ...x, city: v }))}
                      placeholder="Addis Ababa" />
                  </Field>
                </div>

                <Field label="Address">
                  <TextArea value={String(editForm.addressLine ?? "")}
                    onChange={(v) => setEditForm((x) => ({ ...x, addressLine: v }))}
                    placeholder="Street / Building / Landmark…" rows={2} />
                </Field>

                <Checkbox
                  checked={!!editForm.isMain}
                  onChange={(v) => setEditForm((x) => ({ ...x, isMain: v }))}
                  label="Main branch"
                  hint="Mark as the primary branch for this company"
                />

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
                  <Btn variant="ghost" onClick={closeEdit} disabled={editSaving}>
                    Discard
                  </Btn>
                  <Btn variant="primary" onClick={() => saveEdit(id)} disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add new branch (collapsible) ──────────────────────────────────── */}
      <div style={{
        border: "1px dashed #cbd5e1", borderRadius: 12,
        overflow: "hidden", background: "#fff",
      }}>
        <button type="button" onClick={() => setShowCreate((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "12px 16px",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: showCreate ? "1px solid #e2e8f0" : "none",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#16a34a", flexShrink: 0,
            }}>+</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                Add new branch
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                Create a new branch with its own locations and stores
              </div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{showCreate ? "▲" : "▼"}</span>
        </button>

        {showCreate && (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            {createErrors.code && (
              <Alert tone="danger" title="Validation" message={createErrors.code} />
            )}
            {createErrors.name && (
              <Alert tone="danger" title="Validation" message={createErrors.name} />
            )}

            <div className="ob-grid-2">
              <Field label="Branch code" required hint="Short identifier e.g. BOLE-01">
                <Input value={String(createForm.code ?? "")}
                  onChange={(v) => setCreateForm((x) => ({ ...x, code: v.toUpperCase() }))}
                  placeholder="BOLE-01" />
              </Field>
              <Field label="Branch name" required>
                <Input value={String(createForm.name ?? "")}
                  onChange={(v) => setCreateForm((x) => ({ ...x, name: v }))}
                  placeholder="Bole Branch" />
              </Field>
              <Field label="Region">
                <Input value={String(createForm.region ?? "")}
                  onChange={(v) => setCreateForm((x) => ({ ...x, region: v }))}
                  placeholder="Oromia" />
              </Field>
              <Field label="City">
                <Input value={String(createForm.city ?? "")}
                  onChange={(v) => setCreateForm((x) => ({ ...x, city: v }))}
                  placeholder="Addis Ababa" />
              </Field>
            </div>

            <Field label="Address">
              <TextArea value={String(createForm.addressLine ?? "")}
                onChange={(v) => setCreateForm((x) => ({ ...x, addressLine: v }))}
                placeholder="Street / Building / Landmark…" rows={2} />
            </Field>

            <Checkbox
              checked={!!createForm.isMain}
              onChange={(v) => setCreateForm((x) => ({ ...x, isMain: v }))}
              label="Main branch"
              hint="Mark as the primary branch for this company"
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" onClick={create} disabled={props.saving}>
                {props.saving ? "Creating…" : "Create branch"}
              </Btn>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}