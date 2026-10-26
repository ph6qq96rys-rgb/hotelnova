import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import {
  DEPRECIATION_METHODS,
  fixedAssetsApi,
  type DepreciationMethod,
  type FixedAssetCategory,
  type UpsertFixedAssetCategoryPayload,
} from "../api/fixedAssetsApi";
import { apiError, FaDialog, Field, METHOD_LABEL, money } from "./faShared";

const blank: UpsertFixedAssetCategoryPayload = {
  code: "",
  name: "",
  description: "",
  assetAccountCode: "",
  accumulatedDepreciationAccountCode: "",
  depreciationExpenseAccountCode: "",
  depreciationMethod: "straightLine",
  usefulLifeMonths: 60,
  residualValuePercent: 0,
  capitalizationThreshold: 0,
  inspectionIntervalDays: 180,
  requiresSerialNumber: false,
  requiresTagBeforeActivation: true,
  requiresCustodianOnActivation: true,
  isActive: true,
};

/** Asset classes: depreciation defaults, GL accounts for the journal, and the controls applied at activation. */
export function CategoriesPanel({ companyId, categories, onChanged }: { companyId: string; categories: FixedAssetCategory[]; onChanged: (message: string) => void }) {
  const { tx } = useI18n();
  const canCreate = useHasPermission("fixedassets.register");
  const canEdit = useHasPermission("fixedassets.edit");
  const [editing, setEditing] = useState<FixedAssetCategory | "new" | null>(null);
  const [draft, setDraft] = useState<UpsertFixedAssetCategoryPayload>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (category: FixedAssetCategory | "new") => {
    setError(null);
    setEditing(category);
    setDraft(category === "new" ? blank : {
      ...category,
      description: category.description ?? "",
      assetAccountCode: category.assetAccountCode ?? "",
      accumulatedDepreciationAccountCode: category.accumulatedDepreciationAccountCode ?? "",
      depreciationExpenseAccountCode: category.depreciationExpenseAccountCode ?? "",
    });
  };
  const set = (patch: Partial<UpsertFixedAssetCategoryPayload>) => setDraft((d) => ({ ...d, ...patch }));
  const depreciating = draft.depreciationMethod === "straightLine" || draft.depreciationMethod === "reducingBalance";
  const problem = !draft.code.trim() ? "Enter a code." : !draft.name.trim() ? "Enter a name."
    : depreciating && !(draft.usefulLifeMonths >= 1) ? "Useful life must be at least one month."
    : draft.residualValuePercent < 0 || draft.residualValuePercent > 100 ? "Residual value must be between 0 and 100 %."
    : null;

  const save = async () => {
    if (problem || !editing) return;
    setBusy(true);
    setError(null);
    const body = {
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      assetAccountCode: draft.assetAccountCode?.trim() || null,
      accumulatedDepreciationAccountCode: draft.accumulatedDepreciationAccountCode?.trim() || null,
      depreciationExpenseAccountCode: draft.depreciationExpenseAccountCode?.trim() || null,
    };
    try {
      const saved = editing === "new" ? await fixedAssetsApi.createCategory(companyId, body) : await fixedAssetsApi.updateCategory(companyId, editing.id, body);
      setEditing(null);
      onChanged(tx("Category {code} saved.", { code: saved.code }));
    } catch (err) {
      setError(apiError(err, tx("The category could not be saved.")));
    } finally {
      setBusy(false);
    }
  };

  const missingAccounts = categories.filter((c) => c.isActive && (!c.depreciationExpenseAccountCode || !c.accumulatedDepreciationAccountCode)).length;

  return (
    <section className="fa-panel">
      <header className="fa-panel-head">
        <div>
          <h2>{tx("Asset categories")}</h2>
          <p className="fa-muted">{tx("Each category sets the default depreciation, the accounts used in the journal, and what is checked before an asset can be activated.")}</p>
        </div>
        {canCreate ? <Button type="button" onClick={() => open("new")}><Plus size={15} aria-hidden="true" /> {tx("New category")}</Button> : null}
      </header>
      {missingAccounts ? <p className="fa-note fa-note--warn">{tx("{n} active categor(ies) have no expense or accumulated depreciation account; their journal lines will show \"not set\".", { n: missingAccounts })}</p> : null}
      <div className="fa-table-wrap">
        <table className="ui-table fa-table">
          <thead><tr>
            <th>{tx("Category")}</th><th>{tx("Depreciation")}</th><th>{tx("Accounts")}</th><th>{tx("Controls")}</th><th>{tx("Status")}</th><th />
          </tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className={c.isActive ? "" : "is-inactive"}>
                <td><strong>{c.code}</strong><span>{c.name}</span></td>
                <td>{tx(METHOD_LABEL[c.depreciationMethod])}<span>{tx("{months} months · residual {pct}%", { months: c.usefulLifeMonths, pct: c.residualValuePercent })}</span></td>
                <td>
                  <span>{tx("Asset")}: {c.assetAccountCode || "—"}</span>
                  <span>{tx("Expense")}: {c.depreciationExpenseAccountCode || "—"}</span>
                  <span>{tx("Accumulated")}: {c.accumulatedDepreciationAccountCode || "—"}</span>
                </td>
                <td>
                  <span>{c.capitalizationThreshold > 0 ? tx("From {amount}", { amount: money(c.capitalizationThreshold) }) : tx("Any cost")}</span>
                  <span>{c.inspectionIntervalDays > 0 ? tx("Inspect every {days} days", { days: c.inspectionIntervalDays }) : tx("No inspections")}</span>
                  <span>{[c.requiresTagBeforeActivation && tx("tag"), c.requiresSerialNumber && tx("serial"), c.requiresCustodianOnActivation && tx("custodian")].filter(Boolean).join(", ") || "—"}</span>
                </td>
                <td>{tx(c.isActive ? "Active" : "Inactive")}</td>
                <td className="fa-row-actions">{canEdit ? <Button type="button" size="sm" variant="outline" onClick={() => open(c)}><Pencil size={14} aria-hidden="true" /> {tx("Edit")}</Button> : null}</td>
              </tr>
            ))}
            {categories.length === 0 ? <tr><td colSpan={6} className="fa-empty">{tx("No categories yet. Create one before registering assets.")}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <FaDialog open={!!editing} wide busy={busy} error={error} confirmDisabled={!!problem}
        title={editing === "new" ? tx("New category") : `${tx("Edit category")} · ${editing ? (editing as FixedAssetCategory).code : ""}`}
        description={editing !== "new" ? tx("Changes apply to new assets. Assets already registered keep their own life, residual value and method.") : undefined}
        confirmText={tx("Save category")} onClose={() => setEditing(null)} onConfirm={() => void save()}>
        <div className="fa-grid">
          <Field label={tx("Code")}><Input value={draft.code} maxLength={40} onChange={(e) => set({ code: e.target.value })} /></Field>
          <Field label={tx("Name")}><Input value={draft.name} maxLength={160} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={tx("Depreciation method")}>
            <Select value={draft.depreciationMethod} onChange={(e) => set({ depreciationMethod: e.target.value as DepreciationMethod })}>
              {DEPRECIATION_METHODS.map((m) => <option key={m} value={m}>{tx(METHOD_LABEL[m])}</option>)}
            </Select>
          </Field>
          <Field label={tx("Useful life (months)")}><Input type="number" min={0} value={draft.usefulLifeMonths} onChange={(e) => set({ usefulLifeMonths: Number(e.target.value) })} /></Field>
          <Field label={tx("Residual value %")}><Input type="number" min={0} max={100} step="0.01" value={draft.residualValuePercent} onChange={(e) => set({ residualValuePercent: Number(e.target.value) })} /></Field>
          <Field label={tx("Capitalize from (cost)")} hint={tx("Cheaper items are expensed, not registered.")}>
            <Input type="number" min={0} step="0.01" value={draft.capitalizationThreshold} onChange={(e) => set({ capitalizationThreshold: Number(e.target.value) })} />
          </Field>
          <Field label={tx("Inspection every (days)")} hint={tx("0 = no scheduled inspections.")}>
            <Input type="number" min={0} value={draft.inspectionIntervalDays} onChange={(e) => set({ inspectionIntervalDays: Number(e.target.value) })} />
          </Field>
          <Field label={tx("Asset account")}><Input value={draft.assetAccountCode ?? ""} maxLength={80} onChange={(e) => set({ assetAccountCode: e.target.value })} /></Field>
          <Field label={tx("Depreciation expense account")}><Input value={draft.depreciationExpenseAccountCode ?? ""} maxLength={80} onChange={(e) => set({ depreciationExpenseAccountCode: e.target.value })} /></Field>
          <Field label={tx("Accumulated depreciation account")}><Input value={draft.accumulatedDepreciationAccountCode ?? ""} maxLength={80} onChange={(e) => set({ accumulatedDepreciationAccountCode: e.target.value })} /></Field>
        </div>
        <div className="fa-checks">
          <label className="fa-check"><Checkbox checked={draft.requiresTagBeforeActivation} onChange={(e) => set({ requiresTagBeforeActivation: e.target.checked })} /> {tx("Asset tag required before activation")}</label>
          <label className="fa-check"><Checkbox checked={draft.requiresSerialNumber} onChange={(e) => set({ requiresSerialNumber: e.target.checked })} /> {tx("Serial number required")}</label>
          <label className="fa-check"><Checkbox checked={draft.requiresCustodianOnActivation} onChange={(e) => set({ requiresCustodianOnActivation: e.target.checked })} /> {tx("Custodian or department required before activation")}</label>
          <label className="fa-check"><Checkbox checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> {tx("Active (offered for new assets)")}</label>
        </div>
        <Field label={tx("Description")} wide><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
        {problem ? <p className="fa-muted">{tx(problem)}</p> : null}
      </FaDialog>
    </section>
  );
}
