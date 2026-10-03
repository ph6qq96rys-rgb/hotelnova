import { useEffect, useRef, useState, type FormEvent } from "react";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { butcheryManagementApi, type ButcheryOperationDto, type MeatCutTemplateDto } from "../api/butcheryManagementApi";
import { readApiError } from "../sales/ui";
import { useDialogFocus } from "../components/useDialogFocus";
import { useUnsavedChanges } from "../components/useUnsavedChanges";

type Location = { branchStockLocationId: string; name: string; canReceive: boolean; canProduce: boolean; canAdjust: boolean };
type Item = { id: string; name: string; sku?: string };
type OperationDraft = { id?: string; branchId: string; code: string; name: string; isEnabled: boolean; yieldVarianceTolerancePercent: number; locations: { branchStockLocationId: string; role: string | number; isActive: boolean }[] };
type TemplateDraft = { id?: string; sourceItemId: string; code: string; name: string; localName?: string | null; isActive: boolean; lines: { outputItemId: string; outputItemName?: string; expectedYieldPercent: number; costAllocationMethod: string | number; classification: string | number; relativeValueWeight?: number | null; standardCostPerBaseUom?: number | null; sortOrder: number; localName?: string | null }[] };
const roles = ["receiving", "rawMeat", "processing", "finishedCuts", "byProduct", "waste"];
const classifications = ["saleable", "nonSaleable", "byProduct", "waste"];
const methods = ["weightBased", "standardYieldBased", "relativeValue", "standardCost", "manualApprovedAllocation"];
const normalize = (value: string | number, values: string[]) => typeof value === "number" ? values[value - 1] : value.charAt(0).toLowerCase() + value.slice(1);
const label = (value: string) => value.replace(/([A-Z])/g, " $1");

