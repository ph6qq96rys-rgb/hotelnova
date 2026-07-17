// src/modules/company/onboarding/steps/BranchStep.tsx
// ERP-grade branch setup step.
// Security rules:
// - CompanyAdmin: create/edit/delete branches.
// - BranchAdmin: edit assigned branch only when allowed by access flags.
// - BranchManager and other branch-level users: select assigned branch only; no configuration.

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import type { BranchDto, CreateBranchDto } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import { DEFAULT_BRANCH_FORM } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError, trimOrNull } from "../utils/onboarding.utils";
import { Alert, Btn, Checkbox, EmptyState, Field, Input, Spinner, TextArea } from "../components/company.ui";

type BranchStepAccess = {
  canCreateBranch: boolean;
  canEditBranch: boolean;
  canDeleteBranch: boolean;
  canViewAllBranches: boolean;
  /** For BranchAdmin/BranchManager. CompanyAdmin/SystemAdmin may pass [] with canViewAllBranches=true. */
  assignedBranchIds: string[];
};

type Props = {
  companyId: string | null;
  activeBranchId: string | null;
  saving: boolean;
  access: BranchStepAccess;
  onCreated: (branch: BranchDto) => Promise<void> | void;
  onSelected: (branchId: string) => void;
  onUpdated?: (branch: BranchDto) => Promise<void> | void;
  onDeleted?: (branchId: string) => Promise<void> | void;
  dispatch: React.Dispatch<OnboardingAction>;
};

function idOf(value: any): string {
  return String(value?.id ?? value?.branchId ?? value?.Id ?? "").trim();
}

function branchName(value: any): string {
  return String(value?.name ?? value?.branchName ?? "Unnamed branch");
}

function toForm(branch: BranchDto): CreateBranchDto {
  const x = branch as any;
  return {
    code: String(x.code ?? ""),
    name: String(x.name ?? ""),
    region: String(x.region ?? ""),
    city: String(x.city ?? ""),
    addressLine: String(x.addressLine ?? ""),
    isMain: Boolean(x.isMain),
    hasSalesOperations: x.hasSalesOperations ?? true,
  } as any;
}

function validate(form: CreateBranchDto, setErrors: (e: FieldErrors) => void) {
  const errors: FieldErrors = {};
  if (!String((form as any).code ?? "").trim()) errors.code = "Branch code is required.";
  if (!String((form as any).name ?? "").trim()) errors.name = "Branch name is required.";
  setErrors(errors);
  return Object.keys(errors).length === 0;
}

function normalize(form: CreateBranchDto): CreateBranchDto {
  return {
    ...form,
    code: String((form as any).code ?? "").trim().toUpperCase(),
    name: String((form as any).name ?? "").trim(),
    region: trimOrNull((form as any).region),
    city: trimOrNull((form as any).city),
    addressLine: trimOrNull((form as any).addressLine),
    isMain: Boolean((form as any).isMain),
    hasSalesOperations: (form as any).hasSalesOperations ?? true,
  } as any;
}

function ReadonlyRow(props: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ color: "#94a3b8", fontSize: 12 }}>{props.label}</span>
      <strong style={{ color: "#334155", fontSize: 13 }}>{props.value || "—"}</strong>
    </div>
  );
}

function BranchForm(props2: { value: CreateBranchDto; errors: FieldErrors; onChange: (next: CreateBranchDto) => void }) {
  const f = props2.value as any;
  const set = (patch: Record<string, unknown>) => props2.onChange({ ...props2.value, ...patch } as any);
  return (
    <div className="ob-grid-2">
      <Field label="Branch code" required error={props2.errors.code}><Input value={String(f.code ?? "")} onChange={(v) => set({ code: v.toUpperCase() })} placeholder="YODA" /></Field>
      <Field label="Branch name" required error={props2.errors.name}><Input value={String(f.name ?? "")} onChange={(v) => set({ name: v })} placeholder="YODA Branch" /></Field>
      <Field label="Region"><Input value={String(f.region ?? "")} onChange={(v) => set({ region: v })} /></Field>
      <Field label="City"><Input value={String(f.city ?? "")} onChange={(v) => set({ city: v })} /></Field>
      <Field label="Address"><TextArea value={String(f.addressLine ?? "")} onChange={(v) => set({ addressLine: v })} /></Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 24 }}>
        <Checkbox label="Main branch" checked={Boolean(f.isMain)} onChange={(v) => set({ isMain: v })} />
        <Checkbox label="Sales-enabled branch" checked={f.hasSalesOperations !== false} onChange={(v) => set({ hasSalesOperations: v })} hint="When enabled, at least one POS/store is required. One or more POS are supported." />
      </div>
    </div>
  );
}

