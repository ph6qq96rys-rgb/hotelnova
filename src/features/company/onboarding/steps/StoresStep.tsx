// src/modules/company/onboarding/steps/StoresStep.tsx
//
// Self-contained: fetches stores + stock locations on mount.
// Parent passes no data props — only companyId, branchId, dispatch.

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type { StockLocation, StoreDto } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import { STORE_TYPES } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction, StoreType } from "../state/onboarding.types";
import { extractApiError, trimOrNull } from "../utils/onboarding.utils";
import {
  Field, Input, SelectInput, Btn, Alert, SectionTitle, EmptyState, Spinner,
} from "../components/company.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getId(x: any): string { return String(x?.id ?? x?.Id ?? ""); }

function getMappedId(s: StoreDto): string {
  const a = s as any;
  return (
    a.issueStockLocationId        ??
    a.defaultIssueStockLocationId ??
    a.issueLocationId             ??
    a.defaultStockLocationId      ??
    a.issueLocation?.id           ??
    ""
  );
}

const STORE_TYPE_OPTIONS = STORE_TYPES.map((t) => ({ value: t, label: t }));

interface StoreForm { name: string; code: string; storeType: string; }
const EMPTY_FORM: StoreForm = { name: "", code: "", storeType: "DineIn" };

function validateForm(form: StoreForm, setErrors: (e: FieldErrors) => void): boolean {
  const e: FieldErrors = {};
  if (!form.name.trim()) e.name = "Store name is required.";
  setErrors(e);
  return Object.keys(e).length === 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StoresStep(props: {
  companyId:   string | null;
  branchId:    string | null;
  branchName?: string;
  saving:      boolean;
  dispatch:    React.Dispatch<OnboardingAction>;
}) {
  // ── Own data fetch ────────────────────────────────────────────────────────
  const [stores,    setStores]    = useState<StoreDto[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading,   setLoading]   = useState(false);

  const fetchAll = useCallback(async () => {
    if (!props.companyId || !props.branchId) { setStores([]); setLocations([]); return; }
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        onboardingApi.listStores(props.companyId, props.branchId).catch(() => []),
        onboardingApi.listStockLocations(props.companyId, props.branchId).catch(() => []),
      ]);
      setStores(Array.isArray(s) ? s : []);
      setLocations(Array.isArray(l) ? l : []);
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!loading && stores.length === 0) setShowCreate(true);
  }, [loading, stores.length]);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState<StoreForm>({ ...EMPTY_FORM });
  const [editErrors,  setEditErrors]  = useState<FieldErrors>({});
  const [editSaving,  setEditSaving]  = useState(false);
  const [mapBusy,     setMapBusy]     = useState(false);

  // ── Create state ──────────────────────────────────────────────────────────
  const [showCreate,   setShowCreate]   = useState(false);
  const [createForm,   setCreateForm]   = useState<StoreForm>({ ...EMPTY_FORM });
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeLocations = locations.filter((l) => (l as any).isActive !== false);

  const locationOptions = [
    { value: "", label: "— Select issue location —" },
    ...activeLocations.map((l) => ({
      value: getId(l),
      label: `${(l as any).name ?? ""}${(l as any).code ? ` (${(l as any).code})` : ""}`,
    })),
  ];

  function getMappedName(s: StoreDto): string | null {
    const mid = getMappedId(s);
    if (!mid) return null;
    return (locations.find((l) => getId(l) === mid) as any)?.name ?? null;
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function openEdit(s: StoreDto) {
    const a = s as any;
    setExpandedId(getId(s));
    setEditForm({
      name:      a.name      ?? "",
      code:      a.code      ?? "",
      storeType: a.locationType ?? a.storeType ?? "DineIn",
    });
    setEditErrors({});
  }

  function closeEdit() { setExpandedId(null); setEditErrors({}); }

  async function saveEdit(sid: string) {
    if (!props.companyId || !props.branchId || !validateForm(editForm, setEditErrors)) return;
    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.updateStore(props.companyId, props.branchId, sid, {
        name:         editForm.name.trim(),
        code:         trimOrNull(editForm.code),
        locationType: editForm.storeType,
      });
      await fetchAll();
      closeEdit();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Store updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update store.") });
    } finally { setEditSaving(false); }
  }

  async function mapIssueLocation(sid: string, locationId: string) {
    if (!props.companyId || !props.branchId || !locationId) return;
    setMapBusy(true);
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.mapStoreIssueLocation(props.companyId, props.branchId, sid, locationId);
      await fetchAll();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Issue location mapped." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to map location.") });
    } finally { setMapBusy(false); }
  }

  // ── Create handler ────────────────────────────────────────────────────────

  async function create() {
    if (!props.companyId || !props.branchId || !validateForm(createForm, setCreateErrors)) return;
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.createStore(props.companyId, props.branchId, {
        name:         createForm.name.trim(),
        code:         trimOrNull(createForm.code),
        locationType: createForm.storeType,
      });
      await fetchAll();
      setCreateForm({ ...EMPTY_FORM });
      setShowCreate(false);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Store added." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create store.") });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading stores…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {activeLocations.length === 0 && stores.length > 0 && (
        <Alert tone="warn" title="No active stock locations"
          message="Stores cannot be mapped until at least one active stock location exists." />
      )}

      {stores.length === 0 && !showCreate && (
        <EmptyState
          title="No stores yet"
          sub={`Add POS or sales units for ${props.branchName ?? "this branch"}.`}
        />
      )}

      {/* ── Store list ────────────────────────────────────────────────────── */}
      {stores.map((s) => {
        const sid        = getId(s);
        const a          = s as any;
        const isExpanded = expandedId === sid;
        const mappedId   = getMappedId(s);
        const mappedName = getMappedName(s);

        return (
          <div key={sid} style={{
            border: "1px solid #e2e8f0", borderRadius: 12,
            background: "#fff", overflow: "hidden",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto",
              alignItems: "center", gap: 12, padding: "12px 16px",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{a.name}</span>
                  {a.code && (
                    <span style={{
                      fontFamily: "monospace", fontSize: 11, color: "#64748b",
                      background: "#f1f5f9", padding: "1px 6px", borderRadius: 5,
                    }}>{a.code}</span>
                  )}
                  {(a.locationType || a.storeType) && (
                    <span className="ob-badge">{a.locationType ?? a.storeType}</span>
                  )}
                </div>
                <div style={{ marginTop: 4 }}>
                  {mappedName
                    ? <span className="ob-badge ob-badge--success">Issue: {mappedName}</span>
                    : <span className="ob-badge ob-badge--warn">No issue location mapped</span>
                  }
                </div>
              </div>
              <Btn variant="ghost"
                onClick={() => isExpanded ? closeEdit() : openEdit(s)}
                disabled={editSaving}
                style={{ padding: "5px 12px", fontSize: 12, minHeight: 30 }}>
                {isExpanded ? "Close" : "Configure"}
              </Btn>
            </div>

            {isExpanded && (
              <div style={{
                borderTop: "1px solid #e2e8f0", background: "#f8fafc",
                padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16,
              }}>
                {editErrors.name && <Alert tone="danger" title="Validation" message={editErrors.name} />}

                <SectionTitle title="Store details" subtitle="Name, code and type" />
                <div className="ob-grid-2">
                  <Field label="Store name" required>
                    <Input value={editForm.name}
                      onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
                      placeholder="Main POS" />
                  </Field>
                  <Field label="Code">
                    <Input value={editForm.code}
                      onChange={(v) => setEditForm((f) => ({ ...f, code: v.toUpperCase() }))}
                      placeholder="POS-01" />
                  </Field>
                  <Field label="Store type">
                    <SelectInput value={editForm.storeType}
                      onChange={(v) => setEditForm((f) => ({ ...f, storeType: v }))}
                      options={STORE_TYPE_OPTIONS} />
                  </Field>
                </div>

                <SectionTitle title="Issue location"
                  subtitle="Stock is pulled from this location when this store raises a SIV" />
                <Field label="Issue stock location"
                  hint={activeLocations.length === 0 ? "Create a stock location first" : undefined}>
                  <SelectInput
                    value={mappedId}
                    onChange={(v) => mapIssueLocation(sid, v)}
                    options={locationOptions}
                    disabled={activeLocations.length === 0 || mapBusy} />
                </Field>

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
                  <Btn variant="ghost" onClick={closeEdit} disabled={editSaving}>Discard</Btn>
                  <Btn variant="primary" onClick={() => saveEdit(sid)} disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add new store ─────────────────────────────────────────────────── */}
      <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
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
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Add store</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>POS, dine-in, takeaway, bar, retail, delivery</div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{showCreate ? "▲" : "▼"}</span>
        </button>

        {showCreate && (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            {createErrors.name && <Alert tone="danger" title="Validation" message={createErrors.name} />}
            <div className="ob-grid-2">
              <Field label="Store name" required>
                <Input value={createForm.name}
                  onChange={(v) => setCreateForm((f) => ({ ...f, name: v }))}
                  placeholder="Main POS" />
              </Field>
              <Field label="Code">
                <Input value={createForm.code}
                  onChange={(v) => setCreateForm((f) => ({ ...f, code: v.toUpperCase() }))}
                  placeholder="POS-01" />
              </Field>
              <Field label="Store type">
                <SelectInput value={createForm.storeType}
                  onChange={(v) => setCreateForm((f) => ({ ...f, storeType: v as StoreType }))}
                  options={STORE_TYPE_OPTIONS} />
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" onClick={create} disabled={props.saving}>
                {props.saving ? "Adding…" : "Add store"}
              </Btn>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}