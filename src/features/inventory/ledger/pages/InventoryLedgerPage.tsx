import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { type InventoryLedgerMovementType, type InventoryLedgerQuery } from "../api/inventoryLedgerApi";
import LedgerTable from "../components/LedgerTable";
import { useInventoryLedger } from "../hooks/useInventoryLedger";
import "./InventoryLedgerPage.css";

const PAGE_SIZE = 50;

const MOVEMENTS: readonly { value: InventoryLedgerMovementType | ""; label: string }[] = [
  { value: "", label: "All stock activity" },
  { value: "GRN", label: "Goods received" },
  { value: "SALE_COGS", label: "Sales consumption / COGS" },
  { value: "SIV_TRANSFER_OUT", label: "SIV transfer out" },
  { value: "SIV_TRANSFER_IN", label: "SIV transfer in" },
  { value: "STOCK_TRANSFER_OUT", label: "Stock transfer out" },
  { value: "STOCK_TRANSFER_IN", label: "Stock transfer in" },
  { value: "ADJUSTMENT_IN", label: "Adjustment increase" },
  { value: "ADJUSTMENT_OUT", label: "Adjustment decrease" },
  { value: "PRODUCTION_INPUT", label: "Production input" },
  { value: "PRODUCTION_OUTPUT", label: "Production output" },
];

const PERIODS = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "Last 7 days", days: 6 },
  { id: "30d", label: "Last 30 days", days: 29 },
  { id: "90d", label: "Last 90 days", days: 89 },
] as const;

type Filters = {
  item: string;
  location: string;
  referenceNo: string;
  movementType: InventoryLedgerMovementType | "";
  fromDate: string;
  toDate: string;
};

const EMPTY_FILTERS: Filters = {
  item: "", location: "", referenceNo: "", movementType: "", fromDate: "", toDate: "",
};

