// src/modules/company/pages/BranchOnboardingWizardPage.tsx
// CompanyAdmin: create and fully configure a branch.
// Each step lists existing items as selectable/editable rows and
// keeps the add-form at the bottom — same pattern as the standalone
// StockLocationsStep / StoresStep components.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";
import { useAppScope } from "../../../app/useAppScope";
import { http } from "../../../api/http";
import { branchesApi } from "../api/branchesApi";
import { onboardingApi } from "../onboarding/api/onboardingApi";
import type {
  BranchDto, CreateBranchDto, BranchUserDto, CreateBranchUserFormValue,
  StockLocation, StoreDto,
} from "../types/company.types";
import { StockLocationType } from "../types/company.types";
import {
  PageShell, Btn, Alert, Field, Input, TextArea, Checkbox,
  SelectInput, WizardSidebar, WizardNav, ProgressBar, CheckItem,
  InfoRow, EmptyState,
} from "./components/company.ui";
import {
  extractApiError, trimOrNull,
  branchUserDisplayName, stockLocationTypeLabel,
} from "../utils/company.utils";
import CreateBranchUserForm from "./Createbranchuserform";
import "./company-onboarding.css";

// ── Step definitions ──────────────────────────────────────────────────────────

type StepKey = "basics" | "stock" | "stores" | "users" | "review";

const STEPS: Array<{ key: StepKey; title: string; subtitle: string }> = [
  { key: "basics", title: "Branch details",  subtitle: "Name, code, address"     },
  { key: "stock",  title: "Stock locations", subtitle: "Warehouse, kitchen, bar" },
  { key: "stores", title: "Stores",          subtitle: "POS and sales units"     },
  { key: "users",  title: "Users & roles",   subtitle: "Branch admin access"     },
  { key: "review", title: "Review & finish", subtitle: "Confirm setup"           },
];

