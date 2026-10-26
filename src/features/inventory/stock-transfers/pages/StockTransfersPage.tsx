import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useHasPermission } from "../../../../auth/usePermissions";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowRightLeft, CheckCheck, ClipboardCheck, PackageCheck, Plus, RefreshCw, Search, Truck, TriangleAlert } from "lucide-react";
import "./stock-transfers.css";

import { stockTransfersApi } from "../api/stockTransfersApi";
import { buildStockTransferPaths } from "../routing/stockTransferRoutes";
import { STOCK_TRANSFER_TYPE, type StockTransferDirection, type StockTransferListRowDto } from "../types";
import { fmtDateTime, getApiError, money } from "../utils/apiUtils";
import { normalizeStockTransferStatus } from "../utils/stockTransferStatus";
import {
  normalizeTransferType,
  qty,
  transferStatusLabel,
  transferTypeLabel,
} from "../utils/stockTransferLabels";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "Draft,Rejected", label: "Drafts & returned" },
  { value: "Submitted", label: "Awaiting approval" },
  { value: "Approved", label: "Approved – not moved" },
  { value: "Issued", label: "In transit" },
  { value: "Posted", label: "Posted / received" },
  { value: "Cancelled,Reversed", label: "Cancelled / reversed" },
];

const DIRECTIONS: Array<{ value: StockTransferDirection; label: string }> = [
  { value: "all", label: "All" },
  { value: "outgoing", label: "Sent by this branch" },
  { value: "incoming", label: "Incoming to this branch" },
];

