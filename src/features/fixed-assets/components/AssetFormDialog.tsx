import { useEffect, useMemo, useState } from "react";

import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import {
  ACQUISITION_METHODS,
  CONDITIONS,
  DEPRECIATION_METHODS,
  fixedAssetsApi,
  type FixedAssetCategory,
  type FixedAssetDetail,
  type FixedAssetLookups,
  type UpsertFixedAssetPayload,
} from "../api/fixedAssetsApi";
import {
  ACQUISITION_LABEL,
  apiError,
  CONDITION_LABEL,
  FaDialog,
  Field,
  fromDateInput,
  METHOD_LABEL,
  money,
  toDateInput,
  todayInput,
} from "./faShared";

/** Prefill from an accepted purchase order line (procurement hand-off). */
export type AssetSource = { purchaseOrderId: string; name: string; description: string; unitCost: number; reference: string; quantity: number };

type Props = {
  companyId: string;
  open: boolean;
  /** Edit this asset; register a new draft when null. */
  asset: FixedAssetDetail | null;
  categories: FixedAssetCategory[];
  defaultBranchId: string | null;
  source?: AssetSource | null;
  onClose: () => void;
  onSaved: (asset: FixedAssetDetail, created: boolean) => void;
};

type Draft = {
  categoryId: string;
  assetNo: string;
  assetTagNumber: string;
  name: string;
  description: string;
  brand: string;
  model: string;
  serialNumber: string;
  barcode: string;
  acquisitionMethod: UpsertFixedAssetPayload["acquisitionMethod"];
  acquisitionDate: string;
  warrantyExpiry: string;
  acquisitionCost: string;
  residualValue: string;
  usefulLifeMonths: string;
  depreciationMethod: string;
  condition: UpsertFixedAssetPayload["condition"];
  branchId: string;
  locationId: string;
  departmentId: string;
  custodianId: string;
  physicalLocation: string;
  costCenterCode: string;
  notes: string;
};

const blank = (branchId: string | null, category?: FixedAssetCategory): Draft => ({
  categoryId: category?.id ?? "",
  assetNo: "",
  assetTagNumber: "",
  name: "",
  description: "",
  brand: "",
  model: "",
  serialNumber: "",
  barcode: "",
  acquisitionMethod: "purchase",
  acquisitionDate: todayInput(),
  warrantyExpiry: "",
  acquisitionCost: "",
  residualValue: "0",
  usefulLifeMonths: category ? String(category.usefulLifeMonths) : "60",
  depreciationMethod: "",
  condition: "new",
  branchId: branchId ?? "",
  locationId: "",
  departmentId: "",
  custodianId: "",
  physicalLocation: "",
  costCenterCode: "",
  notes: "",
});

const fromAsset = (a: FixedAssetDetail): Draft => ({
  categoryId: a.categoryId,
  assetNo: a.assetNo,
  assetTagNumber: a.assetTagNumber ?? "",
  name: a.name,
  description: a.description ?? "",
  brand: a.brand ?? "",
  model: a.model ?? "",
  serialNumber: a.serialNumber ?? "",
  barcode: a.barcode ?? "",
  acquisitionMethod: a.acquisitionMethod,
  acquisitionDate: toDateInput(a.acquisitionDateUtc),
  warrantyExpiry: toDateInput(a.warrantyExpiryDateUtc),
  acquisitionCost: String(a.acquisitionCost),
  residualValue: String(a.residualValue),
  usefulLifeMonths: String(a.usefulLifeMonths),
  depreciationMethod: a.depreciationMethod,
  condition: a.condition,
  branchId: a.currentBranchId ?? "",
  locationId: a.currentLocationId ?? "",
  departmentId: a.departmentId ?? "",
  custodianId: a.custodianEmployeeId ?? "",
  physicalLocation: a.physicalLocation ?? "",
  costCenterCode: a.costCenterCode ?? "",
  notes: a.notes ?? "",
});

const emptyLookups: FixedAssetLookups = { branches: [], locations: [], departments: [], employees: [] };

