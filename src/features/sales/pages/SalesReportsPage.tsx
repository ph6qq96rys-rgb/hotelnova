import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { http } from "../../../api/http";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAppScope } from "../../../app/useAppScope";
import { useI18n } from "../../../i18n";
import { formatAppDateTime, todayLocalIsoDate } from "../../../shared/datetime/dateFormat";
import { money } from "../../pos/components/posUi";
import { extractApiError } from "../../pos/utils/posUtils";
import "../../pos/pos-service.css";

type Row = { key: string; label: string; saleCount: number; netSales: number; vat: number; serviceCharge: number; total: number; returns: number; netAfterReturns: number };
type Report = {
  from: string; to: string; timeZone: string; currencyCode: string; generatedAtUtc: string;
  summary: {
    saleCount: number; guestCount: number; grossSales: number; discounts: number; netSales: number; serviceCharge: number; vat: number;
    totalSales: number; returns: number; returnCount: number; netAfterReturns: number; cogs: number; grossProfit: number; marginPercent: number;
    averageTicket: number; collected: number; refunded: number; tips: number; openBalance: number; voidCount: number; voidAmount: number; pendingStockPosting: number;
  };
  days: Row[]; hours: Row[]; categories: Row[]; cashiers: Row[]; waiters: Row[];
  items: Array<{ menuItemId: string; item: string; category?: string | null; quantity: number; returnedQuantity: number; netSales: number; returns: number; netAfterReturns: number; cogs: number }>;
  payments: Array<{ method: string; count: number; collected: number; refunded: number; net: number }>;
  discounts: Array<{ saleId: string; saleNo: string; soldAtUtc: string; soldBy: string; amount: number; reason?: string | null; approvedBy?: string | null }>;
  returns: Array<{ returnId: string; returnNo: string; saleNo: string; approvedAtUtc: string; requestedBy: string; approvedBy?: string | null; reason: string; total: number; refund: number }>;
  voids: Array<{ saleId: string; saleNo: string; soldAtUtc: string; soldBy: string; amount: number; reason?: string | null; voidedAtUtc?: string | null }>;
  priceOverrides: Array<{ saleId: string; saleNo: string; soldAtUtc: string; item: string; quantity: number; listPrice: number; soldPrice: number; reason?: string | null; by?: string | null }>;
};

const SECTIONS = [
  { value: "days", label: "By day" }, { value: "hours", label: "By hour" }, { value: "items", label: "By item" },
  { value: "categories", label: "By category" }, { value: "cashiers", label: "By cashier" }, { value: "waiters", label: "By waiter" },
  { value: "payments", label: "Payments and refunds" }, { value: "discounts", label: "Discounts" }, { value: "returns", label: "Returns" },
  { value: "voids", label: "Voids" }, { value: "overrides", label: "Price overrides" },
] as const;
type Section = (typeof SECTIONS)[number]["value"];

function monthStart(iso: string) { return `${iso.slice(0, 8)}01`; }

/**
 * Sales reports computed on the server over the company's local days, so this page, the Z report
 * and the CSV exports always agree. Returns count on their approval day.
 */