export default function InventoryLedgerPage() {
  const { companyId, branchId } = useAppScope();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const dateError = filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
    ? "Start date cannot be later than end date."
    : null;

  const hasFilters = Object.values(filters).some((value) => value.trim().length > 0);

  const query = useMemo<InventoryLedgerQuery>(() => ({
    item: cleanOrNull(filters.item),
    location: cleanOrNull(filters.location),
    referenceNo: cleanOrNull(filters.referenceNo),
    movementType: cleanOrNull(filters.movementType),
    fromUtc: toUtcStart(filters.fromDate),
    toUtc: toUtcExclusiveEnd(filters.toDate),
    page,
    pageSize: PAGE_SIZE,
  }), [filters, page]);

  const { data, paging, loading, error } = useInventoryLedger(
    companyId && !dateError ? companyId : null,
    branchId && !dateError ? branchId : null,
    query,
  );

  const items = data?.items ?? [];
  const totalCount = paging.totalCount;
  const totalPages = Math.max(paging.totalPages, 1);
  const currentPage = paging.page;
  const fromRow = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(fromRow + items.length - 1, totalCount);

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const applyPeriod = useCallback((days: number) => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    from.setDate(from.getDate() - days);
    setFilters((previous) => ({
      ...previous,
      fromDate: localDate(from),
      toDate: localDate(today),
    }));
    setPage(1);
  }, []);

  if (!companyId || !branchId) {
    return <ScopeRequired missingBranch={!branchId} />;
  }

  return (
    <main className="page inventory-ledger-page">
      <div className="inventory-ledger-fixed-header">
        <header className="page-header inventory-ledger-page-header">
          <div>
            <div className="page-kicker">Inventory control</div>
            <h1 className="page-title">Inventory ledger</h1>
            <div className="page-sub">Branch-scoped source of truth for stock quantity and value movements.</div>
          </div>
          <Kpi label="Loaded on page" value={items.length} sub={`${formatInt(totalCount)} total movements`} />
        </header>

        <section className="kpi-grid inventory-ledger-kpi-grid" aria-label="Ledger summary">
          <Kpi label="Total activity" value={formatInt(totalCount)} sub="Movements found" />
          <Kpi label="Showing" value={items.length ? `${fromRow}-${toRow}` : "0"} sub={`Page ${currentPage} of ${totalPages}`} />
          <Kpi label="Scope" value="Selected branch" sub="Company and branch isolated" />
          <Kpi label="Activity type" value={MOVEMENTS.find((x) => x.value === filters.movementType)?.label ?? "All"} sub="How inventory moved" />
        </section>
      </div>

      <div className="inventory-ledger-content">
        <section className="card inventory-ledger-search-card" aria-labelledby="ledger-filters-title">
          <CardHeader id="ledger-filters-title" title="Find stock activity" subtitle="Search by item, location, document, activity, or posting date." action={
            <button type="button" className="btn btn-sm" onClick={reset} disabled={!hasFilters || loading}>Reset</button>
          } />

          <div className="inventory-ledger-filter-panel">
            <Field id="ledger-item" label="Item" value={filters.item} onChange={(value) => updateFilter("item", value)} placeholder="Item name" disabled={loading} />
            <Field id="ledger-location" label="Location" value={filters.location} onChange={(value) => updateFilter("location", value)} placeholder="Warehouse, kitchen, bar..." disabled={loading} />
            <Field id="ledger-reference" label="Document" value={filters.referenceNo} onChange={(value) => updateFilter("referenceNo", value)} placeholder="GRN, SIV, sale..." disabled={loading} />
            <Select id="ledger-movement" label="Activity" value={filters.movementType} onChange={(value) => updateFilter("movementType", value)} options={MOVEMENTS} disabled={loading} />
            <Field id="ledger-from" label="From" type="date" value={filters.fromDate} onChange={(value) => updateFilter("fromDate", value)} disabled={loading} />
            <Field id="ledger-to" label="To" type="date" value={filters.toDate} onChange={(value) => updateFilter("toDate", value)} disabled={loading} />
          </div>

          <div className="inventory-ledger-quick-actions" aria-label="Common periods">
            {PERIODS.map((period) => (
              <button key={period.id} type="button" className="btn btn-sm" onClick={() => applyPeriod(period.days)} disabled={loading}>{period.label}</button>
            ))}
          </div>

          {dateError ? <Alert tone="danger"><strong>Check the dates:</strong> {dateError}</Alert> : null}
          {loading ? <Alert tone="info">Loading inventory movements…</Alert> : null}
          {error ? <Alert tone="danger"><strong>Unable to load inventory movements:</strong> {error}</Alert> : null}
        </section>

        <section className="card" aria-labelledby="ledger-movements-title">
          <CardHeader id="ledger-movements-title" title="Inventory movements" subtitle="Immutable stock-card activity with quantities, balances, and FIFO value." />
          {!loading && items.length === 0
            ? <EmptyState hasFilters={hasFilters} onReset={reset} />
            : <div className="inventory-ledger-table-wrap"><LedgerTable items={items} /></div>}

          <footer className="inventory-ledger-footer">
            <span>{formatInt(totalCount)} movement{totalCount === 1 ? "" : "s"} • Page {currentPage} of {totalPages}</span>
            <div className="inventory-ledger-footer-actions">
              <span>{formatInt(items.length)} shown</span>
              <button type="button" className="btn btn-sm" onClick={() => setPage((x) => Math.max(1, x - 1))} disabled={loading || currentPage <= 1}>Previous</button>
              <button type="button" className="btn btn-sm" onClick={() => setPage((x) => Math.min(totalPages, x + 1))} disabled={loading || currentPage >= totalPages}>Next</button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function ScopeRequired({ missingBranch }: { missingBranch: boolean }) {
  return <main className="page inventory-ledger-page"><section className="card inventory-ledger-empty-state"><div className="card-title">{missingBranch ? "Choose a branch first" : "Choose a company first"}</div><div className="card-subtitle">Inventory activity is isolated by company and branch.</div></section></main>;
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return <div className="inventory-ledger-empty-state" role="status"><div className="card-title">No inventory movements found</div><div className="card-subtitle">{hasFilters ? "No movements match the selected filters." : "Movements appear after receipts, transfers, adjustments, production, or sales are posted."}</div>{hasFilters ? <button type="button" className="btn btn-sm" onClick={onReset}>Reset filters</button> : null}</div>;
}

const CardHeader = memo(function CardHeader({ id, title, subtitle, action }: { id: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="card-header"><div><div id={id} className="card-title">{title}</div><div className="card-subtitle">{subtitle}</div></div>{action ? <div className="inventory-ledger-card-action">{action}</div> : null}</div>;
});

function Field({ id, label, value, onChange, placeholder, type = "text", disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "date"; disabled?: boolean }) {
  return <div className="form-field"><label className="form-label" htmlFor={id}>{label}</label><input id={id} className="form-control" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoComplete="off" /></div>;
}

function Select<T extends string>({ id, label, value, onChange, options, disabled }: { id: string; label: string; value: T; onChange: (value: T) => void; options: readonly { value: T; label: string }[]; disabled?: boolean }) {
  return <div className="form-field"><label className="form-label" htmlFor={id}>{label}</label><select id={id} className="form-control" value={value} onChange={(e) => onChange(e.target.value as T)} disabled={disabled}>{options.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}</select></div>;
}

const Kpi = memo(function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="kpi"><div className="kpi-label">{label}</div><div className="kpi-val">{value}</div>{sub ? <div className="kpi-sub">{sub}</div> : null}</div>;
});

function Alert({ tone, children }: { tone: "info" | "danger"; children: ReactNode }) {
  return <div className={`alert alert-${tone} inventory-ledger-alert`} role="alert">{children}</div>;
}

function cleanOrNull<T extends string>(value: T): T | null { return value.trim() ? value.trim() as T : null; }
function toUtcStart(value: string): string | null { return value ? new Date(`${value}T00:00:00`).toISOString() : null; }
function toUtcExclusiveEnd(value: string): string | null { if (!value) return null; const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + 1); return date.toISOString(); }
function localDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function formatInt(value: number): string { return new Intl.NumberFormat().format(value); }