const LOCATION_TYPE_OPTIONS = [
  { value: String(StockLocationType.Warehouse), label: "Warehouse" },
  { value: String(StockLocationType.Kitchen),   label: "Kitchen"   },
  { value: String(StockLocationType.Bar),       label: "Bar"       },
  { value: String(StockLocationType.Transit),   label: "Transit"   },
  { value: String(StockLocationType.WIP),       label: "WIP"       },
  { value: String(StockLocationType.Store),     label: "Store"     },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BranchOnboardingWizardPage() {
  const nav    = useNavigate();
  const params = useParams<{ companyId: string; branchId?: string }>();
  const { companyId: ctxCompanyId, branchId: ctxBranchId, setBranchId } = useAppContext();
  const { companyId: scopeCompanyId } = useAppScope();

  const companyId = params.companyId ?? ctxCompanyId ?? scopeCompanyId ?? "";
  const [branchId, setBranchIdLocal] = useState(params.branchId ?? ctxBranchId ?? "");

  const [active, setActive] = useState<StepKey>("basics");
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [branch,         setBranch]         = useState<BranchDto | null>(null);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [stores,         setStores]         = useState<StoreDto[]>([]);
  const [members,        setMembers]        = useState<BranchUserDto[]>([]);

  const activeIndex = STEPS.findIndex((s) => s.key === active);
  const progressPct = Math.round(((activeIndex + 1) / STEPS.length) * 100);

  // ── Data loading ──────────────────────────────────────────────────────────

  async function refreshBranch() {
    if (!companyId || !branchId) return;
    try { setBranch(await branchesApi.get(companyId, branchId)); }
    catch (e) { setError(extractApiError(e, "Failed to load branch.")); }
  }

  async function refreshStock() {
    if (!companyId || !branchId) return;
    setStockLocations(await onboardingApi.listStockLocations(companyId, branchId).catch(() => []));
  }

  async function refreshStores() {
    if (!companyId || !branchId) return;
    setStores(await onboardingApi.listStores(companyId, branchId).catch(() => []));
  }

  async function refreshMembers() {
    if (!companyId || !branchId) return;
    setMembers(await onboardingApi.listBranchUsers(companyId, branchId).catch(() => []));
  }

  useEffect(() => {
    if (!branchId) return;
    refreshBranch();
    if (active === "stock")  refreshStock();
    if (active === "stores") { refreshStock(); refreshStores(); }
    if (active === "users")  refreshMembers();
    if (active === "review") { refreshBranch(); refreshStock(); refreshStores(); refreshMembers(); }
  }, [active, branchId]);

  // ── Step readiness ────────────────────────────────────────────────────────

  const stepState = useMemo(() => {
    const hasBranch      = !!branchId;
    const hasStock       = stockLocations.length > 0;
    const hasStore       = stores.length > 0;
    const hasBranchAdmin = members.some((m) => m.role === "BranchAdmin");
    return {
      basics: { done: hasBranch,      locked: !companyId  },
      stock:  { done: hasStock,       locked: !hasBranch  },
      stores: { done: hasStore,       locked: !hasBranch  },
      users:  { done: hasBranchAdmin, locked: !hasBranch  },
      review: { done: false,          locked: !hasBranch  },
    } as Record<StepKey, { done: boolean; locked: boolean }>;
  }, [companyId, branchId, stockLocations.length, stores.length, members]);

  function goNext() {
    const i = STEPS.findIndex((s) => s.key === active);
    if (i < STEPS.length - 1 && !stepState[STEPS[i + 1].key].locked)
      setActive(STEPS[i + 1].key);
  }

  function goBack() {
    const i = STEPS.findIndex((s) => s.key === active);
    if (i > 0) setActive(STEPS[i - 1].key);
  }

  function onBranchCreated(id: string) {
    setBranchIdLocal(id);
    setBranchId(id);
    setNotice("Branch created. Configure stock locations next.");
    nav(`/companies/${companyId}/branches/${id}/setup`, { replace: true });
    setActive("stock");
  }

  if (!companyId) {
    return (
      <PageShell title="Branch setup">
        <Alert tone="danger" title="Missing company context"
          message="Navigate via a company to set up a branch." />
      </PageShell>
    );
  }

  return (
    <PageShell title="Branch setup"
      subtitle="Configure a branch — stock locations, stores, and team access">

      <ProgressBar pct={progressPct} />

      {error  && <Alert tone="danger" title="Error" message={error}  />}
      {notice && <Alert tone="ok"     title="Saved" message={notice} />}

      <div className="ob-layout">

        <WizardSidebar steps={STEPS} activeKey={active}
          stepState={stepState} onSelect={setActive} />

        <div className="ob-card">
          <div className="ob-card-header">
            <div className="ob-card-title">{STEPS[activeIndex]?.title}</div>
            <div className="ob-card-subtitle">{STEPS[activeIndex]?.subtitle}</div>
          </div>

          <div className="ob-card-body">

            {active === "basics" && (
              <BranchBasicsStep
                companyId={companyId}
                branchId={branchId || null}
                branch={branch}
                onCreated={onBranchCreated}
                onUpdated={async (b) => { setBranch(b); setNotice("Branch updated."); }}
              />
            )}

            {active === "stock" && branchId && (
              <StockLocationsStep
                companyId={companyId}
                branchId={branchId}
                items={stockLocations}
                onRefresh={refreshStock}
              />
            )}

            {active === "stores" && branchId && (
              <StoresStep
                companyId={companyId}
                branchId={branchId}
                stores={stores}
                stockLocations={stockLocations}
                onRefresh={refreshStores}
              />
            )}

            {active === "users" && branchId && (
              <UsersStep
                companyId={companyId}
                branchId={branchId}
                members={members}
                onRefresh={refreshMembers}
              />
            )}

            {active === "review" && (
              <ReviewStep
                branch={branch}
                branchId={branchId}
                stockLocations={stockLocations}
                stores={stores}
                members={members}
                onFinish={() => nav("/dashboard", { replace: true })}
              />
            )}

            {active !== "basics" && active !== "review" && (
              <WizardNav
                onBack={goBack}
                onNext={goNext}
                backDisabled={activeIndex === 0}
                nextDisabled={busy}
                step={activeIndex + 1}
                total={STEPS.length}
              />
            )}
          </div>
        </div>

      </div>
    </PageShell>
  );
}

// ── Step: Basics ──────────────────────────────────────────────────────────────

function BranchBasicsStep({
  companyId, branchId, branch, onCreated, onUpdated,
}: {
  companyId: string;
  branchId:  string | null;
  branch:    BranchDto | null;
  onCreated: (id: string) => void;
  onUpdated: (b: BranchDto) => void;
}) {
  const [form, setForm]     = useState<CreateBranchDto>({ code: "", name: "", isMain: false });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [err,  setErr]      = useState<string | null>(null);

  // Pre-fill edit form from the loaded branch
  useEffect(() => {
    if (branch && editing) {
      setForm({
        code:        branch.code        ?? "",
        name:        branch.name        ?? "",
        city:        branch.city        ?? "",
        region:      branch.region      ?? "",
        addressLine: branch.addressLine ?? "",
        isMain:      branch.isMain      ?? false,
      });
    }
  }, [branch, editing]);

  async function create() {
    if (!form.name.trim() || !form.code.trim()) {
      setErr("Branch name and code are required."); return;
    }
    setBusy(true); setErr(null);
    try {
      const created = await branchesApi.create(companyId, {
        ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(),
      });
      onCreated(String((created as any).id ?? (created as any).Id));
    } catch (e) { setErr(extractApiError(e, "Failed to create branch.")); }
    finally { setBusy(false); }
  }

  async function update() {
    if (!branchId || !form.name.trim() || !form.code.trim()) {
      setErr("Branch name and code are required."); return;
    }
    setBusy(true); setErr(null);
    try {
      const updated = await branchesApi.update(companyId, branchId, {
        ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(),
      });
      setEditing(false);
      onUpdated(updated);
    } catch (e) { setErr(extractApiError(e, "Failed to update branch.")); }
    finally { setBusy(false); }
  }

  // ── Existing branch: show details + optional edit ──────────────────────

  if (branchId && branch) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <Alert tone="danger" title="Error" message={err} />}

        <div className="ob-inner-card">
          <div className="ob-inner-card-header" style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className="ob-inner-card-title">
                {branch.name}
                {branch.code && (
                  <span style={{
                    marginLeft: 8, fontFamily: "monospace", fontSize: 11,
                    background: "#f1f5f9", padding: "1px 6px", borderRadius: 5, color: "#64748b",
                  }}>
                    {branch.code}
                  </span>
                )}
              </div>
            </div>
            <Btn variant="ghost" onClick={() => setEditing((v) => !v)}
              style={{ padding: "4px 12px", fontSize: 12, minHeight: 30 }}>
              {editing ? "Cancel" : "Edit"}
            </Btn>
          </div>

          {!editing && (
            <div className="ob-inner-card-body">
              <InfoRow label="City"    value={branch.city    ?? "—"} />
              <InfoRow label="Region"  value={branch.region  ?? "—"} />
              <InfoRow label="Address" value={branch.addressLine ?? "—"} />
              <InfoRow label="Main"    value={branch.isMain ? "Yes" : "No"} />
            </div>
          )}

          {editing && (
            <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="ob-grid-auto">
                <Field label="Branch code" required>
                  <Input value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
                    placeholder="BOLE" disabled={busy} />
                </Field>
                <Field label="Branch name" required>
                  <Input value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder="Bole Branch" disabled={busy} />
                </Field>
                <Field label="City">
                  <Input value={form.city ?? ""} onChange={(v) => setForm((f) => ({ ...f, city: trimOrNull(v) }))}
                    placeholder="Addis Ababa" disabled={busy} />
                </Field>
                <Field label="Region">
                  <Input value={form.region ?? ""} onChange={(v) => setForm((f) => ({ ...f, region: trimOrNull(v) }))}
                    placeholder="Oromia" disabled={busy} />
                </Field>
              </div>
              <Field label="Address line">
                <TextArea value={form.addressLine ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, addressLine: trimOrNull(v) }))}
                  placeholder="Street / Building / Landmark…" disabled={busy} rows={2} />
              </Field>
              <Checkbox checked={!!form.isMain}
                onChange={(v) => setForm((f) => ({ ...f, isMain: v }))}
                label="Main branch" hint="Mark as the primary branch for this company" />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Discard</Btn>
                <Btn variant="primary" onClick={update} disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── No branch yet: create form ─────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <Alert tone="danger" title="Error" message={err} />}

      <div className="ob-grid-auto">
        <Field label="Branch code" required hint="Short identifier, e.g. BOLE">
          <Input value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v }))}
            placeholder="BOLE" disabled={busy} />
        </Field>
        <Field label="Branch name" required>
          <Input value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Bole Branch" disabled={busy} />
        </Field>
        <Field label="City">
          <Input value={form.city ?? ""} onChange={(v) => setForm((f) => ({ ...f, city: trimOrNull(v) }))}
            placeholder="Addis Ababa" disabled={busy} />
        </Field>
        <Field label="Region">
          <Input value={form.region ?? ""} onChange={(v) => setForm((f) => ({ ...f, region: trimOrNull(v) }))}
            placeholder="Oromia" disabled={busy} />
        </Field>
      </div>

      <Field label="Address line">
        <TextArea value={form.addressLine ?? ""}
          onChange={(v) => setForm((f) => ({ ...f, addressLine: trimOrNull(v) }))}
          placeholder="Street / Building / Landmark…" disabled={busy} rows={2} />
      </Field>

      <Checkbox checked={!!form.isMain}
        onChange={(v) => setForm((f) => ({ ...f, isMain: v }))}
        label="Main branch" hint="Mark as the primary branch for this company" />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create branch"}
        </Btn>
      </div>
    </div>
  );
}