export default function SalesReportsPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const base = useMemo(() => `/companies/${companyId}/branches/${branchId}/sales/reports`, [companyId, branchId]);
  const today = todayLocalIsoDate();
  const [range, setRange] = useState({ from: today, to: today });
  const [section, setSection] = useState<Section>("days");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !branchId || !range.from || !range.to) return;
    setLoading(true);
    setError(null);
    try {
      setReport((await http.get<Report>(base, { params: range })).data);
    } catch (err) {
      setError(extractApiError(err, "Unable to load the sales report."));
    } finally {
      setLoading(false);
    }
  }, [base, companyId, branchId, range]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv(which: string) {
    setExporting(true);
    setError(null);
    try {
      const response = await http.get<Blob>(`${base}/export`, { params: { ...range, section: which }, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-${which}-${range.from.replace(/-/g, "")}-${range.to.replace(/-/g, "")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractApiError(err, "The export could not be created."));
    } finally {
      setExporting(false);
    }
  }

  const s = report?.summary;
  const groupRows: Row[] | null = report && ["days", "hours", "categories", "cashiers", "waiters"].includes(section)
    ? (report[section as "days" | "hours" | "categories" | "cashiers" | "waiters"]) : null;

  return (
    <main className="rpos-page rpos-setup ui-page">
      <PageHeader title={tx("Sales Reports")}
        subtitle={report ? tx("Days and hours in {zone}. Returns count on the day they were approved.", { zone: report.timeZone }) : undefined}
        actions={<>
          <Button type="button" variant="outline" disabled={exporting || !report} onClick={() => void exportCsv("summary")}><Download size={14} aria-hidden="true" /> {tx("Summary CSV")}</Button>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" /> {tx("Refresh")}</Button>
        </>} />

      <section className="rpos-setup-area rpos-tip-filters" aria-label={tx("Filters")}>
        <label className="rpos-field"><span>{tx("From")}</span><Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
        <label className="rpos-field"><span>{tx("To")}</span><Input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
        <div className="rpos-chip-row" style={{ alignSelf: "end" }}>
          <Button type="button" size="sm" variant="outline" onClick={() => setRange({ from: today, to: today })}>{tx("Today")}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setRange({ from: monthStart(today), to: today })}>{tx("This month")}</Button>
        </div>
      </section>

      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {loading && !report ? <StateMessage tone="loading">{tx("Loading sales report...")}</StateMessage> : null}

      {s ? (
        <section className="rpos-oo-tiles" aria-label={tx("Summary")}>
          <div className="rpos-oo-tile"><span>{tx("Net sales after returns")}</span><strong>{money(s.netAfterReturns)}</strong><small>{tx("Excl. VAT and service charge")}</small></div>
          <div className="rpos-oo-tile"><span>{tx("Total billed")}</span><strong>{money(s.totalSales)}</strong><small>{s.saleCount} {tx("sales")} · {tx("avg")} {money(s.averageTicket)}</small></div>
          <div className="rpos-oo-tile"><span>{tx("VAT")}</span><strong>{money(s.vat)}</strong><small>{tx("Service charge")} {money(s.serviceCharge)}</small></div>
          <div className="rpos-oo-tile"><span>{tx("Discounts")}</span><strong>{money(s.discounts)}</strong><small>{report!.discounts.length} {tx("sales")}</small></div>
          <div className={s.returnCount ? "rpos-oo-tile is-warn" : "rpos-oo-tile"}><span>{tx("Returns")}</span><strong>{money(s.returns)}</strong><small>{s.returnCount} {tx("credit notes")} · {tx("refunded")} {money(s.refunded)}</small></div>
          <div className={s.voidCount ? "rpos-oo-tile is-warn" : "rpos-oo-tile"}><span>{tx("Voids")}</span><strong>{s.voidCount}</strong><small>{money(s.voidAmount)}</small></div>
          <div className="rpos-oo-tile"><span>{tx("Gross profit")}</span><strong>{money(s.grossProfit)}</strong><small>{tx("COGS")} {money(s.cogs)} · {s.marginPercent.toFixed(1)}%</small></div>
          <div className="rpos-oo-tile"><span>{tx("Collected")}</span><strong>{money(s.collected)}</strong><small>{tx("Tips")} {money(s.tips)} · {tx("still owed")} {money(s.openBalance)}</small></div>
          {s.pendingStockPosting ? <div className="rpos-oo-tile is-warn"><span>{tx("Stock posting pending")}</span><strong>{s.pendingStockPosting}</strong><small>{tx("Sales without COGS yet")}</small></div> : null}
        </section>
      ) : null}

      {report ? (
        <section className="rpos-setup-area" aria-label={tx("Details")}>
          <div className="rpos-tip-filters">
            <label className="rpos-field"><span>{tx("Show")}</span>
              <Select value={section} onChange={(e) => setSection(e.target.value as Section)}>
                {SECTIONS.map((x) => <option key={x.value} value={x.value}>{tx(x.label)}</option>)}
              </Select>
            </label>
            <Button type="button" variant="outline" style={{ alignSelf: "end" }} disabled={exporting} onClick={() => void exportCsv(section)}>
              <Download size={14} aria-hidden="true" /> {tx("Export CSV")}
            </Button>
          </div>

          {groupRows ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx(SECTIONS.find((x) => x.value === section)!.label)}</TableHead>
                <TableHead className="rpos-num">{tx("Sales")}</TableHead><TableHead className="rpos-num">{tx("Net sales")}</TableHead>
                <TableHead className="rpos-num">{tx("VAT")}</TableHead><TableHead className="rpos-num">{tx("Service charge")}</TableHead>
                <TableHead className="rpos-num">{tx("Total")}</TableHead><TableHead className="rpos-num">{tx("Returns")}</TableHead>
                <TableHead className="rpos-num">{tx("Net after returns")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {groupRows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{r.label}</TableCell><TableCell className="rpos-num">{r.saleCount}</TableCell>
                    <TableCell className="rpos-num">{money(r.netSales)}</TableCell><TableCell className="rpos-num">{money(r.vat)}</TableCell>
                    <TableCell className="rpos-num">{money(r.serviceCharge)}</TableCell><TableCell className="rpos-num">{money(r.total)}</TableCell>
                    <TableCell className="rpos-num">{money(r.returns)}</TableCell><TableCell className="rpos-num"><strong>{money(r.netAfterReturns)}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {section === "items" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Item")}</TableHead><TableHead>{tx("Category")}</TableHead><TableHead className="rpos-num">{tx("Quantity")}</TableHead>
                <TableHead className="rpos-num">{tx("Returned")}</TableHead><TableHead className="rpos-num">{tx("Net sales")}</TableHead>
                <TableHead className="rpos-num">{tx("Net after returns")}</TableHead><TableHead className="rpos-num">{tx("COGS")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.items.map((r) => (
                  <TableRow key={r.menuItemId}>
                    <TableCell>{r.item}</TableCell><TableCell>{r.category ?? "—"}</TableCell><TableCell className="rpos-num">{r.quantity}</TableCell>
                    <TableCell className="rpos-num">{r.returnedQuantity}</TableCell><TableCell className="rpos-num">{money(r.netSales)}</TableCell>
                    <TableCell className="rpos-num"><strong>{money(r.netAfterReturns)}</strong></TableCell><TableCell className="rpos-num">{money(r.cogs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {section === "payments" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Payment method")}</TableHead><TableHead className="rpos-num">{tx("Payments")}</TableHead>
                <TableHead className="rpos-num">{tx("Collected")}</TableHead><TableHead className="rpos-num">{tx("Refunded")}</TableHead><TableHead className="rpos-num">{tx("Net")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.payments.map((r) => (
                  <TableRow key={r.method}>
                    <TableCell>{tx(r.method)}</TableCell><TableCell className="rpos-num">{r.count}</TableCell><TableCell className="rpos-num">{money(r.collected)}</TableCell>
                    <TableCell className="rpos-num">{money(r.refunded)}</TableCell><TableCell className="rpos-num"><strong>{money(r.net)}</strong></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {section === "discounts" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Sale")}</TableHead><TableHead>{tx("Sold at")}</TableHead><TableHead>{tx("Sold by")}</TableHead>
                <TableHead className="rpos-num">{tx("Discount")}</TableHead><TableHead>{tx("Reason")}</TableHead><TableHead>{tx("Approved by")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.discounts.map((r) => (
                  <TableRow key={r.saleId}>
                    <TableCell>{r.saleNo}</TableCell><TableCell>{formatAppDateTime(r.soldAtUtc)}</TableCell><TableCell>{r.soldBy}</TableCell>
                    <TableCell className="rpos-num">{money(r.amount)}</TableCell><TableCell>{r.reason ?? "—"}</TableCell><TableCell>{r.approvedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {section === "returns" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Return")}</TableHead><TableHead>{tx("Sale")}</TableHead><TableHead>{tx("Approved")}</TableHead>
                <TableHead>{tx("Requested by")}</TableHead><TableHead>{tx("Approved by")}</TableHead><TableHead>{tx("Reason")}</TableHead>
                <TableHead className="rpos-num">{tx("Total")}</TableHead><TableHead className="rpos-num">{tx("Refund")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.returns.map((r) => (
                  <TableRow key={r.returnId}>
                    <TableCell>{r.returnNo}</TableCell><TableCell>{r.saleNo}</TableCell><TableCell>{formatAppDateTime(r.approvedAtUtc)}</TableCell>
                    <TableCell>{r.requestedBy}</TableCell><TableCell>{r.approvedBy ?? "—"}</TableCell><TableCell>{r.reason}</TableCell>
                    <TableCell className="rpos-num">{money(r.total)}</TableCell><TableCell className="rpos-num">{money(r.refund)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {section === "voids" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Sale")}</TableHead><TableHead>{tx("Sold at")}</TableHead><TableHead>{tx("Sold by")}</TableHead>
                <TableHead className="rpos-num">{tx("Amount")}</TableHead><TableHead>{tx("Reason")}</TableHead><TableHead>{tx("Voided at")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.voids.map((r) => (
                  <TableRow key={r.saleId}>
                    <TableCell>{r.saleNo}</TableCell><TableCell>{formatAppDateTime(r.soldAtUtc)}</TableCell><TableCell>{r.soldBy}</TableCell>
                    <TableCell className="rpos-num">{money(r.amount)}</TableCell><TableCell>{r.reason ?? "—"}</TableCell>
                    <TableCell>{r.voidedAtUtc ? formatAppDateTime(r.voidedAtUtc) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {section === "overrides" ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Sale")}</TableHead><TableHead>{tx("Item")}</TableHead><TableHead className="rpos-num">{tx("Quantity")}</TableHead>
                <TableHead className="rpos-num">{tx("Menu price")}</TableHead><TableHead className="rpos-num">{tx("Sold at price")}</TableHead>
                <TableHead>{tx("Reason")}</TableHead><TableHead>{tx("By")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.priceOverrides.map((r, i) => (
                  <TableRow key={`${r.saleId}-${i}`}>
                    <TableCell>{r.saleNo}<br /><span className="rpos-muted">{formatAppDateTime(r.soldAtUtc)}</span></TableCell><TableCell>{r.item}</TableCell>
                    <TableCell className="rpos-num">{r.quantity}</TableCell><TableCell className="rpos-num">{money(r.listPrice)}</TableCell>
                    <TableCell className="rpos-num">{money(r.soldPrice)}</TableCell><TableCell>{r.reason ?? "—"}</TableCell><TableCell>{r.by ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          <p className="rpos-muted">{tx("Generated")} {formatAppDateTime(report.generatedAtUtc)}</p>
        </section>
      ) : null}
    </main>
  );
}
