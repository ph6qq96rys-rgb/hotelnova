import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ClipboardList, PackagePlus, RefreshCw } from "lucide-react";

import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { apiError, Chip, Field, GlDialog, money } from "../../finance/components/glShared";
import { officerApi, type OfficerAction, type ReplenishmentReview, type TransferOption } from "../api/officerApi";
import { BranchSelect, EmployeeSelect, newClientId, OfficerNav, Section, toUtcIso, useOfficerRefs, when } from "../components/officerShared";

const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
type Pick = Record<string, { on: boolean; qty: string }>;
type CountDraft = { locationId: string; ownerEmployeeId: string; due: string; reason: string };

function outcome(a: OfficerAction, done: string) {
  return a.status === "executed" ? done : a.status === "proposed" || a.status === "pendingApproval"
    ? `Requested. ${a.authorityNote ?? "It waits for a decision under the delegated authority."}` : `Request recorded (${a.status}).`;
}

export default function OfficerStockPage() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const canRequest = useHasPermission("aiops.actions.request");
  const { refs, loaded } = useOfficerRefs(companyId);
  const [branchId, setBranchId] = useState("");
  const [review, setReview] = useState<ReplenishmentReview | null>(null);
  const [pick, setPick] = useState<Pick>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<(TransferOption & { qty: string }) | null>(null);
  const [count, setCount] = useState<CountDraft | null>(null);
  const [requestId, setRequestId] = useState(newClientId);

  useEffect(() => { if (loaded && !branchId && refs.branches.length > 0) setBranchId(refs.branches[0].id); }, [loaded, branchId, refs.branches]);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true); setError(null);
    try {
      const r = await officerApi.replenishmentReview(companyId, branchId);
      setReview(r);
      const next: Pick = {};
      for (const l of r.locations) for (const line of l.lines) next[`${l.locationId}:${line.itemId}`] = { on: line.allocatedQty > 0, qty: String(line.allocatedQty) };
      setPick(next);
      setRequestId(newClientId());
    } catch (e) { setReview(null); setError(apiError(e, "The replenishment review could not be prepared.")); }
    finally { setLoading(false); }
  }, [companyId, branchId]);
  useEffect(() => { void load(); }, [load]);

  const chosen = useMemo(() => (review?.locations ?? []).map((l) => ({
    toLocationId: l.locationId,
    lines: l.lines.map((line) => ({ itemId: line.itemId, p: pick[`${l.locationId}:${line.itemId}`] }))
      .filter((x) => x.p?.on && Number(x.p.qty) > 0).map((x) => ({ itemId: x.itemId, qty: Number(x.p!.qty) })),
  })).filter((d) => d.lines.length > 0), [review, pick]);
  const chosenCount = chosen.reduce((n, d) => n + d.lines.length, 0);

  async function run(job: () => Promise<OfficerAction>, done: string, fallback: string, after?: () => void) {
    setBusy(true); setError(null);
    try { const a = await job(); setNotice(outcome(a, done)); after?.(); }
    catch (e) { setError(apiError(e, fallback)); }
    finally { setBusy(false); }
  }

  const branchLocations = refs.locations.filter((l) => l.branchId === branchId);

  return (
    <div className="gl-page">
      <PageHeader title="Officer Stock"
        subtitle="Replenishment for every managed location of a branch, calculated by the low-stock workflow, with short supply shared by location priority. Drafts, transfers and counts pass the officer's delegated authority."
        actions={<>
          {canRequest ? <Button variant="outline" disabled={!branchId || busy} onClick={() => setCount({ locationId: branchLocations[0]?.id ?? "", ownerEmployeeId: "", due: "", reason: "" })}><ClipboardList size={16} /> Request count</Button> : null}
          <Button variant="outline" disabled={!branchId || loading} onClick={() => void load()}><RefreshCw size={16} /> Recalculate</Button>
        </>} />
      <OfficerNav />
      <div className="gl-toolbar">
        <Field label="Branch"><BranchSelect value={branchId} onChange={(v) => { setBranchId(v); setNotice(null); }} branches={refs.branches} /></Field>
      </div>
      {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
      {error && !transfer && !count ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading ? <StateMessage tone="loading">Checking stock at every location…</StateMessage> : null}

      {review && !loading ? <>
        <Section title="Assumptions" hint={`Calculated ${when(review.calculatedAtUtc)}${review.estimatedCost != null ? ` · estimated value ${money(review.estimatedCost)}` : ""}`}>
          <ul className="oo-evidence">{review.assumptions.map((a) => <li key={a}><span>{a}</span></li>)}</ul>
        </Section>

        {review.conflicts.length > 0 ? (
          <Section title="Short supply" hint="The stores cannot cover every location; higher-priority locations were served first.">
            <div className="oo-cards">{review.conflicts.map((c) => (
              <article key={c.itemId} className="oo-card">
                <div className="oo-card-head"><h3>{c.itemName}</h3><Chip tone="warn">{qty(c.available)} of {qty(c.needed)} {c.baseUom}</Chip></div>
                <ul className="oo-evidence">{c.allocation.map((a) => <li key={a}><span>{a}</span></li>)}</ul>
              </article>))}</div>
          </Section>
        ) : null}

        {review.locations.map((l) => (
          <Section key={l.locationId} title={l.locationName}
            hint={l.error ?? `${l.lines.length} item(s) below target of ${l.itemsEvaluated} checked${l.openSivs ? ` · ${l.openSivs} open requisition(s) counted` : ""}${l.allocationPriority ? ` · priority ${l.allocationPriority}` : ""}`}>
            {l.error ? <StateMessage tone="error">{l.error}</StateMessage> : l.lines.length === 0 ? <p className="gl-muted">Everything is covered.</p> : (
              <div className="gl-table-wrap">
                <table className="gl-table">
                  <thead><tr><th /><th>Item</th><th>On hand</th><th>Daily use</th><th>Target</th><th>Suggested</th><th>Allocated</th><th>Request</th></tr></thead>
                  <tbody>
                    {l.lines.map((line) => {
                      const key = `${l.locationId}:${line.itemId}`;
                      const p = pick[key] ?? { on: false, qty: "0" };
                      return (
                        <tr key={key}>
                          <td><Checkbox aria-label={`Request ${line.itemName}`} checked={p.on} disabled={line.allocatedQty <= 0}
                            onChange={(e) => setPick({ ...pick, [key]: { ...p, on: e.target.checked } })} /></td>
                          <td>{line.itemName}<small>{line.status === "OutOfStock" ? "Out of stock" : "Low"} · {line.usageBasis} usage{line.warnings.length ? ` · ${line.warnings.join("; ")}` : ""}</small></td>
                          <td>{qty(line.onHand)} {line.baseUom}{line.reserved > 0 ? <small>{qty(line.reserved)} reserved</small> : null}</td>
                          <td>{qty(line.dailyUsage)}<small>{line.coverageDays} d cover · {line.leadTimeDays} d lead</small></td>
                          <td>{qty(line.target)}</td>
                          <td>{qty(line.suggested)}</td>
                          <td>{qty(line.allocated)}{line.shortfall > 0 ? <small className="oo-bad">{qty(line.shortfall)} short</small> : null}</td>
                          <td><Input aria-label={`Quantity of ${line.itemName} in ${line.uom}`} type="number" min={0} step="any" value={p.qty} disabled={!p.on}
                            onChange={(e) => setPick({ ...pick, [key]: { ...p, qty: e.target.value } })} /><small>{line.uom}</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {l.recipeIssues.length > 0 ? <p className="gl-muted">Recipe problems: {l.recipeIssues.join(" · ")}</p> : null}
          </Section>
        ))}

        {canRequest ? (
          <div className="gl-toolbar">
            <Button disabled={busy || chosenCount === 0} onClick={() => void run(() => officerApi.proposeReplenishment(companyId, { branchId, destinations: chosen, clientRequestId: requestId }),
              "SIV drafts prepared. They are approved and issued as usual.", "The drafts could not be requested.", () => setRequestId(newClientId()))}>
              <PackagePlus size={16} /> Prepare SIV drafts ({chosenCount})
            </Button>
          </div>
        ) : null}

        {review.transfers.length > 0 ? (
          <Section title="Stock at other branches" hint="Shown before those branches' own needs are checked. A transfer is a recommendation: a person creates it.">
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead><tr><th>Item</th><th>For</th><th>Short</th><th>At</th><th>Available</th><th /></tr></thead>
                <tbody>{review.transfers.map((t) => (
                  <tr key={`${t.itemId}:${t.toLocationId}:${t.fromLocationId}`}>
                    <td>{t.itemName}</td><td>{t.toLocationName}</td><td>{qty(t.shortfall)} {t.baseUom}</td>
                    <td>{t.fromLocationName}<small>{t.fromBranchName}</small></td>
                    <td>{qty(t.available)}{t.unitCost != null ? <small>{money(t.unitCost)} / {t.baseUom}</small> : null}</td>
                    <td className="gl-actions">{canRequest ? <Button size="sm" variant="ghost" onClick={() => setTransfer({ ...t, qty: String(Math.min(t.shortfall, t.available)) })}>Recommend</Button> : null}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {review.purchaseNeeds.length > 0 ? (
          <Section title="To be purchased" hint="Not covered by the stores, other branches or open purchase orders.">
            <div className="oo-cards">{review.purchaseNeeds.map((n) => (
              <article key={n.itemId} className="oo-card">
                <div className="oo-card-head"><h3>{n.itemName}</h3><Chip tone="bad">{qty(n.shortfall)} {n.baseUom}</Chip></div>
                <p className="gl-muted">{n.onOrder > 0 ? `${qty(n.onOrder)} already on order: ${n.openOrders.join(", ")}` : "Nothing on order."}</p>
              </article>))}</div>
          </Section>
        ) : null}
      </> : null}

      {transfer ? (
        <GlDialog open title={`Recommend a transfer of ${transfer.itemName}`} description={`From ${transfer.fromLocationName} (${transfer.fromBranchName}) to ${transfer.toLocationName}.`}
          busy={busy} error={error} onClose={() => { setTransfer(null); setError(null); }} confirmText="Recommend"
          confirmDisabled={!(Number(transfer.qty) > 0) || Number(transfer.qty) > transfer.available}
          onConfirm={() => void run(() => officerApi.proposeTransfer(companyId, { fromBranchId: transfer.fromBranchId, fromLocationId: transfer.fromLocationId, toBranchId: branchId,
            toLocationId: transfer.toLocationId, itemId: transfer.itemId, baseQty: Number(transfer.qty) }), "Transfer recommended.", "The transfer could not be recommended.", () => setTransfer(null))}>
          <Field label={`Quantity (${transfer.baseUom})`} hint={`${qty(transfer.available)} available there.`}>
            <Input type="number" min={0} step="any" value={transfer.qty} onChange={(e) => setTransfer({ ...transfer, qty: e.target.value })} />
          </Field>
        </GlDialog>
      ) : null}

      {count ? (
        <GlDialog open title="Request a stock count" description="The person counts and submits the count in Process360; the officer checks that it was submitted."
          busy={busy} error={error} onClose={() => { setCount(null); setError(null); }} confirmText="Request"
          confirmDisabled={!count.locationId || !count.due}
          onConfirm={() => void run(() => officerApi.requestCount(companyId, { branchId, locationId: count.locationId, ownerEmployeeId: count.ownerEmployeeId || null,
            dueAtUtc: toUtcIso(count.due), reason: count.reason || null, clientRequestId: newClientId() }), "Count instruction issued.", "The count could not be requested.", () => setCount(null))}>
          <Field label="Location">
            <Select value={count.locationId} onChange={(e) => setCount({ ...count, locationId: e.target.value })}>
              {branchLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Who counts" hint="Empty: the location's responsible person."><EmployeeSelect value={count.ownerEmployeeId} onChange={(v) => setCount({ ...count, ownerEmployeeId: v })} employees={refs.employees} branchId={branchId} placeholder="Responsible person" /></Field>
          <Field label="Deadline"><Input type="datetime-local" value={count.due} onChange={(e) => setCount({ ...count, due: e.target.value })} /></Field>
          <Field label="Why (optional)"><Textarea rows={2} value={count.reason} onChange={(e) => setCount({ ...count, reason: e.target.value })} /></Field>
        </GlDialog>
      ) : null}
    </div>
  );
}