// ── Step: Stock locations ─────────────────────────────────────────────────────

function StockLocationsStep({
  companyId, branchId, items, onRefresh,
}: {
  companyId: string;
  branchId:  string;
  items:     StockLocation[];
  onRefresh: () => Promise<void>;
}) {
  const [name, setName]     = useState("");
  const [code, setCode]     = useState("");
  const [type, setType]     = useState(String(StockLocationType.Warehouse));
  const [busy, setBusy]     = useState(false);
  const [err,  setErr]      = useState<string | null>(null);

  // Inline edit state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName,  setEditName]    = useState("");
  const [editCode,  setEditCode]    = useState("");
  const [editType,  setEditType]    = useState(String(StockLocationType.Warehouse));
  const [editBusy,  setEditBusy]    = useState(false);

  function startEdit(x: StockLocation) {
    setEditingId(x.id);
    setEditName(x.name ?? "");
    setEditCode(x.code ?? "");
    setEditType(String(x.type ?? StockLocationType.Warehouse));
  }

  async function saveEdit() {
    if (!editingId) return;
    setEditBusy(true); setErr(null);
    try {
      await onboardingApi.updateStockLocation(companyId, branchId, editingId, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        locationType: editType,
      });
      setEditingId(null);
      await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to update location.")); }
    finally { setEditBusy(false); }
  }

  async function setDefault(locationId: string, type: "receiving" | "issue") {
    setBusy(true); setErr(null);
    try {
      if (type === "receiving")
        await onboardingApi.setDefaultReceiving(companyId, branchId, locationId);
      else
        await onboardingApi.setDefaultIssue(companyId, branchId, locationId);
      await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to set default.")); }
    finally { setBusy(false); }
  }

  async function create() {
    if (!name.trim() || !code.trim()) { setErr("Name and code are required."); return; }
    setBusy(true); setErr(null);
    try {
      await onboardingApi.createStockLocation(companyId, branchId, {
        name: name.trim(), code: code.trim(), locationType: Number(type),
      });
      setName(""); setCode(""); await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to create location.")); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <Alert tone="danger" title="Error" message={err} />}

      {/* ── Existing locations ──────────────────────────────────────────── */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((x) => {
            const isEditing = editingId === x.id;
            return (
              <div key={x.id} style={{
                border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden",
                background: isEditing ? "#f8faff" : "#fff",
              }}>
                {/* Row header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{x.name}</span>
                      <span style={{
                        fontFamily: "monospace", fontSize: 11,
                        background: "#f1f5f9", padding: "1px 6px", borderRadius: 5, color: "#64748b",
                      }}>
                        {x.code}
                      </span>
                      <span style={{ fontSize: 11, color: "#475569" }}>
                        {stockLocationTypeLabel(x.type)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                      {x.isDefaultReceiving && (
                        <span className="ob-badge ob-badge--success">Default Receiving</span>
                      )}
                      {x.isDefaultIssue && (
                        <span className="ob-badge ob-badge--info">Default Issue</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap" }}>
                    {!x.isDefaultReceiving && (
                      <Btn variant="ghost" onClick={() => setDefault(x.id, "receiving")}
                        disabled={busy} style={{ padding: "3px 9px", fontSize: 11, minHeight: 26 }}>
                        Set Receiving
                      </Btn>
                    )}
                    {!x.isDefaultIssue && (
                      <Btn variant="ghost" onClick={() => setDefault(x.id, "issue")}
                        disabled={busy} style={{ padding: "3px 9px", fontSize: 11, minHeight: 26 }}>
                        Set Issue
                      </Btn>
                    )}
                    <Btn variant="ghost" onClick={() => isEditing ? setEditingId(null) : startEdit(x)}
                      disabled={editBusy} style={{ padding: "3px 9px", fontSize: 11, minHeight: 26 }}>
                      {isEditing ? "Cancel" : "Edit"}
                    </Btn>
                  </div>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{
                    borderTop: "1px solid #e2e8f0", background: "#f8fafc",
                    padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10,
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <Field label="Name" required>
                        <Input value={editName} onChange={setEditName} disabled={editBusy} />
                      </Field>
                      <Field label="Code" required>
                        <Input value={editCode} onChange={(v) => setEditCode(v.toUpperCase())} disabled={editBusy} />
                      </Field>
                      <Field label="Type">
                        <SelectInput value={editType} onChange={setEditType}
                          options={LOCATION_TYPE_OPTIONS} disabled={editBusy} />
                      </Field>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <Btn variant="ghost" onClick={() => setEditingId(null)} disabled={editBusy}>Discard</Btn>
                      <Btn variant="primary" onClick={saveEdit} disabled={editBusy}>
                        {editBusy ? "Saving…" : "Save changes"}
                      </Btn>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add new location ────────────────────────────────────────────── */}
      <div className="ob-inner-card">
        <button type="button" style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", background: "none", border: "none",
          borderBottom: items.length > 0 ? "none" : "1px solid #e2e8f0",
          cursor: "default",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
            {items.length > 0 ? "Add another location" : "Add stock location"}
          </span>
        </button>
        <div className="ob-inner-card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
            <Field label="Name" required>
              <Input value={name} onChange={setName} placeholder="Main Warehouse" disabled={busy} />
            </Field>
            <Field label="Code" required>
              <Input value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="WH-001" disabled={busy} />
            </Field>
            <Field label="Type">
              <SelectInput value={type} onChange={setType} options={LOCATION_TYPE_OPTIONS} disabled={busy} />
            </Field>
            <Btn variant="primary" onClick={create} disabled={busy}>
              {busy ? "…" : "Add"}
            </Btn>
          </div>
        </div>
      </div>

      {items.length === 0 && (
        <EmptyState title="No stock locations yet"
          sub="Add at least one warehouse or kitchen location." />
      )}
    </div>
  );
}

// ── Step: Stores ──────────────────────────────────────────────────────────────

function StoresStep({
  companyId, branchId, stores, stockLocations, onRefresh,
}: {
  companyId:      string;
  branchId:       string;
  stores:         StoreDto[];
  stockLocations: StockLocation[];
  onRefresh:      () => Promise<void>;
}) {
  const [name, setName]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState<string | null>(null);

  // Inline edit state
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editName,    setEditName]    = useState("");
  const [editBusy,    setEditBusy]    = useState(false);

  // Per-store map-busy state
  const [mappingId, setMappingId] = useState<string | null>(null);

  const activeLocations = stockLocations.filter((l) => l.isActive !== false);
  const locationOptions = [
    { value: "", label: "Select issue location…" },
    ...activeLocations.map((l) => ({
      value: l.id,
      label: `${l.name}${l.code ? ` (${l.code})` : ""}`,
    })),
  ];

  function getMappedName(s: StoreDto) {
    const id = (s as any).defaultIssueStockLocationId ?? (s as any).issueStockLocationId ?? "";
    return stockLocations.find((l) => l.id === id)?.name ?? null;
  }

  async function mapIssueLocation(storeId: string, locationId: string) {
    if (!locationId) return;
    setMappingId(storeId);
    try {
      await onboardingApi.mapStoreIssueLocation(companyId, branchId, storeId, locationId);
      await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to map store.")); }
    finally { setMappingId(null); }
  }

  async function saveEdit(storeId: string) {
    setEditBusy(true); setErr(null);
    try {
      await onboardingApi.updateStore(companyId, branchId, storeId, { name: editName.trim() });
      setEditingId(null);
      await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to update store.")); }
    finally { setEditBusy(false); }
  }

  async function create() {
    if (!name.trim()) { setErr("Store name is required."); return; }
    setBusy(true); setErr(null);
    try {
      await onboardingApi.createStore(companyId, branchId, { name: name.trim() });
      setName(""); await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to create store.")); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <Alert tone="danger" title="Error" message={err} />}

      {activeLocations.length === 0 && (
        <Alert tone="warn" title="Create stock locations first"
          message="Stores can be created now, but cannot be mapped until a stock location exists." />
      )}

      {/* ── Existing stores ──────────────────────────────────────────────── */}
      {stores.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stores.map((s) => {
            const isEditing  = editingId === s.id;
            const mappedName = getMappedName(s);
            const mappedId   = (s as any).defaultIssueStockLocationId
                            ?? (s as any).issueStockLocationId
                            ?? "";

            return (
              <div key={s.id} style={{
                border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden",
                background: isEditing ? "#f8faff" : "#fff",
              }}>
                {/* Row header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{s.name}</div>
                    <div style={{ marginTop: 3 }}>
                      {mappedName
                        ? <span className="ob-badge ob-badge--success">{mappedName}</span>
                        : <span className="ob-badge ob-badge--warn">No issue location mapped</span>
                      }
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <Btn variant="ghost"
                      onClick={() => { setEditingId(isEditing ? null : s.id); setEditName(s.name ?? ""); }}
                      disabled={editBusy}
                      style={{ padding: "3px 9px", fontSize: 11, minHeight: 26 }}>
                      {isEditing ? "Cancel" : "Edit"}
                    </Btn>
                  </div>
                </div>

                {/* Issue location mapping — always visible */}
                {!isEditing && activeLocations.length > 0 && (
                  <div style={{
                    borderTop: "1px solid #f1f5f9",
                    padding: "8px 14px",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>
                      Issue location:
                    </span>
                    <SelectInput
                      value={mappedId}
                      onChange={(v) => mapIssueLocation(s.id, v)}
                      options={locationOptions}
                      disabled={mappingId === s.id}
                    />
                  </div>
                )}

                {/* Inline edit */}
                {isEditing && (
                  <div style={{
                    borderTop: "1px solid #e2e8f0", background: "#f8fafc",
                    padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end",
                  }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Store name" required>
                        <Input value={editName} onChange={setEditName} disabled={editBusy} />
                      </Field>
                    </div>
                    <Btn variant="ghost" onClick={() => setEditingId(null)} disabled={editBusy}>
                      Discard
                    </Btn>
                    <Btn variant="primary" onClick={() => saveEdit(s.id)} disabled={editBusy}>
                      {editBusy ? "Saving…" : "Save"}
                    </Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add new store ────────────────────────────────────────────────── */}
      <div className="ob-inner-card">
        <div className="ob-inner-card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
            <Field label={stores.length > 0 ? "Add another store" : "Store name"} required>
              <Input value={name} onChange={setName}
                placeholder="e.g. Main POS, Ground Floor Restaurant" disabled={busy} />
            </Field>
            <Btn variant="primary" onClick={create} disabled={busy}>
              {busy ? "…" : "Add store"}
            </Btn>
          </div>
        </div>
      </div>

      {stores.length === 0 && (
        <EmptyState title="No stores yet" sub="Stores are POS and sales units." />
      )}
    </div>
  );
}

// ── Step: Users ───────────────────────────────────────────────────────────────

function UsersStep({
  companyId, branchId, members, onRefresh,
}: {
  companyId: string; branchId: string;
  members:   BranchUserDto[]; onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreateBranchUserFormValue>({
    userName: "", email: "", password: "",
    firstName: "", lastName: "", role: "BranchAdmin",
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  const adminCount = members.filter((m) => m.role === "BranchAdmin").length;

  function initials(m: BranchUserDto) {
    const name = branchUserDisplayName(m);
    return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  }

  async function createUser() {
    if (!form.userName.trim() || !form.email.trim() || !form.password) {
      setErr("Username, email and password are required."); return;
    }
    setBusy(true); setErr(null);
    try {
      const created = await onboardingApi.createUser(companyId, {
        userName: form.userName.trim(), email: form.email.trim().toLowerCase(),
        password: form.password, firstName: form.firstName.trim(),
        lastName: form.lastName.trim(), branchId, storeId: null,
      });
      await onboardingApi.assignBranchUser(companyId, branchId, created.id, form.role);
      setForm({ userName: "", email: "", password: "", firstName: "", lastName: "", role: "BranchAdmin" });
      await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to create user.")); }
    finally { setBusy(false); }
  }

  async function removeUser(userId: string) {
    if (!window.confirm("Remove this user from the branch?")) return;
    const member = members.find((m) => m.userId === userId);
    if (member?.role === "BranchAdmin" && adminCount <= 1) {
      setErr("Cannot remove the last Branch Admin."); return;
    }
    setBusy(true);
    try {
      await onboardingApi.removeBranchUser(companyId, branchId, userId);
      await onRefresh();
    } catch (e) { setErr(extractApiError(e, "Failed to remove user.")); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {err && <Alert tone="danger" title="Error" message={err} />}

      <CreateBranchUserForm value={form} onChange={setForm} onSubmit={createUser} busy={busy} />

      {members.length > 0 && (
        <div>
          <div className="ob-members-hdr">
            Branch members ({members.length}) · {adminCount} admin{adminCount !== 1 ? "s" : ""}
          </div>
          {members.map((m) => {
            const isAdmin = m.role === "BranchAdmin";
            return (
              <div key={m.userId} className="ob-list-row">
                <div className={`ob-avatar ${isAdmin ? "ob-avatar--admin" : "ob-avatar--staff"}`}>
                  {initials(m)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                    {branchUserDisplayName(m)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.email}</div>
                </div>
                <span className={`ob-badge ${isAdmin ? "ob-badge--success" : "ob-badge--default"}`}>
                  {m.role}
                </span>
                <Btn variant="ghost" onClick={() => removeUser(m.userId)} disabled={busy}
                  style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>
                  Remove
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step: Review ──────────────────────────────────────────────────────────────

function ReviewStep({
  branch, branchId, stockLocations, stores, members, onFinish,
}: {
  branch:         BranchDto | null;
  branchId:       string;
  stockLocations: StockLocation[];
  stores:         StoreDto[];
  members:        BranchUserDto[];
  onFinish:       () => void;
}) {
  const hasBranchAdmin = members.some((m) => m.role === "BranchAdmin");
  const canFinish = !!branchId && hasBranchAdmin;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {branch && (
        <div className="ob-inner-card">
          <div className="ob-inner-card-header">
            <div className="ob-inner-card-title">Branch</div>
          </div>
          <div className="ob-inner-card-body">
            <InfoRow label="Name"   value={branch.name}          />
            <InfoRow label="Code"   value={branch.code}          />
            <InfoRow label="City"   value={branch.city   ?? null} />
            <InfoRow label="Region" value={branch.region ?? null} />
          </div>
        </div>
      )}

      <div>
        <div className="ob-section-title" style={{ marginBottom: 10 }}>Setup checklist</div>
        <CheckItem done={!!branchId}                title="Branch created"                                                                                required />
        <CheckItem done={stockLocations.length > 0} title={`${stockLocations.length} stock location${stockLocations.length !== 1 ? "s" : ""} configured`} />
        <CheckItem done={stores.length > 0}         title={`${stores.length} store${stores.length !== 1 ? "s" : ""} configured`}                          />
        <CheckItem done={hasBranchAdmin}            title="At least one branch admin assigned"                                                             required />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="primary" onClick={onFinish} disabled={!canFinish}>
          {canFinish ? "Finish setup" : "Complete required steps above"}
        </Btn>
      </div>
    </div>
  );
}