export function ButcherySetup({ companyId, branchId }: { companyId: string; branchId: string }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("butchery.manage");
  const [operations, setOperations] = useState<ButcheryOperationDto[]>([]);
  const [templates, setTemplates] = useState<MeatCutTemplateDto[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [operation, setOperation] = useState<OperationDraft | null>(null);
  const [template, setTemplate] = useState<TemplateDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const dirty = !!(operation || template) && JSON.stringify(operation || template) !== baseline;
  const guard = useUnsavedChanges(dirty);
  const close = () => { if (!busy && guard.confirmDiscard()) { setOperation(null); setTemplate(null); } };
  useDialogFocus(!!(operation || template), busy, close);
  const base = "/companies/" + companyId + "/butchery";

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setOperations([]); setTemplates([]); setLocations([]);
    if (!companyId) { setLoading(false); return; }
    Promise.all([butcheryManagementApi.listOperations(companyId, branchId), butcheryManagementApi.listCutTemplates(companyId, false)])
      .then(([o, t]) => { if (alive) { setOperations(o); setTemplates(t); } })
      .catch(e => { if (alive) setError(readApiError(e)); })
      .finally(() => { if (alive) setLoading(false); });
    if (branchId && canManage) http.get<Location[]>(base + "/setup-locations", { params: { branchId } })
      .then(r => { if (alive) setLocations(r.data); }).catch(e => { if (alive) setError(readApiError(e, "Unable to load assigned locations.")); });
    return () => { alive = false; };
  }, [companyId, branchId, revision, canManage]);

  useEffect(() => {
    const controller = new AbortController();
    if (!template) return;
    const timer = window.setTimeout(() => {
      http.get<Item[]>("/companies/" + companyId + "/inventory-master/items", { params: { q: itemSearch || undefined }, signal: controller.signal })
        .then(r => { if (!controller.signal.aborted) setItems(r.data); })
        .catch(e => { if (!controller.signal.aborted) setError(readApiError(e, "Unable to search inventory items.")); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [companyId, !!template, itemSearch]);

  function openOperation(o?: ButcheryOperationDto) {
    const draft: OperationDraft = o ? { ...o, locations: o.locations.filter(l => l.isActive).map(l => ({ branchStockLocationId: l.branchStockLocationId, role: normalize(l.role, roles), isActive: l.isActive })) } : { branchId, code: "", name: "", isEnabled: true, yieldVarianceTolerancePercent: 1.5, locations: [] };
    setOperation(draft); setBaseline(JSON.stringify(draft)); setError("");
  }
  function openTemplate(t?: MeatCutTemplateDto) {
    const draft: TemplateDraft = t ? { ...t, lines: t.lines.map(l => ({ ...l, classification: normalize(l.classification, classifications), costAllocationMethod: normalize(l.costAllocationMethod, methods) })) } : { sourceItemId: "", code: "", name: "", isActive: true, lines: [] };
    setTemplate(draft); setBaseline(JSON.stringify(draft)); setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !canManage) return;
    if (operation && (!operation.locations.length || new Set(operation.locations.map(l => l.branchStockLocationId)).size !== operation.locations.length)) { setError("Choose at least one location, with each location listed only once."); return; }
    if (template && (!template.lines.length || Math.abs(template.lines.reduce((s,l) => s+l.expectedYieldPercent,0) - 100) > 0.0001 || new Set(template.lines.map(l => l.outputItemId)).size !== template.lines.length)) { setError("Add distinct output cuts with a total expected yield of exactly 100%."); return; }
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const draft = operation || template!;
      const route = base + (operation ? "/operations" : "/cut-templates");
      const payload = { ...draft, code: draft.code.trim(), name: draft.name.trim() };
      if (draft.id) await http.put(route + "/" + draft.id, payload); else await http.post(route, payload);
      guard.markSaved(); setOperation(null); setTemplate(null); setMessage("Setup saved."); setRevision(v => v + 1);
    } catch (e) { setError(readApiError(e)); } finally { lock.current = false; setBusy(false); }
  }
  function itemSelect(value: string, onChange: (id: string) => void, name: string, existingName?: string) {
    return <label>{name}<select aria-label={name} required value={value} onChange={e => onChange(e.target.value)}><option value="">Choose an inventory item</option>{value && !items.some(i => i.id === value) && <option value={value}>{existingName || "Current item"}</option>}{items.map(i => <option key={i.id} value={i.id}>{i.name} {i.sku ? "· " + i.sku : ""}</option>)}</select></label>;
  }
  return <section className="co-workspace">
    <header className="co-heading"><div><span className="co-eyebrow">Butchery / Configuration</span><h1>Operations & cut templates</h1><p>Set up branch locations, expected yields and output costing.</p></div><div className="co-actions"><button disabled={!canManage || !branchId || loading} onClick={() => openOperation()}>+ Operation</button><button className="co-primary" disabled={!canManage || loading} onClick={() => openTemplate()}>+ Cut template</button></div></header>
    {!canManage && <p className="co-notice">You can review setup. Ask your administrator for butchery.manage to create or edit it.</p>}
    {!branchId && <p className="co-notice">Select a branch to configure operations.</p>}
    {error && !(operation || template) && <p role="alert" className="co-notice">{error}</p>}
    {message && <p role="status" className="co-notice">{message}</p>}
    <div className="co-package-grid"><section className="co-card"><div className="co-toolbar"><h2>Branch operations</h2></div>{operations.map(o => <article key={o.id}><h3>{o.name}</h3><p>{o.code} · {o.isEnabled ? "Enabled" : "Disabled"} · {o.yieldVarianceTolerancePercent}% tolerance</p><p>{o.locations.filter(l => l.isActive).map(l => l.stockLocationName).join(", ")}</p><button disabled={!canManage||!branchId} title={!branchId?"Select the operation branch to edit":undefined} onClick={() => openOperation(o)}>Edit operation</button></article>)}{!operations.length && <p className="co-empty">{loading ? "Loading..." : "No operations configured."}</p>}</section>
    <section className="co-card"><div className="co-toolbar"><h2>Company cut templates</h2></div>{templates.map(t => <article key={t.id}><h3>{t.name}</h3><p>{t.sourceItemName} · {t.lines.length} cuts · {t.totalExpectedYieldPercent}% yield · {t.isActive ? "Active" : "Inactive"}</p><button disabled={!canManage} onClick={() => openTemplate(t)}>Edit template</button></article>)}{!templates.length && <p className="co-empty">{loading ? "Loading..." : "No cut templates configured."}</p>}</section></div>
    {(operation || template) && <div className="co-modal-backdrop"><section className="co-modal" role="dialog" aria-modal="true" aria-label={operation ? "Operation setup" : "Cut template setup"}><form onSubmit={save}><header className="co-toolbar"><h2>{operation ? "Operation setup" : "Cut template setup"}</h2><button type="button" disabled={busy} onClick={close}>Close</button></header><fieldset disabled={busy}>
    <div className="co-form-grid"><label>Code<input required maxLength={40} value={(operation || template)!.code} onChange={e => operation ? setOperation({ ...operation, code: e.target.value }) : setTemplate({ ...template!, code: e.target.value })}/></label><label>Name<input required maxLength={160} value={(operation || template)!.name} onChange={e => operation ? setOperation({ ...operation, name: e.target.value }) : setTemplate({ ...template!, name: e.target.value })}/></label></div>
    {operation ? <><div className="co-form-grid"><label>Yield variance tolerance %<input required type="number" min="0" max="100" step="0.1" value={operation.yieldVarianceTolerancePercent} onChange={e => setOperation({ ...operation, yieldVarianceTolerancePercent: Number(e.target.value) })}/></label><label className="co-check"><input type="checkbox" disabled={!operation.id} checked={operation.isEnabled} onChange={e => setOperation({ ...operation, isEnabled: e.target.checked })}/>Enabled</label></div>
    <p>Use a receiving/raw-meat location for source stock and a finished-cuts location for outputs.</p>
    {operation.locations.map((l,i) => <div className="co-menu-line" key={i}><label>Assigned location<select aria-label={"Assigned location " + (i+1)} required value={l.branchStockLocationId} onChange={e => setOperation({ ...operation, locations: operation.locations.map((v,j) => i===j ? { ...v, branchStockLocationId: e.target.value } : v) })}><option value="">Choose a branch location</option>{locations.map(v => <option key={v.branchStockLocationId} value={v.branchStockLocationId}>{v.name}</option>)}</select></label><label>Role<select aria-label={"Location role " + (i+1)} value={l.role} onChange={e => setOperation({ ...operation, locations: operation.locations.map((v,j) => i===j ? { ...v, role: e.target.value } : v) })}>{roles.map(r => <option value={r} key={r}>{label(r)}</option>)}</select></label><button type="button" onClick={() => setOperation({ ...operation, locations: operation.locations.filter((_,j) => i!==j) })}>Remove</button></div>)}
    <button type="button" onClick={() => setOperation({ ...operation, locations: [...operation.locations, { branchStockLocationId: "", role: "receiving", isActive: true }] })}>+ Location</button></> : template && <>
    <label>Search inventory items<input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Name or SKU"/></label>
    {itemSelect(template.sourceItemId, id => setTemplate({ ...template, sourceItemId: id }), "Source item", templates.find(t => t.id===template.id)?.sourceItemName)}
    <label className="co-check"><input type="checkbox" disabled={!template.id} checked={template.isActive} onChange={e => setTemplate({ ...template, isActive: e.target.checked })}/>Active template</label>
    {template.lines.map((l,i) => { const change = (patch: Partial<typeof l>) => setTemplate({ ...template, lines: template.lines.map((v,j) => i===j ? { ...v,...patch } : v) }); return <section className="co-editor-section" key={i}><div className="co-form-grid">
    {itemSelect(l.outputItemId, id => change({ outputItemId: id }), "Output item " + (i+1), l.outputItemName)}
    <label>Expected yield %<input required type="number" min="0.01" max="100" step="0.01" value={l.expectedYieldPercent} onChange={e => change({ expectedYieldPercent: Number(e.target.value) })}/></label>
    <label>Classification<select aria-label={"Classification " + (i+1)} value={l.classification} onChange={e => change({ classification: e.target.value })}>{classifications.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
    <label>Cost allocation<select aria-label={"Cost allocation " + (i+1)} value={l.costAllocationMethod} onChange={e => change({ costAllocationMethod: e.target.value })}>{methods.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
    {l.costAllocationMethod==="relativeValue" && <label>Relative value weight<input required type="number" min="0.001" step="0.001" value={l.relativeValueWeight ?? ""} onChange={e => change({ relativeValueWeight: Number(e.target.value) })}/></label>}
    {l.costAllocationMethod==="standardCost" && <label>Standard cost / base unit<input required type="number" min="0" step="0.01" value={l.standardCostPerBaseUom ?? ""} onChange={e => change({ standardCostPerBaseUom: Number(e.target.value) })}/></label>}</div><button type="button" onClick={() => setTemplate({ ...template, lines: template.lines.filter((_,j) => i!==j) })}>Remove cut</button></section>; })}
    <div className="co-toolbar"><button type="button" onClick={() => setTemplate({ ...template, lines: [...template.lines, { outputItemId: "", expectedYieldPercent: 0, classification: "saleable", costAllocationMethod: "weightBased", sortOrder: template.lines.length+1 }] })}>+ Output cut</button><strong>Total yield {template.lines.reduce((s,l) => s+l.expectedYieldPercent,0).toFixed(2)}%</strong></div></>}
    </fieldset>{error && <p className="co-notice" role="alert">{error}</p>}<footer className="co-toolbar"><span>{dirty ? "Unsaved changes" : "No changes"}</span><button className="co-primary" disabled={busy || !dirty}>{busy ? "Saving..." : "Save setup"}</button></footer></form></section></div>}
  </section>;
}
