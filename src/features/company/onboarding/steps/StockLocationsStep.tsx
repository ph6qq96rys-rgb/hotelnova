// src/modules/company/onboarding/steps/StockLocationsStep.tsx
//
// Self-contained: fetches its own location list whenever companyId/branchId
// changes. Parent no longer needs to pass items or onChanged as props.

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type { StockLocation } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import { LOCATION_TYPES } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError } from "../utils/onboarding.utils";
import {
  Field, Input, SelectInput, Btn, Alert, SectionTitle, EmptyState, Spinner,
} from "../components/company.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getId(l: StockLocation): string { return String((l as any).id ?? ""); }

const LOCATION_TYPE_OPTIONS = LOCATION_TYPES.map((t) => ({ value: t.value, label: t.label }));

interface LocationForm { name: string; code: string; locationType: string; }
const EMPTY_FORM: LocationForm = { name: "", code: "", locationType: "Warehouse" };

function validateForm(form: LocationForm, setErrors: (e: FieldErrors) => void): boolean {
  const e: FieldErrors = {};
  if (!form.name.trim()) e.name = "Location name is required.";
  if (!form.code.trim()) e.code = "Location code is required.";
  setErrors(e);
  return Object.keys(e).length === 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StockLocationsStep(props: {
  companyId:   string | null;
  branchId:    string | null;
  branchName?: string;
  saving:      boolean;
  dispatch:    React.Dispatch<OnboardingAction>;
}) {
  // ── Own data fetch ────────────────────────────────────────────────────────
  const [items,   setItems]   = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLocations = useCallback(async () => {
    if (!props.companyId || !props.branchId) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await onboardingApi.listStockLocations(props.companyId, props.branchId);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => { void fetchLocations(); }, [fetchLocations]);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState<LocationForm>({ ...EMPTY_FORM });
  const [editErrors,  setEditErrors]  = useState<FieldErrors>({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [defaultBusy, setDefaultBusy] = useState<string | null>(null);

  // ── Create state ──────────────────────────────────────────────────────────
  const [showCreate,   setShowCreate]   = useState(false);
  const [createForm,   setCreateForm]   = useState<LocationForm>({ ...EMPTY_FORM });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!loading && items.length === 0) setShowCreate(true);
  }, [loading, items.length]);

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function openEdit(l: StockLocation) {
    const a = l as any;
    setExpandedId(getId(l));
    setEditForm({
      name:         a.name         ?? "",
      code:         a.code         ?? "",
      locationType: a.locationType ?? a.type ?? "Warehouse",
    });
    setEditErrors({});
  }

  function closeEdit() { setExpandedId(null); setEditErrors({}); }

  async function saveEdit(lid: string) {
    if (!props.companyId || !props.branchId || !validateForm(editForm, setEditErrors)) return;
    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.updateStockLocation(props.companyId, props.branchId, lid, {
        name:         editForm.name.trim(),
        code:         editForm.code.trim().toUpperCase(),
        locationType: editForm.locationType,
      });
      await fetchLocations();
      closeEdit();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Location updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update location.") });
    } finally { setEditSaving(false); }
  }

  async function setDefault(lid: string, type: "receiving" | "issue") {
    if (!props.companyId || !props.branchId) return;
    setDefaultBusy(`${lid}-${type}`);
    try {
      if (type === "receiving")
        await onboardingApi.setDefaultReceiving(props.companyId, props.branchId, lid);
      else
        await onboardingApi.setDefaultIssue(props.companyId, props.branchId, lid);
      await fetchLocations();
      props.dispatch({ type: "SAVE_SUCCESS", notice: `Default ${type} location set.` });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to set default.") });
    } finally { setDefaultBusy(null); }
  }

  // ── Create handler ────────────────────────────────────────────────────────

  async function create() {
    if (!props.companyId || !props.branchId || !validateForm(createForm, setCreateErrors)) return;
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.createStockLocation(props.companyId, props.branchId, {
        name:         createForm.name.trim(),
        code:         createForm.code.trim().toUpperCase(),
        locationType: createForm.locationType,
      });
      await fetchLocations();
      setCreateForm({ ...EMPTY_FORM });
      setShowCreate(false);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Location added." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create location.") });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading stock locations…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {items.length === 0 && !showCreate && (
        <EmptyState
          title="No stock locations yet"
          sub={`Add locations for ${props.branchName ?? "this branch"} — warehouse, kitchen, bar, etc.`}
        />
      )}

      {/* ── Location list ─────────────────────────────────────────────────── */}
      {items.map((l) => {
        const lid         = getId(l);
        const a           = l as any;
        const isExpanded  = expandedId === lid;
        const isReceiving = a.isDefaultReceiving || a.isDefaultIssueReceiving;
        const isIssue     = a.isDefaultIssue;

        return (
          <div key={lid} style={{
            border:       "1px solid #e2e8f0",
            borderRadius: 12,
            background:   "#fff",
            overflow:     "hidden",
          }}>
            {/* ── Row summary ──────────────────────────────────────────── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto",
              alignItems: "center", gap: 12, padding: "12px 16px",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {a.name ?? "—"}
                  </span>
                  {a.code && (
                    <span style={{
                      fontFamily: "monospace", fontSize: 11, color: "#64748b",
                      background: "#f1f5f9", padding: "1px 6px", borderRadius: 5,
                    }}>{a.code}</span>
                  )}
                  {(a.locationType || a.type) && (
                    <span className="ob-badge">{a.locationType ?? a.type}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {isReceiving && (
                    <span className="ob-badge ob-badge--success">Default Receiving</span>
                  )}
                  {isIssue && (
                    <span className="ob-badge ob-badge--info">Default Issue</span>
                  )}
                  {a.isActive === false && (
                    <span className="ob-badge ob-badge--warn">Inactive</span>
                  )}
                </div>
              </div>

              <Btn variant="ghost"
                onClick={() => isExpanded ? closeEdit() : openEdit(l)}
                disabled={editSaving}
                style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}>
                {isExpanded ? "Close" : "Configure"}
              </Btn>
            </div>

            {/* ── Inline configure form ─────────────────────────────── */}
            {isExpanded && (
              <div style={{
                borderTop: "1px solid #e2e8f0", background: "#f8fafc",
                padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16,
              }}>
                {editErrors.name && (
                  <Alert tone="danger" title="Validation" message={editErrors.name} />
                )}
                {editErrors.code && (
                  <Alert tone="danger" title="Validation" message={editErrors.code} />
                )}

                <SectionTitle title="Location details" subtitle="Name, code and type" />

                <div className="ob-grid-2">
                  <Field label="Name" required>
                    <Input value={editForm.name}
                      onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
                      placeholder="Main Warehouse" />
                  </Field>
                  <Field label="Code" required>
                    <Input value={editForm.code}
                      onChange={(v) => setEditForm((f) => ({ ...f, code: v.toUpperCase() }))}
                      placeholder="WH-01" />
                  </Field>
                  <Field label="Type">
                    <SelectInput value={editForm.locationType}
                      onChange={(v) => setEditForm((f) => ({ ...f, locationType: v }))}
                      options={LOCATION_TYPE_OPTIONS} />
                  </Field>
                </div>

                <SectionTitle title="Default assignments"
                  subtitle="Set this location as the default for receiving or issuing stock" />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn
                    variant={isReceiving ? "primary" : "ghost"}
                    onClick={() => setDefault(lid, "receiving")}
                    disabled={!!defaultBusy || isReceiving}
                    style={{ fontSize: 12 }}>
                    {isReceiving ? "✓ Default Receiving" : "Set as Default Receiving"}
                  </Btn>
                  <Btn
                    variant={isIssue ? "primary" : "ghost"}
                    onClick={() => setDefault(lid, "issue")}
                    disabled={!!defaultBusy || isIssue}
                    style={{ fontSize: 12 }}>
                    {isIssue ? "✓ Default Issue" : "Set as Default Issue"}
                  </Btn>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
                  <Btn variant="ghost" onClick={closeEdit} disabled={editSaving}>
                    Discard
                  </Btn>
                  <Btn variant="primary" onClick={() => saveEdit(lid)} disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add new location (collapsible) ────────────────────────────────── */}
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
                Add stock location
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                Warehouse, kitchen, bar, WIP, transit, etc.
              </div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{showCreate ? "▲" : "▼"}</span>
        </button>

        {showCreate && (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            {createErrors.name && (
              <Alert tone="danger" title="Validation" message={createErrors.name} />
            )}
            {createErrors.code && (
              <Alert tone="danger" title="Validation" message={createErrors.code} />
            )}

            <div className="ob-grid-2">
              <Field label="Name" required>
                <Input value={createForm.name}
                  onChange={(v) => setCreateForm((f) => ({ ...f, name: v }))}
                  placeholder="Main Warehouse" />
              </Field>
              <Field label="Code" required>
                <Input value={createForm.code}
                  onChange={(v) => setCreateForm((f) => ({ ...f, code: v.toUpperCase() }))}
                  placeholder="WH-01" />
              </Field>
              <Field label="Type">
                <SelectInput value={createForm.locationType}
                  onChange={(v) => setCreateForm((f) => ({ ...f, locationType: v }))}
                  options={LOCATION_TYPE_OPTIONS} />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" onClick={create} disabled={props.saving}>
                {props.saving ? "Adding…" : "Add location"}
              </Btn>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}