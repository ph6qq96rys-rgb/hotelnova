import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../api/http";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useI18n } from "../../../i18n";
import { inventoryItemsApi } from "../../inventoryMaster/items/api/inventoryItemsApi";
import { apiError, asItems, money, qty, todayIso, useCompanyId } from "../components/p2pShared";

/**
 * Side-by-side supplier scorecard for purchase managers. Built on the supplier-performance report, so every figure
 * traces back to posted purchase orders, receipts, inspections and returns in the chosen period.
 */

type PriceTrend = { itemId: string; itemName: string; month: string; baseUnit: string; baseQuantity: number; weightedUnitPrice: number };
type Supplier = {
  id: string; name: string; paymentTermDays: number; eligible: boolean; orders: number; deliveries: number;
  onTimePercent?: number | null; averageLeadDays?: number | null; averageLineFulfilmentPercent?: number | null;
  averageLineRejectionPercent?: number | null; averageLineReturnPercent?: number | null; score?: number | null;
  scoreStatus: string; priceTrends: PriceTrend[];
};
type Report = { from: string; to: string; scope: string; suppliers: Supplier[] };

type Better = "higher" | "lower" | "none";
type MetricRow = { label: string; better: Better; value: (s: Supplier) => number | null | undefined; format: (v: number) => string };

type ItemPrice = { average: number; latest: number; latestMonth: string; quantity: number };
type ItemRow = { key: string; itemName: string; baseUnit: string; prices: Map<string, ItemPrice> };

const MAX_SELECTED = 5;