export function AssetFormDialog({ companyId, open, asset, categories, defaultBranchId, source, onClose, onSaved }: Props) {
  const { tx } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => blank(defaultBranchId, categories[0]));
  const [lookups, setLookups] = useState<FixedAssetLookups>(emptyLookups);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const editing = !!asset;
  const inUse = !!asset && asset.status !== "draft";
  const locked = !!asset?.financialsLocked;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStep(0);
    if (asset) { setDraft(fromAsset(asset)); return; }
    const category = categories.find((c) => c.isActive) ?? categories[0];
    const next = blank(defaultBranchId, category);
    if (source) {
      next.name = source.name;
      next.description = source.description;
      next.acquisitionCost = String(source.unitCost);
      next.notes = source.reference;
    }
    setDraft(next);
  }, [open, asset, categories, defaultBranchId, source]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLookupError(null);
    setLoadingLookups(true);
    fixedAssetsApi.lookups(companyId, draft.branchId || null)
      .then((x) => { if (alive) setLookups(x); })
      .catch((err) => { if (alive) { setLookups(emptyLookups); setLookupError(apiError(err, tx("Location and custody choices could not be loaded. Close and reopen the form to retry."))); } })
      .finally(() => { if (alive) setLoadingLookups(false); });
    return () => { alive = false; };
  }, [open, companyId, draft.branchId, tx]);

  const category = useMemo(() => categories.find((c) => c.id === draft.categoryId), [categories, draft.categoryId]);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const pickCategory = (id: string) => {
    const next = categories.find((c) => c.id === id);
    if (!next || editing) { set({ categoryId: id }); return; }
    const cost = Number(draft.acquisitionCost) || 0;
    set({
      categoryId: id,
      usefulLifeMonths: String(next.usefulLifeMonths),
      residualValue: String(Math.round(cost * next.residualValuePercent) / 100),
      depreciationMethod: "",
    });
  };

  const cost = Number(draft.acquisitionCost);
  const residual = Number(draft.residualValue || 0);
  const life = Number(draft.usefulLifeMonths || 0);
  const problem = !draft.categoryId ? "Choose a category."
    : !draft.name.trim() ? "Enter the asset name."
    : !draft.acquisitionDate ? "Enter the acquisition date."
    : !(cost >= 0) || draft.acquisitionCost === "" ? "Enter the acquisition cost."
    : residual < 0 || residual > cost ? "Residual value must be between zero and the cost."
    : !Number.isInteger(life) || life < 0 ? "Useful life must be a whole number of months."
    : ["straightLine", "reducingBalance"].includes(draft.depreciationMethod || category?.depreciationMethod || "") && life === 0 ? "Depreciating assets need at least one month of useful life."
    : draft.warrantyExpiry && draft.warrantyExpiry < draft.acquisitionDate ? "Warranty expiry cannot be before acquisition."
    : category?.requiresSerialNumber && !draft.serialNumber.trim() ? "This category requires a serial number."
    : null;

  const monthly = life > 0 && cost > residual ? (cost - residual) / life : 0;

  const save = async () => {
    if (problem) return;
    setBusy(true);
    setError(null);
    const body: UpsertFixedAssetPayload = {
      supplierId: asset?.supplierId ?? null,
      grnId: asset?.grnId ?? null,
      responsibleManagerEmployeeId: asset?.responsibleManagerEmployeeId ?? null,
      purchaseOrderId: asset?.purchaseOrderId ?? source?.purchaseOrderId ?? null,
      categoryId: draft.categoryId,
      currentBranchId: draft.branchId || null,
      currentLocationId: draft.locationId || null,
      departmentId: draft.departmentId || null,
      custodianEmployeeId: draft.custodianId || null,
      assetNo: draft.assetNo.trim() || undefined,
      assetTagNumber: draft.assetTagNumber.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      brand: draft.brand.trim() || null,
      model: draft.model.trim() || null,
      serialNumber: draft.serialNumber.trim() || null,
      barcode: draft.barcode.trim() || null,
      physicalLocation: draft.physicalLocation.trim() || null,
      costCenterCode: draft.costCenterCode.trim() || null,
      notes: draft.notes.trim() || null,
      condition: draft.condition,
      acquisitionMethod: draft.acquisitionMethod,
      depreciationMethod: (draft.depreciationMethod || null) as UpsertFixedAssetPayload["depreciationMethod"],
      // An unchanged date is sent back exactly as stored, so a time-zone round trip cannot look like an edit.
      acquisitionDateUtc: asset && draft.acquisitionDate === toDateInput(asset.acquisitionDateUtc)
        ? asset.acquisitionDateUtc
        : fromDateInput(draft.acquisitionDate) ?? new Date().toISOString(),
      warrantyExpiryDateUtc: asset && draft.warrantyExpiry === toDateInput(asset.warrantyExpiryDateUtc)
        ? asset.warrantyExpiryDateUtc ?? null
        : fromDateInput(draft.warrantyExpiry),
      acquisitionCost: cost,
      residualValue: residual,
      usefulLifeMonths: life,
    };
    try {
      const saved = asset ? await fixedAssetsApi.update(companyId, asset.id, body) : await fixedAssetsApi.create(companyId, body);
      onSaved(saved, !asset);
    } catch (err) {
      setError(apiError(err, tx("The asset could not be saved.")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FaDialog open={open} wide busy={busy} error={error}
      title={asset ? `${tx("Edit asset")} · ${asset.assetNo}` : tx("Register asset")}
      description={asset ? undefined : tx("The asset is saved as a draft. Activate it once it has a tag, a branch, a location and a custodian; depreciation starts in the month it is activated.")}
      confirmText={step < 3 ? tx("Continue") : asset ? tx("Save changes") : tx("Register draft")}
      confirmDisabled={loadingLookups || !!lookupError || (step === 3 && !!problem)}
      onConfirm={() => step < 3 ? setStep(step + 1) : void save()} onClose={onClose}>
      <nav className="fa-registration-steps" aria-label={tx("Registration steps")}>
        {["Identification", "Value and depreciation", "Location and custody", "Review"].map((label, index) => (
          <Button key={label} type="button" variant={step === index ? "default" : "outline"} disabled={busy}
            aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}>{index + 1}. {tx(label)}</Button>
        ))}
      </nav>
      {lookupError ? <p role="alert" className="fa-note fa-note--warn">{lookupError}</p> : null}
      {source && !asset ? (
        <p className="fa-note">{tx("From purchase order {reference}: {qty} unit(s) accepted. Register one asset per unit.", { reference: source.reference, qty: source.quantity })}</p>
      ) : null}
      {locked ? <p className="fa-note">{tx("Depreciation is posted for this asset, so its category, cost, residual value, useful life, method and acquisition date are locked.")}</p> : null}
      {inUse ? <p className="fa-note">{tx("Branch, location, department and custodian of an asset in use change through Assign / transfer.")}</p> : null}

      <fieldset className="fa-fieldset" hidden={step !== 0}>
        <legend>{tx("Identification")}</legend>
        <div className="fa-grid">
          <Field label={tx("Category")}>
            <Select value={draft.categoryId} disabled={locked} onChange={(e) => pickCategory(e.target.value)}>
              <option value="">{tx("Choose...")}</option>
              {categories.filter((c) => c.isActive || c.id === draft.categoryId).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </Select>
          </Field>
          <Field label={tx("Asset name")}><Input value={draft.name} maxLength={180} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={tx("Asset number")} hint={editing ? undefined : tx("Leave empty to number it automatically.")}>
            <Input value={draft.assetNo} maxLength={40} onChange={(e) => set({ assetNo: e.target.value })} />
          </Field>
          <Field label={tx("Asset tag")} hint={category?.requiresTagBeforeActivation ? tx("Required before activation.") : undefined}>
            <Input value={draft.assetTagNumber} maxLength={80} onChange={(e) => set({ assetTagNumber: e.target.value })} />
          </Field>
          <Field label={tx("Serial number")} hint={category?.requiresSerialNumber ? tx("Required for this category.") : undefined}>
            <Input value={draft.serialNumber} maxLength={120} onChange={(e) => set({ serialNumber: e.target.value })} />
          </Field>
          <Field label={tx("Barcode")}><Input value={draft.barcode} maxLength={120} onChange={(e) => set({ barcode: e.target.value })} /></Field>
          <Field label={tx("Brand")}><Input value={draft.brand} maxLength={120} onChange={(e) => set({ brand: e.target.value })} /></Field>
          <Field label={tx("Model")}><Input value={draft.model} maxLength={120} onChange={(e) => set({ model: e.target.value })} /></Field>
          <Field label={tx("Condition")}>
            <Select value={draft.condition} onChange={(e) => set({ condition: e.target.value as Draft["condition"] })}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{tx(CONDITION_LABEL[c])}</option>)}
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="fa-fieldset" hidden={step !== 1}>
        <legend>{tx("Value and depreciation")}</legend>
        <div className="fa-grid">
          <Field label={tx("Acquired by")}>
            <Select value={draft.acquisitionMethod} onChange={(e) => set({ acquisitionMethod: e.target.value as Draft["acquisitionMethod"] })}>
              {ACQUISITION_METHODS.map((m) => <option key={m} value={m}>{tx(ACQUISITION_LABEL[m])}</option>)}
            </Select>
          </Field>
          <Field label={tx("Acquisition date")}><Input type="date" value={draft.acquisitionDate} max={todayInput()} disabled={locked} onChange={(e) => set({ acquisitionDate: e.target.value })} /></Field>
          <Field label={tx("Cost")} hint={category?.capitalizationThreshold ? tx("Minimum {amount} for this category.", { amount: money(category.capitalizationThreshold) }) : undefined}>
            <Input type="number" min={0} step="0.01" inputMode="decimal" value={draft.acquisitionCost} disabled={locked} onChange={(e) => set({ acquisitionCost: e.target.value })} />
          </Field>
          <Field label={tx("Residual value")}>
            <Input type="number" min={0} step="0.01" inputMode="decimal" value={draft.residualValue} disabled={locked} onChange={(e) => set({ residualValue: e.target.value })} />
          </Field>
          <Field label={tx("Useful life (months)")}>
            <Input type="number" min={0} step="1" value={draft.usefulLifeMonths} disabled={locked} onChange={(e) => set({ usefulLifeMonths: e.target.value })} />
          </Field>
          <Field label={tx("Depreciation method")}>
            <Select value={draft.depreciationMethod} disabled={locked} onChange={(e) => set({ depreciationMethod: e.target.value })}>
              <option value="">{tx("Category default")}{category ? ` (${tx(METHOD_LABEL[category.depreciationMethod])})` : ""}</option>
              {DEPRECIATION_METHODS.filter((m) => m !== "unitsOfProduction").map((m) => <option key={m} value={m}>{tx(METHOD_LABEL[m])}</option>)}
            </Select>
          </Field>
          <Field label={tx("Warranty until")}><Input type="date" value={draft.warrantyExpiry} onChange={(e) => set({ warrantyExpiry: e.target.value })} /></Field>
          <Field label={tx("Cost centre")}><Input value={draft.costCenterCode} maxLength={80} onChange={(e) => set({ costCenterCode: e.target.value })} /></Field>
        </div>
        {monthly > 0 && (draft.depreciationMethod || category?.depreciationMethod) === "straightLine" ? (
          <p className="fa-muted">{tx("About {amount} per month over {months} months.", { amount: money(monthly), months: life })}</p>
        ) : null}
      </fieldset>

      <fieldset className="fa-fieldset" disabled={inUse || loadingLookups} hidden={step !== 2}>
        <legend>{tx("Location and custody")}</legend>
        <div className="fa-grid">
          <Field label={tx("Branch")}>
            <Select value={draft.branchId} onChange={(e) => set({ branchId: e.target.value, locationId: "", departmentId: "", custodianId: "" })}>
              <option value="">{tx("Choose...")}</option>
              {lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label={tx("Stock location")}>
            <Select value={draft.locationId} disabled={!draft.branchId} onChange={(e) => set({ locationId: e.target.value })}>
              <option value="">{tx("None")}</option>
              {lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label={tx("Room / exact place")}><Input value={draft.physicalLocation} maxLength={240} placeholder={tx("e.g. Kitchen line 2")} onChange={(e) => set({ physicalLocation: e.target.value })} /></Field>
          <Field label={tx("Department")}>
            <Select value={draft.departmentId} disabled={!draft.branchId} onChange={(e) => set({ departmentId: e.target.value })}>
              <option value="">{tx("None")}</option>
              {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label={tx("Custodian")}>
            <Select value={draft.custodianId} onChange={(e) => set({ custodianId: e.target.value })}>
              <option value="">{tx("None")}</option>
              {lookups.employees.map((m) => <option key={m.id} value={m.id}>{m.name}{m.code ? ` · ${m.code}` : ""}</option>)}
            </Select>
          </Field>
        </div>
      </fieldset>

      {step === 3 ? <section className="fa-registration-review" aria-label={tx("Registration review")}>
        <h4>{draft.name || tx("Unnamed asset")}</h4>
        <dl className="fa-grid">
          <div><dt>{tx("Category")}</dt><dd>{category?.name ?? tx("Not selected")}</dd></div>
          <div><dt>{tx("Asset number")}</dt><dd>{draft.assetNo || tx("Assigned automatically")}</dd></div>
          <div><dt>{tx("Cost / residual value")}</dt><dd>{money(cost || 0)} / {money(residual || 0)}</dd></div>
          <div><dt>{tx("Branch")}</dt><dd>{lookups.branches.find(x => x.id === draft.branchId)?.name ?? tx("Not assigned")}</dd></div>
        </dl>
        <p className="fa-note">{tx("Registration saves a draft. Activation and custody changes are separate actions in the asset record.")}</p>
        <Field label={tx("Description")} wide><Textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label={tx("Notes")} wide><Textarea rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {problem ? <p role="alert" className="fa-note fa-note--warn">{tx(problem)}</p> : null}
      </section> : null}
    </FaDialog>
  );
}
