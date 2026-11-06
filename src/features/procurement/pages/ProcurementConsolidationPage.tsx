import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useI18n } from "../../../i18n";
import { useHasPermission } from "../../../auth/usePermissions";
import { suppliersApi, type SupplierLookup } from "../api/purchasingApi";
import { consolidationApi, requirementGroupKey, type BranchRequirement, type ReceivingDestination, type ConsolidationRequest, type ConsolidatedOrder } from "../api/consolidationApi";
import { apiError, qty, todayIso, useCompanyId } from "../components/p2pShared";
import "./consolidation.css";

type Pick = { quantity: string; price: string };
type OrderPreview = { key: string; supplier: string; destination: string; branches: string[]; lines: number };
type Attempt = { body: ConsolidationRequest; preview: OrderPreview[] };
const emptyGuid = "00000000-0000-0000-0000-000000000000";

export default function ProcurementConsolidationPage() {
  const companyId = useCompanyId();
  return <ConsolidationWorkspace key={companyId} companyId={companyId} />;
}

function ConsolidationWorkspace({ companyId }: { companyId: string }) {
  const { tx } = useI18n();
  const canCreate = useHasPermission("purchasing.create");
  const storageKey = `procurement-consolidation:${companyId}`;
  const [rows, setRows] = useState<BranchRequirement[]>([]);
  const [destinations, setDestinations] = useState<ReceivingDestination[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState(""), [branchFilter, setBranchFilter] = useState("");
  const [from, setFrom] = useState(""), [until, setUntil] = useState("");
  const [selected, setSelected] = useState<Record<string, Pick>>({});
  const [supplierByGroup, setSupplierByGroup] = useState<Record<string, string>>({});
  const [defaultSupplier, setDefaultSupplier] = useState("");
  const [mode, setMode] = useState<"Central" | "Direct">("Central");
  const [destinationKey, setDestinationKey] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [orders, setOrders] = useState<ConsolidatedOrder[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || "null") as Attempt | null; } catch { return null; }
  });
  const locked = busy || !!attempt || orders.length > 0;
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    Promise.all([consolidationApi.requirements(companyId), consolidationApi.destinations(companyId), suppliersApi.lookup(companyId)])
      .then(([requirements, receiving, supplierList]) => { if (active) { setRows(requirements); setDestinations(receiving); setSuppliers(supplierList); } })
      .catch(e => { if (active) setError(apiError(e, "Unable to load the purchasing workspace.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, reload]);

  const branchName = (r: BranchRequirement) => r.branchName || destinations.find(d => d.branchId === r.branchId)?.branchName || tx("Branch name unavailable");
  const destinationName = (r: BranchRequirement) => destinations.find(d => d.branchId === r.branchId && d.locationId === r.locationId)?.locationName || tx("Destination unavailable");
  const branches = [...new Map(rows.map(r => [r.branchId, branchName(r)])).entries()];
  const visible = rows.filter(r => (!branchFilter || r.branchId === branchFilter) && (!from || r.requiredByDateUtc.slice(0, 10) >= from) && (!until || r.requiredByDateUtc.slice(0, 10) <= until) && `${r.itemName} ${r.requisitionNo} ${branchName(r)}`.toLowerCase().includes(search.toLowerCase()));
  const picked = rows.filter(r => selected[r.lineId]);
  const groups = useMemo(() => {
    const map = new Map<string, BranchRequirement[]>();
    rows.filter(r => selected[r.lineId]).forEach(r => { const key = requirementGroupKey(r); map.set(key, [...(map.get(key) || []), r]); });
    return [...map.entries()].sort((a, b) => a[1][0].itemName.localeCompare(b[1][0].itemName));
  }, [rows, selected]);
  const requestingBranches = new Set(picked.map(row => row.branchId));
  const mainAssignments = destinations.filter(d => d.isMainWarehouse && requestingBranches.has(d.branchId));
  const suggested = mainAssignments.length === 1 ? mainAssignments[0] : undefined;
  const receivingKey = destinationKey ?? (suggested ? `${suggested.branchId}:${suggested.locationId}` : "");
  const receiver = mode === "Central" ? destinations.find(d => `${d.branchId}:${d.locationId}` === receivingKey) : undefined;
  const supplierFor = (r: BranchRequirement) => supplierByGroup[requirementGroupKey(r)] || defaultSupplier;
  const dates = picked.map(r => r.requiredByDateUtc.slice(0, 10)).sort();
  const issues: string[] = [];
  if (!picked.length) issues.push("Select at least one approved requirement.");
  if (picked.length > 500) issues.push("A purchasing plan can include up to 500 source lines.");
  if (dates.length && (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000 > 7) issues.push("Select requirements within the same seven-day delivery period.");
  if (picked.some(r => !Number.isFinite(Number(selected[r.lineId].quantity)) || Number(selected[r.lineId].quantity) <= 0 || Number(selected[r.lineId].quantity) > r.quantity)) issues.push("Purchase quantities must be positive and cannot exceed the remaining approved quantities.");
  if (picked.some(r => selected[r.lineId].price !== "" && (!Number.isFinite(Number(selected[r.lineId].price)) || Number(selected[r.lineId].price) < 0))) issues.push("Enter valid non-negative unit prices, or leave them blank to use supplier pricing.");
  if (picked.some(r => !supplierFor(r))) issues.push("Choose a supplier for every selected item.");
  if (mode === "Central" && !receiver) issues.push("Choose an assigned central receiving destination.");
  if (mode === "Direct" && picked.some(r => !destinations.some(d => d.branchId === r.branchId && d.locationId === r.locationId))) issues.push("Some source destinations are unavailable for receiving. Correct the request or choose central receipt.");
  if (!deliveryDate || (dates[0] && deliveryDate > dates[0])) issues.push("Delivery must be on or before the earliest required date.");
  if (!reason.trim()) issues.push("Enter the business reason for this purchasing plan.");
  const preview = new Map<string, OrderPreview>();
  picked.forEach(r => {
    const supplierId = supplierFor(r), destination = mode === "Central" ? receiver : destinations.find(d => d.branchId === r.branchId && d.locationId === r.locationId);
    const key = `${supplierId}:${destination?.branchId}:${destination?.locationId}`;
    const current = preview.get(key) || { key, supplier: suppliers.find(s => s.id === supplierId)?.name || tx("Supplier required"), destination: destination ? `${destination.locationName} · ${destination.branchName}` : tx("Destination required"), branches: [], lines: 0 };
    current.lines++; current.branches = [...new Set([...current.branches, branchName(r)])]; preview.set(key, current);
  });
  function toggle(row: BranchRequirement, checked: boolean) {
    setSelected(current => { const next = { ...current }; if (checked) next[row.lineId] = { quantity: String(row.quantity), price: String(row.estimatedUnitPrice) }; else delete next[row.lineId]; return next; });
  }
  async function create() {
    if (busy || !canCreate || (!attempt && issues.length)) return;
    const next: Attempt = attempt || { preview: [...preview.values()], body: { clientRequestId: crypto.randomUUID(), supplierId: emptyGuid, mode, centralBranchId: receiver?.branchId || null, centralLocationId: receiver?.locationId || null, expectedDate: deliveryDate, reason: reason.trim(), lines: picked.map(r => ({ requisitionLineId: r.lineId, quantity: Number(selected[r.lineId].quantity), unitPrice: selected[r.lineId].price === "" ? null : Number(selected[r.lineId].price), supplierId: supplierFor(r) })) } };
    setBusy(true); setError("");
    try {
      // Preserve the exact request across reloads and uncertain/partial responses.
      sessionStorage.setItem(storageKey, JSON.stringify(next)); setAttempt(next);
      const result = await consolidationApi.create(companyId, next.body);
      setOrders(result); sessionStorage.removeItem(storageKey); setAttempt(null);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      // A rejected first attempt is rolled back as one server transaction.
      // An uncertain earlier attempt must keep its identity until reconciled.
      if (!attempt && status && [400, 403, 409, 422].includes(status)) {
        sessionStorage.removeItem(storageKey); setAttempt(null);
      }
      setError(apiError(e, "Unable to confirm all draft orders. Retry this unchanged plan to recover the result."));
    }
    finally { setBusy(false); }
  }
  const review = attempt?.preview || [...preview.values()];
  return <main className="p2p-page consolidation-page">
    <PageHeader title={tx("Company purchasing plan")} subtitle={tx("Plan purchases from approved Main Store requisitions. Each order line stays linked to its source requisition.")} />
    {error && <StateMessage tone="error">{tx(error)}</StateMessage>}
    {loading && <StateMessage tone="loading">{tx("Loading approved requirements and assigned receiving destinations…")}</StateMessage>}
    {!canCreate && <StateMessage>{tx("You have view access. A user with purchasing creation permission must create the draft orders.")}</StateMessage>}
    <nav className="consolidation-steps" aria-label={tx("Purchasing plan steps")}>
      {["Select requirements", "Plan purchases", "Review orders"].map((label, i) => <Button key={label} variant={step === i + 1 ? "default" : "outline"} disabled={locked || (i > 0 && !picked.length)} aria-current={step === i + 1 ? "step" : undefined} onClick={() => setStep(i + 1)}>{i + 1}. {tx(label)}</Button>)}
    </nav>
    <div className="consolidation-summary" aria-label={tx("Selection summary")}>
      <Card><CardContent><span>{tx("Managing branches")}</span><strong>{new Set(picked.map(r => r.branchId)).size}</strong></CardContent></Card>
      <Card><CardContent><span>{tx("Selected request lines")}</span><strong>{picked.length}</strong></CardContent></Card>
      <Card><CardContent><span>{tx("Item and unit groups")}</span><strong>{groups.length}</strong></CardContent></Card>
      <Card><CardContent><span>{tx("Planned draft orders")}</span><strong>{preview.size}</strong></CardContent></Card>
    </div>
    {orders.length > 0 ? <Card><CardHeader><CardTitle>{tx("Draft orders created")}</CardTitle></CardHeader><CardContent><StateMessage tone="success">{tx("Source branch allocations are linked. Normal purchase order approvals still apply.")}</StateMessage><ul>{orders.map(o => <li key={o.id}><Link to={`/companies/${companyId}/procurement/purchase-orders/${o.id}`}>{o.poNo}</Link></li>)}</ul><Button onClick={() => { setOrders([]); setSelected({}); setStep(1); setReload(n => n + 1); }}>{tx("Start another plan")}</Button></CardContent></Card>
    : attempt ? <Card><CardHeader><CardTitle>{tx("Confirm the previous submission")}</CardTitle></CardHeader><CardContent><StateMessage tone="warning">{tx("This plan has been submitted. Keep it unchanged until the result is confirmed; some draft orders may already exist. Retrying recovers the same orders.")}</StateMessage><p>{attempt.body.lines.length} {tx("source lines")} · {attempt.body.expectedDate}</p><OrderList rows={review} /><Button disabled={busy || !canCreate} onClick={() => void create()}>{tx(busy ? "Confirming…" : "Retry unchanged plan")}</Button></CardContent></Card>
    : <>
      {step === 1 && <Card><CardHeader><CardTitle>{tx("Approved purchase requirements")}</CardTitle></CardHeader><CardContent>
        <div className="p2p-toolbar">
          <FormField label={tx("Search requirements")} placeholder={tx("Item, request number or branch")} value={search} onChange={e => setSearch(e.target.value)} />
          <label>{tx("Managing branch")}<Select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}><option value="">{tx("All accessible branches")}</option>{branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></label>
          <FormField label={tx("Required from")} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <FormField label={tx("Required through")} type="date" value={until} onChange={e => setUntil(e.target.value)} />
        </div>
        <div className="p2p-actions p2p-mt"><Button variant="outline" disabled={loading || !visible.length} onClick={() => setSelected(current => ({ ...current, ...Object.fromEntries(visible.map(r => [r.lineId, current[r.lineId] || { quantity: String(r.quantity), price: String(r.estimatedUnitPrice) }])) }))}>{tx("Select visible requirements")}</Button><Button variant="ghost" disabled={!picked.length} onClick={() => setSelected({})}>{tx("Clear selection")}</Button><Button variant="ghost" disabled={loading} onClick={() => { setSelected({}); setReload(n => n + 1); }}>{tx("Refresh requirements")}</Button></div>
        <p className="p2p-muted">{tx("Selections remain included when filters change. Only outstanding approved quantities are shown.")}</p>
        {!loading && !visible.length ? <EmptyState title={tx("No matching requirements")} detail={tx("Adjust the filters, or approve branch requests before planning purchases.")} /> : <Table><TableHeader><TableRow>{["Select", "Item / unit", "Branch / request", "Receiving destination", "Required by", "Remaining approved"].map(h => <TableHead key={h}>{tx(h)}</TableHead>)}</TableRow></TableHeader><TableBody>{visible.map(r => <TableRow key={r.lineId}><TableCell><Checkbox aria-label={`${tx("Select")} ${r.requisitionNo} ${r.itemName} ${r.uomName}`} checked={!!selected[r.lineId]} onChange={e => toggle(r, e.target.checked)} /></TableCell><TableCell><strong>{r.itemName}</strong><div className="p2p-muted">{r.uomName}</div></TableCell><TableCell>{branchName(r)}<div><Link to={`/companies/${companyId}/procurement/requisitions/${r.requisitionId}`}>{r.requisitionNo}</Link></div></TableCell><TableCell>{destinationName(r)}</TableCell><TableCell>{r.requiredByDateUtc.slice(0, 10)}</TableCell><TableCell>{qty(r.quantity)} {r.uomName}</TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>}
      {step === 2 && <>
        <Card><CardHeader><CardTitle>{tx("Supplier and receiving plan")}</CardTitle></CardHeader><CardContent><div className="p2p-grid">
          <label>{tx("Default supplier")}<Select aria-label={tx("Default supplier")} value={defaultSupplier} onChange={e => setDefaultSupplier(e.target.value)}><option value="">{tx("Choose supplier")}</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><p className="p2p-muted">{tx("Applies to items without a supplier override.")}</p></label>
          <label>{tx("Receiving method")}<Select value={mode} onChange={e => setMode(e.target.value as "Central" | "Direct")}><option value="Central">{tx("Central warehouse receipt")}</option><option value="Direct">{tx("Direct to each branch destination")}</option></Select></label>
          {mode === "Central" && <label>{tx("Receiving branch and destination")}<Select value={receivingKey} onChange={e => setDestinationKey(e.target.value)}><option value="">{tx("Choose assigned receiving destination")}</option>{destinations.map(d => <option key={`${d.branchId}:${d.locationId}`} value={`${d.branchId}:${d.locationId}`}>{d.locationName} · {d.branchName}</option>)}</Select></label>}
          <FormField label={tx("Expected delivery date")} type="date" value={deliveryDate} max={dates[0]} onChange={e => setDeliveryDate(e.target.value)} />
        </div><p className="p2p-muted">{tx("Main Warehouse receives through GRN and issues stock through the authorized SIV or transfer workflow. Central receipt does not mark every branch as supplied.")}</p></CardContent></Card>
        {groups.map(([key, sources]) => <Card key={key}><CardHeader><div className="p2p-section-head"><CardTitle>{sources[0].itemName} · {sources[0].uomName}</CardTitle><strong>{qty(sources.reduce((sum, r) => sum + Number(selected[r.lineId].quantity || 0), 0))} {sources[0].uomName}</strong></div></CardHeader><CardContent>
          <label>{tx("Supplier for")} {sources[0].itemName} {sources[0].uomName}<Select value={supplierByGroup[key] || ""} onChange={e => setSupplierByGroup(current => ({ ...current, [key]: e.target.value }))}><option value="">{tx("Use default supplier")}</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
          <Table><TableHeader><TableRow>{["Branch / request", "Remaining approved", "Purchase quantity", "Unit price", ""].map((h, i) => <TableHead key={i}>{tx(h)}</TableHead>)}</TableRow></TableHeader><TableBody>{sources.map(r => <TableRow key={r.lineId}><TableCell>{branchName(r)}<div>{r.requisitionNo}</div></TableCell><TableCell>{qty(r.quantity)} {r.uomName}</TableCell><TableCell><Input aria-label={`${tx("Purchase quantity")} ${r.requisitionNo} ${r.uomName}`} type="number" min="0.0001" max={r.quantity} step="0.0001" value={selected[r.lineId].quantity} onChange={e => setSelected(current => ({ ...current, [r.lineId]: { ...current[r.lineId], quantity: e.target.value } }))} /></TableCell><TableCell><Input aria-label={`${tx("Unit price")} ${r.requisitionNo} ${r.uomName}`} type="number" min="0" step="0.0001" value={selected[r.lineId].price} placeholder={tx("Supplier pricing")} onChange={e => setSelected(current => ({ ...current, [r.lineId]: { ...current[r.lineId], price: e.target.value } }))} /></TableCell><TableCell><Button variant="ghost" aria-label={`${tx("Remove")} ${r.requisitionNo} ${r.uomName}`} onClick={() => toggle(r, false)}>{tx("Remove")}</Button></TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>)}
        <Card><CardContent><label>{tx("Business reason")}<Textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder={tx("Explain the purchasing period, event demand or reason for consolidation.")} /></label></CardContent></Card>
      </>}
      {step === 3 && <Card><CardHeader><CardTitle>{tx("Review draft purchase orders")}</CardTitle></CardHeader><CardContent><p>{tx("Orders are separated by supplier and receiving destination. Item totals are consolidated for planning; source lines remain separate for branch traceability.")}</p><p><strong>{tx("Delivery date")}:</strong> {deliveryDate} · {tx(mode === "Central" ? "Central warehouse receipt" : "Direct to each branch destination")}</p><p>{reason}</p><OrderList rows={review} />{issues.length > 0 && <StateMessage tone="warning"><ul>{issues.map(issue => <li key={issue}>{tx(issue)}</li>)}</ul></StateMessage>}<p className="p2p-muted">{tx("Final prices, currency and taxes are calculated on each draft order. Creating drafts does not approve orders or post stock.")}</p></CardContent></Card>}
      <div className="consolidation-footer"><span>{picked.length} {tx("selected source lines")} · {groups.length} {tx("item and unit groups")}</span><div className="p2p-actions">{step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>{tx("Back")}</Button>}{step < 3 ? <Button disabled={loading || !picked.length} onClick={() => setStep(step + 1)}>{tx(step === 1 ? "Plan selected purchases" : "Review orders")}</Button> : canCreate && <Button disabled={busy || issues.length > 0} onClick={() => void create()}>{tx("Create draft orders")}</Button>}</div></div>
    </>}
  </main>;
}

function OrderList({ rows }: { rows: OrderPreview[] }) {
  const { tx } = useI18n();
  return <Table><TableHeader><TableRow>{["Supplier", "Receiving destination", "Managing branches", "Source lines"].map(h => <TableHead key={h}>{tx(h)}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.key}><TableCell>{r.supplier}</TableCell><TableCell>{r.destination}</TableCell><TableCell>{r.branches.join(", ")}</TableCell><TableCell>{r.lines}</TableCell></TableRow>)}</TableBody></Table>;
}