function bestOf(values: (number | null | undefined)[], better: Better): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (better === "none" || present.length < 2) return null;
  return better === "higher" ? Math.max(...present) : Math.min(...present);
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export default function SupplierComparisonPage() {
  const { tx } = useI18n();
  const companyId = useCompanyId();
  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [from, setFrom] = useState(todayIso(-180));
  const [to, setTo] = useState(todayIso());
  const [item, setItem] = useState("");
  const [branch, setBranch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!companyId) return;
    setBusy(true);
    setError("");
    try {
      const data = (await http.get<Report>(`/companies/${companyId}/procurement/supplier-performance`, {
        params: { from, to, branchId: branch || undefined, itemId: item || undefined },
      })).data;
      setReport(data);
      // Keep the current choice where possible; otherwise start with the most-used suppliers.
      const ids = new Set(data.suppliers.map((s) => s.id));
      const kept = selected.filter((id) => ids.has(id));
      setSelected(kept.length >= 2 ? kept : [...data.suppliers]
        .sort((a, b) => b.deliveries - a.deliveries || b.orders - a.orders)
        .slice(0, 3).map((s) => s.id));
    } catch (e) {
      setError(apiError(e, "Unable to load supplier data."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    void load();
    void Promise.all([
      inventoryItemsApi.list(companyId),
      http.get<{ id: string; name: string }[]>(`/companies/${companyId}/branches`).catch(() => ({ data: [] as { id: string; name: string }[] })),
    ]).then(([i, b]) => { setItems(i); setBranches(asItems(b.data)); })
      .catch((e) => setError(apiError(e, "Unable to load report filters.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const chosen = useMemo(
    () => (report?.suppliers ?? []).filter((s) => selected.includes(s.id)),
    [report, selected],
  );

  const spend = (s: Supplier) => s.priceTrends.reduce((sum, p) => sum + p.baseQuantity * p.weightedUnitPrice, 0);

  const metrics: MetricRow[] = [
    { label: "Overall score (of 100)", better: "higher", value: (s) => s.score, format: (v) => qty(v) },
    { label: "On-time deliveries", better: "higher", value: (s) => s.onTimePercent, format: (v) => `${qty(v)}%` },
    { label: "Average lead time", better: "lower", value: (s) => s.averageLeadDays, format: (v) => `${qty(v)} ${tx("days")}` },
    { label: "Line fulfilment", better: "higher", value: (s) => s.averageLineFulfilmentPercent, format: (v) => `${qty(v)}%` },
    { label: "Rejected at receiving", better: "lower", value: (s) => s.averageLineRejectionPercent, format: (v) => `${qty(v)}%` },
    { label: "Returned after receipt", better: "lower", value: (s) => s.averageLineReturnPercent, format: (v) => `${qty(v)}%` },
    { label: "Payment terms", better: "higher", value: (s) => s.paymentTermDays, format: (v) => `${qty(v)} ${tx("days")}` },
    { label: "Orders in period", better: "none", value: (s) => s.orders, format: (v) => qty(v) },
    { label: "Deliveries in period", better: "none", value: (s) => s.deliveries, format: (v) => qty(v) },
    { label: "Received value (excl. tax)", better: "none", value: (s) => spend(s), format: (v) => money(v) },
  ];

  // One row per item and base unit; prices are only compared within the same base unit.
  const itemRows = useMemo<ItemRow[]>(() => {
    const rows = new Map<string, ItemRow>();
    for (const s of chosen) {
      const bySupplier = new Map<string, PriceTrend[]>();
      for (const p of s.priceTrends) {
        const key = `${p.itemId}|${p.baseUnit}`;
        bySupplier.set(key, [...(bySupplier.get(key) ?? []), p]);
      }
      for (const [key, trends] of bySupplier) {
        const quantity = trends.reduce((sum, p) => sum + p.baseQuantity, 0);
        if (quantity <= 0) continue;
        const average = trends.reduce((sum, p) => sum + p.baseQuantity * p.weightedUnitPrice, 0) / quantity;
        const ordered = [...trends].sort((a, b) => a.month.localeCompare(b.month));
        const last = ordered[ordered.length - 1];
        const row = rows.get(key) ?? { key, itemName: trends[0].itemName, baseUnit: trends[0].baseUnit, prices: new Map() };
        row.prices.set(s.id, { average, latest: last.weightedUnitPrice, latestMonth: last.month, quantity });
        rows.set(key, row);
      }
    }
    return [...rows.values()].sort((a, b) => b.prices.size - a.prices.size || a.itemName.localeCompare(b.itemName));
  }, [chosen]);

  const sharedRows = itemRows.filter((r) => r.prices.size >= 2);
  const lowestCount = (supplierId: string) => sharedRows.filter((r) => {
    const mine = r.prices.get(supplierId)?.average;
    return mine != null && mine <= Math.min(...[...r.prices.values()].map((p) => p.average)) + 1e-9;
  }).length;

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((x) => x !== id)
      : current.length >= MAX_SELECTED ? current : [...current, id]);
  }

  function exportCsv() {
    const header = ["Measure", ...chosen.map((s) => s.name)];
    const lines = [header.map(csvCell).join(",")];
    for (const m of metrics)
      lines.push([tx(m.label), ...chosen.map((s) => { const v = m.value(s); return v == null ? "" : m.format(v); })].map(csvCell).join(","));
    lines.push(["Items priced lowest", ...chosen.map((s) => String(lowestCount(s.id)))].map(csvCell).join(","));
    for (const r of itemRows)
      lines.push([`${r.itemName} (per ${r.baseUnit})`, ...chosen.map((s) => { const p = r.prices.get(s.id); return p ? p.average.toFixed(4) : ""; })].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-comparison-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const notEnoughEvidence = (s: Supplier) => s.score == null;

  return (
    <main className="prq-page">
      <PageHeader
        title={tx("Compare suppliers")}
        subtitle={tx("Side by side: price per item, delivery, quality and terms from posted orders, receipts, inspections and returns. The best value in each row is marked. Supplier selection remains a purchasing decision.")}
      />
      {error && <p role="alert">{tx(error)}</p>}

      <section className="prq-panel">
        <div className="prq-form-grid">
          <label>{tx("From")}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>{tx("To")}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label>{tx("Branch")}
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">{tx("All authorized branches")}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </label>
          <label>{tx("Item (shows every approved supplier for it)")}
            <Select value={item} onChange={(e) => setItem(e.target.value)}>
              <option value="">{tx("All items")}</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button disabled={busy} onClick={() => void load()}>{busy ? tx("Loading...") : tx("Load suppliers")}</Button>
          {chosen.length > 0 && <Button variant="outline" onClick={exportCsv}>{tx("Download CSV")}</Button>}
          <Link to={`/companies/${companyId}/procurement/supplier-performance`}>{tx("Detailed supplier evidence")}</Link>
        </div>
      </section>

      {report && (
        <section className="prq-panel">
          <h2>{tx("Choose up to 5 suppliers")}</h2>
          {report.suppliers.length === 0
            ? <p>{tx("No suppliers have orders in this period.")}</p>
            : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {report.suppliers.map((s) => (
                  <Button key={s.id} size="sm" variant={selected.includes(s.id) ? "default" : "outline"}
                    onClick={() => toggle(s.id)} disabled={!selected.includes(s.id) && selected.length >= MAX_SELECTED}>
                    {s.name} ({s.deliveries} {tx("deliveries")})
                  </Button>
                ))}
              </div>
            )}
        </section>
      )}

      {chosen.length >= 2 && (
        <>
          <section className="prq-panel">
            <h2>{tx("Scorecard")}</h2>
            <p>{report?.from} – {report?.to}</p>
            <div className="prq-table-wrap">
              <table className="prq-table">
                <thead>
                  <tr>
                    <th>{tx("Measure")}</th>
                    {chosen.map((s) => (
                      <th key={s.id}>
                        {s.name}
                        <div>{s.eligible ? <Badge variant="success">{tx("Approved")}</Badge> : <Badge variant="destructive">{tx("Not eligible for new orders")}</Badge>}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const values = chosen.map((s) => m.value(s));
                    const best = bestOf(values, m.better);
                    return (
                      <tr key={m.label}>
                        <td>{tx(m.label)}{m.better !== "none" && <div className="prq-muted">{tx(m.better === "higher" ? "higher is better" : "lower is better")}</div>}</td>
                        {chosen.map((s, i) => {
                          const v = values[i];
                          return (
                            <td key={s.id}>
                              {v == null
                                ? <span className="prq-muted">{tx(m.label.startsWith("Overall") ? s.scoreStatus : "No data")}</span>
                                : m.format(v)}
                              {v != null && best != null && v === best && <> <Badge variant="success">{tx("Best")}</Badge></>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <td>{tx("Items priced lowest")}<div className="prq-muted">{tx("of items bought from two or more of these suppliers")}</div></td>
                    {chosen.map((s) => <td key={s.id}>{lowestCount(s.id)} / {sharedRows.filter((r) => r.prices.has(s.id)).length}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            {chosen.some(notEnoughEvidence) && (
              <p className="prq-muted">{tx("Overall scores need scoring switched on (Supplier Performance) and enough deliveries with inspections. Compare the individual measures when a score is missing.")}</p>
            )}
          </section>

          <section className="prq-panel">
            <h2>{tx("Price per item")}</h2>
            <p className="prq-muted">{tx("Quantity-weighted price per base unit in company currency, from posted receipts less returns, excluding tax and landed charges. The latest month is shown underneath. Prices are only compared within the same base unit.")}</p>
            {itemRows.length === 0
              ? <p>{tx("No comparable receipts in this period.")}</p>
              : (
                <div className="prq-table-wrap">
                  <table className="prq-table">
                    <thead>
                      <tr>
                        <th>{tx("Item")}</th>
                        {chosen.map((s) => <th key={s.id}>{s.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {itemRows.map((r) => {
                        const lowest = r.prices.size >= 2 ? Math.min(...[...r.prices.values()].map((p) => p.average)) : null;
                        return (
                          <tr key={r.key}>
                            <td>{r.itemName}<div className="prq-muted">{tx("per")} {r.baseUnit}</div></td>
                            {chosen.map((s) => {
                              const p = r.prices.get(s.id);
                              if (!p) return <td key={s.id}><span className="prq-muted">{tx("Not bought")}</span></td>;
                              const above = lowest != null && lowest > 0 ? (p.average / lowest - 1) * 100 : null;
                              return (
                                <td key={s.id}>
                                  {money(p.average)}
                                  {lowest != null && p.average <= lowest + 1e-9 && <> <Badge variant="success">{tx("Lowest")}</Badge></>}
                                  {above != null && above > 0.005 && <> <Badge variant="warning">+{qty(above)}%</Badge></>}
                                  <div className="prq-muted">{tx("Latest")} {p.latestMonth}: {money(p.latest)} | {qty(p.quantity)} {r.baseUnit}</div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
        </>
      )}

      {report && chosen.length < 2 && report.suppliers.length >= 2 && (
        <section className="prq-panel"><p>{tx("Pick at least two suppliers to compare.")}</p></section>
      )}
    </main>
  );
}