function BranchReadonly(props2: { branch: BranchDto }) {
  const x = props2.branch as any;
  return (
    <div className="ob-inner-card-body" style={{ borderTop: "1px solid #e2e8f0" }}>
      <div className="ob-grid-2">
        <ReadonlyRow label="Branch code" value={x.code} />
        <ReadonlyRow label="Region" value={x.region} />
        <ReadonlyRow label="City" value={x.city} />
        <ReadonlyRow label="Address" value={x.addressLine} />
        <ReadonlyRow label="Branch type" value={x.isMain ? "Main branch" : "Operational branch"} />
        <ReadonlyRow label="Sales operations" value={x.hasSalesOperations !== false ? "Enabled" : "Disabled"} />
      </div>
    </div>
  );
}

export function BranchStep(props: Props) {
  const assignedSet = useMemo(
    () => new Set(props.access.assignedBranchIds.map((x) => String(x).trim().toLowerCase()).filter(Boolean)),
    [props.access.assignedBranchIds],
  );

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CreateBranchDto>({ ...DEFAULT_BRANCH_FORM, hasSalesOperations: true } as any);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSavingId, setDeleteSavingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateBranchDto>({ ...DEFAULT_BRANCH_FORM, hasSalesOperations: true } as any);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createSaving, setCreateSaving] = useState(false);

  const canAccessBranch = useCallback(
    (branchId: string) => props.access.canViewAllBranches || assignedSet.has(branchId.toLowerCase()),
    [assignedSet, props.access.canViewAllBranches],
  );

  const visibleBranches = useMemo(
    () => branches.filter((branch) => canAccessBranch(idOf(branch))),
    [branches, canAccessBranch],
  );

  const fetchBranches = useCallback(async () => {
    if (!props.companyId) {
      setBranches([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      // API must enforce server-side branch visibility. Client filtering below is a defensive UI fallback only.
      const data = await onboardingApi.listBranches(props.companyId);
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      setBranches([]);
      setLoadError(extractApiError(err, "Failed to load branches."));
    } finally {
      setLoading(false);
    }
  }, [props.companyId]);

  useEffect(() => { void fetchBranches(); }, [fetchBranches]);

  useEffect(() => {
    if (props.access.canCreateBranch && !loading && props.companyId && branches.length === 0) setShowCreate(true);
    if (!props.access.canCreateBranch) setShowCreate(false);
  }, [branches.length, loading, props.access.canCreateBranch, props.companyId]);

  function canEditSpecificBranch(branchId: string) {
    return props.access.canEditBranch && canAccessBranch(branchId);
  }

  function canDeleteSpecificBranch(branch: BranchDto) {
    const branchId = idOf(branch);
    const x = branch as any;
    return props.access.canDeleteBranch && canAccessBranch(branchId) && !x.isMain;
  }

  function openEdit(branch: BranchDto) {
    const branchId = idOf(branch);
    if (!canEditSpecificBranch(branchId)) return;
    setExpandedId(branchId);
    setEditForm(toForm(branch));
    setEditErrors({});
  }

  async function saveEdit(branchId: string) {
    if (!canEditSpecificBranch(branchId)) {
      props.dispatch({ type: "SAVE_ERROR", error: "You are not authorized to configure this branch." });
      return;
    }

    if (!props.companyId || !branchId || !validate(editForm, setEditErrors)) return;

    setEditSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const updated = await onboardingApi.updateBranch(props.companyId, branchId, normalize(editForm));
      setBranches((current) => current.map((branch) => (idOf(branch) === branchId ? updated : branch)));
      await props.onUpdated?.(updated);
      setExpandedId(null);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Branch updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update branch.") });
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteBranch(branch: BranchDto) {
    const branchId = idOf(branch);
    if (!props.companyId || !branchId) return;

    if (!canDeleteSpecificBranch(branch)) {
      props.dispatch({ type: "SAVE_ERROR", error: "You are not authorized to delete this branch. Main branches cannot be deleted from this step." });
      return;
    }

    setDeleteSavingId(branchId);
    props.dispatch({ type: "SAVE_START" });

    try {
      const api = onboardingApi as any;
      if (typeof api.deleteBranch !== "function") {
        throw new Error("Branch delete API is not available in onboardingApi.");
      }

      await api.deleteBranch(props.companyId, branchId);
      setBranches((current) => current.filter((item) => idOf(item) !== branchId));
      await props.onDeleted?.(branchId);
      if (props.activeBranchId === branchId) props.onSelected("");
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Branch deleted." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to delete branch.") });
    } finally {
      setDeleteSavingId(null);
    }
  }

  async function createBranch() {
    if (!props.access.canCreateBranch) {
      props.dispatch({ type: "SAVE_ERROR", error: "Only a CompanyAdmin can create branches." });
      return;
    }

    if (!props.companyId || !validate(createForm, setCreateErrors)) return;

    setCreateSaving(true);
    props.dispatch({ type: "SAVE_START" });

    try {
      const created = await onboardingApi.createBranch(props.companyId, normalize(createForm));
      const branchId = idOf(created);
      if (!branchId) throw new Error("Branch was created but the API did not return a branch id.");
      setBranches((current) => [...current, created]);
      props.onSelected(branchId);
      await props.onCreated(created);
      setCreateForm({ ...DEFAULT_BRANCH_FORM, hasSalesOperations: true } as any);
      setCreateErrors({});
      setShowCreate(false);
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Branch created. Continue with stock location assignment." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create branch.") });
    } finally {
      setCreateSaving(false);
    }
  }

  function selectBranch(branchId: string) {
    if (!branchId || !canAccessBranch(branchId)) {
      props.dispatch({ type: "SAVE_ERROR", error: "You can only switch to branches assigned to your user account." });
      return;
    }
    props.onSelected(branchId);
  }

  if (loading) return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#64748b" }}><Spinner /> Loading branches…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!props.companyId && <Alert tone="warn" title="Select company first" message="Branch setup starts after a company is selected." />}
      {loadError && <Alert tone="danger" title="Unable to load branches" message={loadError} />}
      {!props.access.canCreateBranch && !props.access.canEditBranch && <Alert tone="warn" title="Branch administration is locked" message="Your role can only work inside branches assigned to your account. Creating, configuring, deleting, or viewing other branches is restricted." />}
      {visibleBranches.length === 0 && !showCreate && <EmptyState title="No accessible branches" sub={props.access.canCreateBranch ? "Create the first operational branch." : "Ask a CompanyAdmin to assign your user to a branch."} />}

      {visibleBranches.map((branch) => {
        const branchId = idOf(branch);
        const x = branch as any;
        const active = branchId === props.activeBranchId;
        const expanded = branchId === expandedId;
        const canEdit = canEditSpecificBranch(branchId);
        const canDelete = canDeleteSpecificBranch(branch);

        return (
          <div key={branchId} className="ob-inner-card" style={{ borderColor: active ? "#6366f1" : undefined }}>
            <div className="ob-inner-card-body" style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <strong>{branchName(branch)}</strong>
                  {x.code && <span className="ob-badge">{x.code}</span>}
                  {x.isMain && <span className="ob-badge ob-badge--success">Main</span>}
                  {x.hasSalesOperations !== false && <span className="ob-badge ob-badge--info">Sales-enabled</span>}
                  {active && <span className="ob-badge ob-badge--success">Current branch</span>}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{x.city ?? "—"} · supports one or more POS/stores</div>
              </div>

              <Btn variant="ghost" onClick={() => selectBranch(branchId)} disabled={!branchId || active}>Use branch</Btn>

              {canEdit ? <Btn variant="ghost" onClick={() => (expanded ? setExpandedId(null) : openEdit(branch))}>{expanded ? "Close" : "Configure"}</Btn> : null}

              {props.access.canDeleteBranch ? (
                <Btn variant="ghost" onClick={() => void deleteBranch(branch)} disabled={!canDelete || deleteSavingId === branchId || props.saving}>{deleteSavingId === branchId ? "Deleting…" : "Delete"}</Btn>
              ) : null}
            </div>

            {expanded && canEdit && (
              <div className="ob-inner-card-body" style={{ borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 16 }}>
                {Object.values(editErrors).filter(Boolean).map((m) => <Alert key={m} tone="danger" title="Validation" message={m!} />)}
                <BranchForm value={editForm} errors={editErrors} onChange={setEditForm} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn variant="primary" onClick={() => void saveEdit(branchId)} disabled={editSaving || props.saving}>{editSaving ? "Saving…" : "Save branch"}</Btn></div>
              </div>
            )}

            {!canEdit && active && <BranchReadonly branch={branch} />}
          </div>
        );
      })}

      {props.access.canCreateBranch && (
        <div className="ob-inner-card">
          <button type="button" onClick={() => setShowCreate((v) => !v)} style={{ width: "100%", padding: 14, background: "transparent", border: "none", textAlign: "left", cursor: "pointer" }}>
            <strong>{showCreate ? "Close branch form" : "+ Add branch"}</strong>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>A branch can have assigned stock locations and one or more POS/stores.</div>
          </button>
          {showCreate && (
            <div className="ob-inner-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.values(createErrors).filter(Boolean).map((m) => <Alert key={m} tone="danger" title="Validation" message={m!} />)}
              <BranchForm value={createForm} errors={createErrors} onChange={setCreateForm} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn variant="primary" onClick={() => void createBranch()} disabled={createSaving || props.saving || !props.companyId}>{createSaving ? "Creating…" : "Create branch"}</Btn></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
