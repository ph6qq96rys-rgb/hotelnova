import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw, ShoppingCart } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, day, Field, GlDialog, money } from "../../finance/components/glShared";
import { officerApi, type Comparison, type OfficerAction, type QuotationRequestSummary, type Requirements } from "../api/officerApi";
import { BranchSelect, newClientId, OfficerNav, Section, useOfficerRefs, when } from "../components/officerShared";

type View = "requirements" | "suppliers";
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const score = (n?: number | null) => (n == null ? "—" : n.toFixed(1));
const URGENCY_TONE: Record<string, "bad" | "warn" | "info" | "muted"> = { Overdue: "bad", Urgent: "bad", "Due within 2 days": "warn", High: "warn", Planned: "muted" };

function outcome(a: OfficerAction, done: string) {
  return a.status === "executed" ? done : `Requested. ${a.authorityNote ?? "A person approves it in Actions; the documents are then created with that person's purchasing rights."}`;
}

export default function OfficerPurchasingPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canRequest = useHasPermission("aiops.actions.request");
  const { refs } = useOfficerRefs(companyId);
  const [view, setView] = useState<View>("requirements");
  const [branchId, setBranchId] = useState("");
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<QuotationRequestSummary[]>([]);
  const [requestId, setRequestId] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [order, setOrder] = useState<{ supplierId: string; mode: "Direct" | "Central"; centralBranchId: string; centralLocationId: string; expected: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRequirements = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRequirements(await officerApi.requirements(companyId, branchId || undefined)); setPicked({}); }
    catch (e) { setError(apiError(e, "Requirements could not be loaded.")); }
    finally { setLoading(false); }
  }, [companyId, branchId]);

  useEffect(() => { if (view === "requirements") void loadRequirements(); }, [view, loadRequirements]);
  useEffect(() => {
    if (view !== "suppliers") return;
    officerApi.quotationRequests(companyId).then((r) => { setRequests(r); setRequestId((id) => id || r.find((x) => x.status === "Open")?.id || ""); })
      .catch((e) => setError(apiError(e, "Quotation requests could not be loaded.")));
  }, [view, companyId]);
  useEffect(() => {
    if (!requestId) { setComparison(null); return; }
    setLoading(true); setError(null);
    officerApi.comparison(companyId, requestId).then((c) => {
      setComparison(c);
      setChoice(Object.fromEntries(c.lines.filter((l) => l.recommendedQuoteId).map((l) => [l.requisitionLineId, l.recommendedQuoteId!])));
      setOverrideReason("");
    }).catch((e) => setError(apiError(e, "The comparison could not be prepared."))).finally(() => setLoading(false));
  }, [companyId, requestId]);

  const selectedLines = useMemo(() => (requirements?.items ?? []).flatMap((i) => i.origins.filter((o) => picked[o.requisitionLineId] !== undefined)
    .map((o) => ({ item: i, origin: o, quantity: Number(picked[o.requisitionLineId]) }))), [requirements, picked]);
  const supplierChoices = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of selectedLines) for (const s of l.item.suppliers) map.set(s.supplierId, s.name);
    return [...map.entries()];
  }, [selectedLines]);
  const overrides = (comparison?.lines ?? []).filter((l) => choice[l.requisitionLineId] && l.recommendedQuoteId && choice[l.requisitionLineId] !== l.recommendedQuoteId);

  async function run(job: () => Promise<OfficerAction>, done: string, fallback: string, after?: () => void) {
    setBusy(true); setError(null);
    try { const a = await job(); setNotice(outcome(a, done)); after?.(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const centralLocations = refs.locations.filter((l) => l.branchId === order?.centralBranchId);

  return (
    <div className="gl-page">
      <PageHeader title="Officer Purchasing"
        subtitle="Branch needs combined after stock, transfers and open orders; suppliers ranked by visible weights. Purchase documents are created by Purchasing when a person approves, with that person's rights."
        actions={view === "requirements" ? <Button variant="outline" disabled={loading} onClick={() => void loadRequirements()}><RefreshCw size={16} /> Recalculate</Button> : null} />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="View">
          <Select value={view} onChange={(e) => { setView(e.target.value as View); setNotice(null); }}>
            <option value="requirements">Requirements</option>
            <option value="suppliers">Supplier comparison</option>
          </Select>
        </Field>
        {view === "requirements" ? <Field label="Branch"><BranchSelect value={branchId} onChange={setBranchId} branches={refs.branches} allLabel="All my branches" /></Field> : (
          <Field label="Quotation request">
            <Select value={requestId} onChange={(e) => setRequestId(e.target.value)}>
              <option value="">Choose a request</option>
              {requests.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.status} · {r.quotes} quote(s){r.branchName ? ` · ${r.branchName}` : ""}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !order ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Calculating…</StateMessage> : null}

      {view === "requirements" && requirements && !loading ? <>
        <Section title="Assumptions" hint={`Calculated ${when(requirements.calculatedAtUtc)}`}>
          <ul className="oo-evidence">{requirements.assumptions.map((a) => <li key={a}><span>{a}</span></li>)}</ul>
        </Section>
        {requirements.items.length === 0 ? <p className="gl-muted">No approved requisition is waiting to be ordered.</p> : null}
        {requirements.items.map((i) => (
          <Section key={i.itemId} title={i.itemName} hint={`Need by ${day(i.needByUtc)}`}>
            <div className="gl-chip-row">
              <Chip tone={URGENCY_TONE[i.urgency] ?? "muted"}>{i.urgency}</Chip>
              <Chip tone="neutral">Required {qty(i.required)} {i.baseUnit}</Chip>
              {i.awaitingApproval > 0 ? <Chip tone="muted">{qty(i.awaitingApproval)} awaiting approval</Chip> : null}
              {i.freeAtMainStore > 0 ? <Chip tone="info">{qty(i.freeAtMainStore)} free at main store</Chip> : null}
              {i.inTransit > 0 ? <Chip tone="info">{qty(i.inTransit)} in transit</Chip> : null}
              {i.onOrder > 0 ? <Chip tone="info">{qty(i.onOrder)} on order</Chip> : null}
              <Chip tone={i.netToBuy > 0 ? "warn" : "ok"}>Net to buy {qty(i.netToBuy)} {i.baseUnit}</Chip>
            </div>
            {i.issues.length > 0 ? <ul className="oo-evidence">{i.issues.map((x) => <li key={x}><span>{x}</span></li>)}</ul> : null}
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead><tr><th /><th>Requisition</th><th>Branch</th><th>Purpose</th><th>Need by</th><th>Quantity</th><th>Order</th></tr></thead>
                <tbody>{i.origins.map((o) => {
                  const on = picked[o.requisitionLineId] !== undefined;
                  return (
                    <tr key={o.requisitionLineId}>
                      <td><Checkbox aria-label={`Order ${o.requisitionNo}`} checked={on} disabled={!o.consolidable || !canRequest}
                        onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[o.requisitionLineId] = String(o.quantity); else delete n[o.requisitionLineId]; return n; })} /></td>
                      <td>{o.requisitionNo}<small>{o.status} · {o.priority}</small></td>
                      <td>{o.branchName ?? "—"}</td>
                      <td>{o.purpose}{o.specification ? <small>{o.specification}</small> : null}</td>
                      <td>{day(o.needByUtc)}</td>
                      <td>{qty(o.quantity)} {o.unit}</td>
                      <td>{on ? <Input aria-label={`Quantity for ${o.requisitionNo}`} type="number" min={0} max={o.quantity} step="any" value={picked[o.requisitionLineId]}
                        onChange={(e) => setPicked((p) => ({ ...p, [o.requisitionLineId]: e.target.value }))} /> : null}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            {i.suppliers.length > 0 ? <p className="gl-muted">Suppliers: {i.suppliers.map((s) => `${s.name}${s.preferred ? " (preferred)" : ""}${s.agreedPrice ? ` · agreed ${money(s.agreedPrice)}` : s.lastPrice ? ` · last ${money(s.lastPrice)}` : ""}`).join(" · ")}</p> : null}
          </Section>
        ))}
        {canRequest && requirements.items.length > 0 ? (
          <div className="gl-toolbar">
            <Button disabled={busy || selectedLines.length === 0 || selectedLines.some((l) => !(l.quantity > 0) || l.quantity > l.origin.quantity)}
              onClick={() => setOrder({ supplierId: supplierChoices[0]?.[0] ?? "", mode: "Direct", centralBranchId: "", centralLocationId: "", expected: "", reason: "" })}>
              <ShoppingCart size={16} /> Consolidate into a purchase order ({selectedLines.length})
            </Button>
          </div>
        ) : null}
      </> : null}

      {view === "suppliers" && comparison && !loading ? <>
        <Section title={`${comparison.reference} · ${comparison.status}`}
          hint={`Weights: price ${comparison.weights.price}, quality ${comparison.weights.quality}, lead time ${comparison.weights.leadTime}, reliability ${comparison.weights.reliability}, payment terms ${comparison.weights.paymentTerms}`}>
          <ul className="oo-evidence">{comparison.assumptions.map((a) => <li key={a}><span>{a}</span></li>)}</ul>
          {comparison.missingData.length > 0 ? <StateMessage tone="info">Missing data: {comparison.missingData.join(" ")}</StateMessage> : null}
        </Section>
        {comparison.lines.map((l) => (
          <Section key={l.requisitionLineId} title={`${l.itemName} · ${qty(l.quantity)} ${l.unit}`} hint={`${l.requisitionNo}${l.needByUtc ? ` · need by ${day(l.needByUtc)}` : ""}${l.specification ? ` · ${l.specification}` : ""}`}>
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead><tr><th>Rank</th><th>Supplier</th><th>Score</th><th>Cost / base unit</th><th>Price</th><th>Lead</th><th>Reliab.</th><th>Quality</th><th>Terms</th><th>Delivery</th><th>Valid until</th><th>Choose</th></tr></thead>
                <tbody>{l.quotes.map((q) => (
                  <tr key={q.quoteId} className={q.eligible ? undefined : "oo-muted-row"}>
                    <td>{q.rank > 0 ? q.rank : "—"}</td>
                    <td>{q.supplierName}{q.notes.length ? <small>{q.notes.join(" ")}</small> : null}</td>
                    <td><strong>{score(q.score)}</strong></td>
                    <td>{money(q.unitCostBase)}<small>{q.currency}{q.exchangeRate !== 1 ? ` @ ${q.exchangeRate}` : ""}</small></td>
                    <td>{score(q.priceScore)}</td><td>{score(q.leadTimeScore)}</td><td>{score(q.reliabilityScore)}</td><td>{score(q.qualityScore)}</td><td>{score(q.paymentScore)}</td>
                    <td>{day(q.deliveryDate)}</td><td>{day(q.validUntil)}</td>
                    <td>{q.eligible && canRequest ? <Checkbox aria-label={`Choose ${q.supplierName} for ${l.itemName}`} checked={choice[l.requisitionLineId] === q.quoteId}
                      onChange={(e) => setChoice((c) => { const n = { ...c }; if (e.target.checked) n[l.requisitionLineId] = q.quoteId; else delete n[l.requisitionLineId]; return n; })} /> : null}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Section>
        ))}
        {canRequest && comparison.status === "Open" ? (
          <Section title="Selection">
            {overrides.length > 0 ? (
              <Field label="Why not the first-ranked supplier?" hint="Recorded with your name on the award." wide>
                <Textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              </Field>
            ) : <p className="gl-muted">The first-ranked eligible quote is chosen for every line.</p>}
            <div className="gl-toolbar">
              <Button disabled={busy || Object.keys(choice).length === 0 || (overrides.length > 0 && !overrideReason.trim())}
                onClick={() => void run(() => officerApi.proposeAward(companyId, comparison.requestId, {
                  lines: comparison.lines.filter((l) => choice[l.requisitionLineId]).map((l) => ({ quoteId: choice[l.requisitionLineId], requisitionLineId: l.requisitionLineId, quantity: l.quantity })),
                  overrideReason: overrides.length > 0 ? overrideReason : null, clientRequestId: newClientId(),
                }), "Suppliers selected.", "The selection could not be proposed.")}>Propose selection</Button>
            </div>
          </Section>
        ) : null}
      </> : null}

      {order ? (
        <GlDialog open title="Consolidate into a purchase order" description={`${selectedLines.length} requisition line(s) from ${new Set(selectedLines.map((l) => l.origin.branchId)).size} branch(es).`}
          busy={busy} error={error} onClose={() => { setOrder(null); setError(null); }} confirmText="Propose"
          confirmDisabled={!order.supplierId || !order.expected || (order.mode === "Central" && (!order.centralBranchId || !order.centralLocationId))}
          onConfirm={() => void run(() => officerApi.proposeConsolidation(companyId, {
            supplierId: order.supplierId, mode: order.mode, centralBranchId: order.mode === "Central" ? order.centralBranchId : null,
            centralLocationId: order.mode === "Central" ? order.centralLocationId : null, expectedDate: order.expected, reason: order.reason || null,
            lines: selectedLines.map((l) => ({ requisitionLineId: l.origin.requisitionLineId, quantity: l.quantity })), clientRequestId: newClientId(),
          }), "Purchase orders prepared.", "The consolidation could not be proposed.", () => { setOrder(null); setPicked({}); })}>
          <Field label="Supplier" hint={supplierChoices.length === 0 ? "No active supplier is linked to these items." : undefined}>
            <Select value={order.supplierId} onChange={(e) => setOrder({ ...order, supplierId: e.target.value })}>
              {supplierChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Delivery">
            <Select value={order.mode} onChange={(e) => setOrder({ ...order, mode: e.target.value as "Direct" | "Central" })}>
              <option value="Direct">Direct to each branch</option>
              <option value="Central">To one central store</option>
            </Select>
          </Field>
          {order.mode === "Central" ? <>
            <Field label="Central branch"><BranchSelect value={order.centralBranchId} onChange={(v) => setOrder({ ...order, centralBranchId: v, centralLocationId: "" })} branches={refs.branches} /></Field>
            <Field label="Receiving location">
              <Select value={order.centralLocationId} onChange={(e) => setOrder({ ...order, centralLocationId: e.target.value })}>
                <option value="">Choose a location</option>
                {centralLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
          </> : null}
          <Field label="Expected delivery"><Input type="date" value={order.expected} onChange={(e) => setOrder({ ...order, expected: e.target.value })} /></Field>
          <Field label="Reason (optional)"><Textarea rows={2} value={order.reason} onChange={(e) => setOrder({ ...order, reason: e.target.value })} /></Field>
        </GlDialog>
      ) : null}
    </div>
  );
}