export default function StockTransfersPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();
  const paths = useMemo(() => buildStockTransferPaths(companyId), [companyId]);
  const canCreate = useHasPermission("stocktransfers.create");

  const [direction, setDirection] = useState<StockTransferDirection>("all");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StockTransferListRowDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const load = useCallback(async () => {
    if (!companyId || !branchId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await stockTransfersApi.list(companyId, branchId, { direction, status: status || null, type: type || null });
      if (id === requestId.current) setRows(data);
    } catch (e) {
      if (id === requestId.current) { setRows([]); setError(getApiError(e)); }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [companyId, branchId, direction, status, type]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.transferNumber, r.fromLocationName, r.toLocationName, r.fromBranchName, r.toBranchName, r.fromDepartmentName, r.toDepartmentName, r.reference]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const kpis = useMemo(() => {
    const s = (r: StockTransferListRowDto) => normalizeStockTransferStatus(r.status);
    return {
      awaiting: rows.filter((r) => s(r) === "Submitted").length,
      toMove: rows.filter((r) => s(r) === "Approved" && r.direction === "outgoing").length,
      toReceive: rows.filter((r) => s(r) === "Issued" && r.direction === "incoming").length,
      inTransit: rows.filter((r) => s(r) === "Issued" && r.direction === "outgoing").length,
      shortages: rows.filter((r) => r.hasShortage).length,
    };
  }, [rows]);

  const hasFilters = direction !== "all" || Boolean(status || type || query);
  const resetFilters = () => { setDirection("all"); setStatus(""); setType(""); setQuery(""); };
  const metrics = [
    { label: "Awaiting approval", value: kpis.awaiting, Icon: ClipboardCheck, tone: "warning" },
    { label: "Ready to move", value: kpis.toMove, Icon: CheckCheck, tone: "info" },
    { label: "To receive here", value: kpis.toReceive, Icon: PackageCheck, tone: "accent" },
    { label: "Sent, in transit", value: kpis.inTransit, Icon: Truck, tone: "neutral" },
    { label: "Received short", value: kpis.shortages, Icon: TriangleAlert, tone: "warning" },
  ];

  if (!companyId || !branchId || !paths) return <div className="st-workspace"><EmptyState title="Select a branch" detail="Choose a company and branch to view stock transfers." /></div>;

  return (
    <div className="st-workspace">
      <header className="st-header">
        <div className="st-heading">
          <span className="st-heading-icon"><ArrowRightLeft size={24} aria-hidden="true" /></span>
          <div><p className="st-eyebrow">Inventory / Movement</p><h1>Stock transfers</h1><p className="st-description">Track stock from dispatch to receipt, across locations and branches.</p></div>
        </div>
        <div className="st-header-actions">
          <Button variant="outline" onClick={() => navigate(paths.approvals)}><ClipboardCheck size={16} aria-hidden="true" />Approvals</Button>
          {canCreate && <Button onClick={() => navigate(paths.create)}><Plus size={17} aria-hidden="true" />New transfer</Button>}
        </div>
      </header>

      <section aria-label="Transfer summary" className="st-summary">
        <div className="st-section-label"><h2>At a glance</h2><span>Based on selected direction, status and type</span></div>
        <div className="st-metrics">
          {metrics.map(({ label, value, Icon, tone }) => <div className="st-metric" key={label}>
            <span className={`st-metric-icon st-tone-${tone}`}><Icon size={18} aria-hidden="true" /></span>
            <div><span className="st-metric-label">{label}</span><strong>{loading ? "…" : error ? "—" : value}</strong></div>
          </div>)}
        </div>
      </section>

      <section className="st-register" aria-label="Transfer register">
        <div className="st-register-top">
          <div><h2>Transfer register</h2><p>Review movement and follow up on outstanding transfers.</p></div>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}><RefreshCw size={15} className={loading ? "st-refreshing" : undefined} aria-hidden="true" />{loading ? "Refreshing…" : "Refresh"}</Button>
        </div>
        <div className="st-directions" role="group" aria-label="Transfer direction">
          {DIRECTIONS.map((d) => <Button key={d.value} variant="bare" className="st-direction" aria-pressed={direction === d.value} onClick={() => setDirection(d.value)}>
            {d.value === "incoming" ? <ArrowDownLeft size={16} aria-hidden="true" /> : d.value === "outgoing" ? <ArrowUpRight size={16} aria-hidden="true" /> : <ArrowRightLeft size={16} aria-hidden="true" />}
            {d.value === "all" ? "All transfers" : d.label}
          </Button>)}
        </div>
        <div className="st-filters">
          <label className="st-search-field"><span>Find a transfer</span><div className="st-search"><Search size={17} aria-hidden="true" /><Input placeholder="Number, location, branch or reference" value={query} onChange={(e) => setQuery(e.target.value)} /></div></label>
          <label><span>Status</span><Select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></label>
          <label><span>Transfer type</span><Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value={STOCK_TRANSFER_TYPE.InterDepartment}>Within this branch</option><option value={STOCK_TRANSFER_TYPE.InterBranch}>Branch to branch</option></Select></label>
        </div>
        <div className="st-results"><span role="status">{loading ? "Updating transfers…" : error ? "Transfers unavailable" : `${filtered.length} ${filtered.length === 1 ? "transfer" : "transfers"}${query.trim() ? ` matching “${query.trim()}”` : " shown"}`}</span>{hasFilters && <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>}</div>
        {error && <div className="st-feedback"><StateMessage tone="error" action={<Button variant="outline" size="sm" onClick={() => void load()}>Try again</Button>}>{error}</StateMessage></div>}
        {loading && rows.length === 0 && <div className="st-feedback"><StateMessage tone="loading">Loading transfers…</StateMessage></div>}
        {!loading && filtered.length === 0 && !error && <EmptyState title={hasFilters ? "No matching transfers" : "No transfers yet"} detail={hasFilters ? "Try another status, direction or search term." : "Create a transfer to move stock between your locations or branches."} action={hasFilters ? <Button variant="outline" onClick={resetFilters}>Clear filters</Button> : canCreate ? <Button onClick={() => navigate(paths.create)}><Plus size={16} aria-hidden="true" />New transfer</Button> : undefined} />}
        {filtered.length > 0 && <div className="st-table-scroll" role="region" aria-label="Stock transfer results" tabIndex={0} aria-busy={loading}>
          <table className={`st-table${loading ? " st-table-loading" : ""}`}>
            <thead><tr><th scope="col">Transfer</th><th scope="col">Movement route</th><th scope="col">Status</th><th scope="col" className="st-numeric">Items / Qty</th><th scope="col" className="st-numeric">Value</th><th scope="col"><span className="st-sr-only">Open transfer</span></th></tr></thead>
            <tbody>{filtered.map((r) => {
              const t = normalizeTransferType(r.transferType);
              return <tr key={r.id}>
                <td><Link className="st-number" to={paths.detail(r.id)}>{r.transferNumber}</Link><span className="st-cell-secondary">{fmtDateTime(r.transferDateUtc)}</span>{r.reference && <span className="st-cell-secondary st-reference" title={r.reference}>{r.reference}</span>}</td>
                <td><div className="st-route"><div><span className="st-route-label">From</span><strong>{r.fromLocationName || "—"}</strong><span className="st-cell-secondary">{r.fromBranchName || "—"}</span></div><ArrowRight size={17} aria-hidden="true" /><div><span className="st-route-label">To</span><strong>{r.toLocationName || "—"}</strong><span className="st-cell-secondary">{r.toBranchName || "—"}</span></div></div><div className="st-route-meta"><span>{transferTypeLabel(t)}</span>{r.direction === "incoming" && <span className="st-incoming"><ArrowDownLeft size={12} aria-hidden="true" />Incoming</span>}</div></td>
                <td><span className={`st-status st-status-${normalizeStockTransferStatus(r.status).toLowerCase()}`}>{transferStatusLabel(r.status, t)}</span>{r.hasShortage && <span className="st-shortage"><TriangleAlert size={13} aria-hidden="true" />Received short</span>}</td>
                <td className="st-numeric" data-label="Quantity"><strong>{qty(r.totalQuantity)}</strong><span className="st-cell-secondary">{r.lineCount} {r.lineCount === 1 ? "line" : "lines"}</span></td>
                <td className="st-numeric st-value" data-label="Value">{r.totalValue != null ? money(r.totalValue) : "—"}</td>
                <td><Link className="st-open" to={paths.detail(r.id)} aria-label={`Open transfer ${r.transferNumber}`}><ArrowUpRight size={18} aria-hidden="true" /></Link></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        <footer className="st-footer"><ArrowRightLeft size={15} aria-hidden="true" /><span>Transfers move stock between locations. Use SIVs for store issues to kitchens and outlets.</span></footer>
      </section>
    </div>
  );
}
