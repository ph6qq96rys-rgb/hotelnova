import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, Boxes, ClipboardList, Download, FileText, PackageSearch, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { useAppScope } from "../../../../app/useAppScope";
import { inventoryLedgerApi, type InventoryLedgerMovementType, type InventoryLedgerQuery, type InventoryLedgerSummaryRowDto, type InventoryReconciliationResultDto, type InventoryValuationReportDto } from "../../ledger/api/inventoryLedgerApi";
import type { InventoryLedgerDto } from "../../ledger/types";
import { grnApi } from "../../grn/api/grnApi";
import type { GrnDetailDto } from "../../grn/types/grn.types";
import "./InventoryReportsPage.css";

type ReportTab = "stock" | "valuation" | "ledger" | "grn" | "siv" | "exceptions" | "reconciliation";

type Filters = {
  fromDate: string;
  toDate: string;
  item: string;
  location: string;
  referenceNo: string;
  movementType: InventoryLedgerMovementType | "";
};

type LoadState = {
  ledger: InventoryLedgerDto[];
  totalCount: number;
  summary: InventoryLedgerSummaryRowDto[];
  valuation: InventoryValuationReportDto | null;
  reconciliation: InventoryReconciliationResultDto | null;
  loading: boolean;
  error: string | null;
  asOfUtc: string | null;
};

type DocumentSummary = {
  key: string;
  sourceId: string | null;
  sourceType: string;
  sourceNo: string;
  postedAtUtc: string | null;
  itemCount: number;
  qtyIn: number;
  qtyOut: number;
  valueIn: number;
  valueOut: number;
  firstLines: InventoryLedgerDto[];
  isReversal: boolean;
};

const PAGE_SIZE = 100;
const FILTER_KEY_PREFIX = "hotelnova.inventory-reports.v1";

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  item: "",
  location: "",
  referenceNo: "",
  movementType: "",
};

const TABS: Array<{ id: ReportTab; label: string; icon: ReactNode }> = [
  { id: "stock", label: "Stock on hand", icon: <Boxes size={16} /> },
  { id: "valuation", label: "Valuation", icon: <BarChart3 size={16} /> },
  { id: "ledger", label: "Movement ledger", icon: <ClipboardList size={16} /> },
  { id: "grn", label: "GRN register", icon: <FileText size={16} /> },
  { id: "siv", label: "SIV register", icon: <PackageSearch size={16} /> },
  { id: "exceptions", label: "Exceptions", icon: <AlertTriangle size={16} /> },
  { id: "reconciliation", label: "Reconciliation", icon: <ShieldCheck size={16} /> },
];

const MOVEMENTS: readonly { value: InventoryLedgerMovementType | ""; label: string }[] = [
  { value: "", label: "All posted movement" },
  { value: "GRN", label: "GRN receipts" },
  { value: "SIV_TRANSFER_OUT", label: "SIV issue out" },
  { value: "SIV_TRANSFER_IN", label: "SIV transfer in" },
  { value: "SALE_COGS", label: "Sales COGS" },
  { value: "STOCK_TRANSFER_OUT", label: "Transfer out" },
  { value: "STOCK_TRANSFER_IN", label: "Transfer in" },
  { value: "ADJUSTMENT_IN", label: "Adjustment in" },
  { value: "ADJUSTMENT_OUT", label: "Adjustment out" },
  { value: "PRODUCTION_INPUT", label: "Production input" },
  { value: "PRODUCTION_OUTPUT", label: "Production output" },
];

export default function InventoryReportsPage() {
  const { companyId, branchId, branchName } = useAppScope();
  const [activeTab, setActiveTab] = useState<ReportTab>("stock");
  const [filters, setFilters] = useState<Filters>(() => readFilters(companyId, branchId));
  const [page, setPage] = useState(1);
  const [selectedDocumentKey, setSelectedDocumentKey] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({
    ledger: [],
    totalCount: 0,
    summary: [],
    valuation: null,
    reconciliation: null,
    loading: false,
    error: null,
    asOfUtc: null,
  });

  useEffect(() => {
    setFilters(readFilters(companyId, branchId));
    setPage(1);
    setSelectedDocumentKey(null);
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !branchId) return;
    window.sessionStorage.setItem(filterKey(companyId, branchId), JSON.stringify(filters));
  }, [branchId, companyId, filters]);

  const query = useMemo<InventoryLedgerQuery>(() => ({
    fromUtc: toUtcStart(filters.fromDate),
    toUtc: toUtcExclusiveEnd(filters.toDate),
    item: cleanOrNull(filters.item),
    location: cleanOrNull(filters.location),
    referenceNo: cleanOrNull(filters.referenceNo),
    movementType: cleanOrNull(filters.movementType),
    page,
    pageSize: PAGE_SIZE,
  }), [filters, page]);

  useEffect(() => {
    if (!companyId || !branchId) {
      setState((current) => ({ ...current, loading: false, error: null }));
      return;
    }

    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.all([
      inventoryLedgerApi.list(companyId, branchId, query, controller.signal),
      inventoryLedgerApi.summary(companyId, branchId, { item: cleanOrNull(filters.item) }, controller.signal),
      inventoryLedgerApi.valuation(companyId, branchId, { asOfUtc: query.toUtc }, controller.signal),
      inventoryLedgerApi.reconciliation(companyId, branchId, {}, controller.signal),
    ])
      .then(([ledger, summary, valuation, reconciliation]) => {
        setState({
          ledger: ledger.items ?? [],
          totalCount: ledger.totalCount ?? 0,
          summary,
          valuation,
          reconciliation,
          loading: false,
          error: null,
          asOfUtc: new Date().toISOString(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, loading: false, error: getError(error) }));
      });

    return () => controller.abort();
  }, [branchId, companyId, filters.item, query]);

  const documents = useMemo(() => groupDocuments(state.ledger), [state.ledger]);
  const grnDocuments = documents.filter((doc) => isGrn(doc.sourceType, doc.sourceNo));
  const sivDocuments = documents.filter((doc) => isSiv(doc.sourceType, doc.sourceNo));
  const selectedDocument = documents.find((doc) => doc.key === selectedDocumentKey) ?? grnDocuments[0] ?? sivDocuments[0] ?? documents[0] ?? null;
  const exceptions = useMemo(() => buildExceptions(state), [state]);
  const totalPages = Math.max(1, Math.ceil(state.totalCount / PAGE_SIZE));

  function patchFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  if (!companyId || !branchId) {
    return <main className="inventory-reports"><section className="ir-panel ir-empty"><strong>Select company and branch</strong><span>Inventory reporting is secured by company and branch scope.</span></section></main>;
  }

  return (
    <main className="inventory-reports">
      <header className="ir-header">
        <div>
          <div className="ir-kicker">Inventory control / branch reporting</div>
          <h1>Inventory Reports</h1>
          <p>Posted ledger reporting, transaction registers, previews, and reconciliation for {branchName || "selected branch"}.</p>
        </div>
        <div className="ir-header-actions">
          <button className="ir-btn" type="button" onClick={() => window.print()}><FileText size={16} /> Print</button>
          <button className="ir-btn" type="button" disabled><Download size={16} /> Export queued</button>
        </div>
      </header>

      <section className="ir-metrics" aria-label="Inventory report metrics">
        <Metric label="Stock value" value={money(state.valuation?.totalFifoValue)} detail="FIFO valuation" />
        <Metric label="On hand" value={qty(state.valuation?.totalOnHandBase)} detail="Base quantity" />
        <Metric label="Movements" value={int(state.totalCount)} detail="Posted ledger rows" />
        <Metric label="Exceptions" value={exceptions.length} detail={state.reconciliation?.isBalanced ? "Balanced" : "Needs review"} tone={exceptions.length ? "warn" : "ok"} />
        <Metric label="As of" value={formatTime(state.asOfUtc)} detail="Report timestamp" />
      </section>

      <section className="ir-panel ir-filters" aria-label="Inventory report filters">
        <label><span>From</span><input type="date" value={filters.fromDate} onChange={(event) => patchFilter("fromDate", event.target.value)} /></label>
        <label><span>To</span><input type="date" value={filters.toDate} onChange={(event) => patchFilter("toDate", event.target.value)} /></label>
        <label><span>Item</span><input value={filters.item} onChange={(event) => patchFilter("item", event.target.value)} placeholder="Name or SKU" /></label>
        <label><span>Location</span><input value={filters.location} onChange={(event) => patchFilter("location", event.target.value)} placeholder="Warehouse, kitchen..." /></label>
        <label><span>Reference</span><input value={filters.referenceNo} onChange={(event) => patchFilter("referenceNo", event.target.value)} placeholder="GRN, SIV, batch" /></label>
        <label><span>Movement</span><select value={filters.movementType} onChange={(event) => patchFilter("movementType", event.target.value)}>{MOVEMENTS.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}</select></label>
        <button className="ir-btn ir-btn-primary" type="button" onClick={resetFilters}><RefreshCw size={16} /> Clear</button>
      </section>

      {state.error ? <div className="ir-alert"><AlertTriangle size={16} /> {state.error}</div> : null}
      {state.loading ? <div className="ir-alert ir-alert-info"><Search size={16} /> Loading posted inventory reports...</div> : null}

      <nav className="ir-tabs" aria-label="Inventory report views">
        {TABS.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "is-active" : ""} type="button" onClick={() => setActiveTab(tab.id)}>{tab.icon}{tab.label}</button>)}
      </nav>

      <section className="ir-workspace">
        <div className="ir-main-panel">
          {activeTab === "stock" && <StockOnHand rows={state.summary} />}
          {activeTab === "valuation" && <Valuation report={state.valuation} />}
          {activeTab === "ledger" && <Ledger rows={state.ledger} onSelect={setSelectedDocumentKey} />}
          {activeTab === "grn" && <DocumentRegister title="GRN register" docs={grnDocuments} companyId={companyId} branchId={branchId} onSelect={setSelectedDocumentKey} />}
          {activeTab === "siv" && <DocumentRegister title="SIV register" docs={sivDocuments} companyId={companyId} branchId={branchId} onSelect={setSelectedDocumentKey} />}
          {activeTab === "exceptions" && <Exceptions rows={exceptions} />}
          {activeTab === "reconciliation" && <Reconciliation result={state.reconciliation} />}

          <footer className="ir-pager">
            <span>{int(state.totalCount)} posted movements / page {page} of {totalPages}</span>
            <div>
              <button className="ir-btn" type="button" disabled={page <= 1 || state.loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <button className="ir-btn" type="button" disabled={page >= totalPages || state.loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
            </div>
          </footer>
        </div>

        <aside className="ir-preview" aria-label="Transaction preview">
          <TransactionPreview doc={selectedDocument} companyId={companyId} branchId={branchId} />
        </aside>
      </section>
    </main>
  );
}

function StockOnHand({ rows }: { rows: InventoryLedgerSummaryRowDto[] }) {
  return <ReportTable title="Stock on hand" columns={["Item", "Location", "UOM", "On hand", "Avg cost", "Value"]} empty="No stock balances found.">{rows.slice(0, 100).map((row, index) => <tr key={index}><td>{row.itemName}</td><td>{row.locationName}</td><td>{row.baseUom}</td><td className="num">{qty(row.onHandBase)}</td><td className="num">{money(row.avgCost)}</td><td className="num">{money(row.stockValue)}</td></tr>)}</ReportTable>;
}

function Valuation({ report }: { report: InventoryValuationReportDto | null }) {
  const rows = report?.rows ?? [];
  return <ReportTable title="Inventory valuation" columns={["Item", "Location", "Available", "FIFO value", "Ledger value", "Balance value", "Lots", "Status"]} empty="No valuation rows found.">{rows.slice(0, 100).map((row) => <tr key={row.locationId + row.itemId}><td>{row.itemName}</td><td>{row.locationName}</td><td className="num">{qty(row.availableBase)} {row.baseUom}</td><td className="num">{money(row.fifoValue)}</td><td className="num">{money(row.ledgerValue)}</td><td className="num">{money(row.stockBalanceValue)}</td><td className="num">{int(row.activeLotCount)}</td><td><Badge tone={row.isBalanced ? "ok" : "warn"}>{row.isBalanced ? "Balanced" : "Variance"}</Badge></td></tr>)}</ReportTable>;
}

function Ledger({ rows, onSelect }: { rows: InventoryLedgerDto[]; onSelect: (key: string) => void }) {
  return <ReportTable title="Stock movement and inventory ledger" columns={["Posted", "Movement", "Reference", "Item", "Location", "In", "Out", "Value", "Balance"]} empty="No posted ledger movements found.">{rows.map((row, index) => { const sourceNo = refNo(row); const key = documentKey(row); return <tr key={(idOf(row) || String(index)) + sourceNo}><td>{formatDate(postedAt(row))}</td><td><Badge>{movementOf(row)}</Badge></td><td><button className="ir-link-button" type="button" onClick={() => onSelect(key)}>{sourceNo}</button></td><td>{itemName(row)}</td><td>{locationName(row)}</td><td className="num">{qty(qtyIn(row))}</td><td className="num">{qty(qtyOut(row))}</td><td className="num">{money(valueChange(row))}</td><td className="num">{qty(balanceQty(row))}</td></tr>; })}</ReportTable>;
}

function DocumentRegister({ title, docs, companyId, branchId, onSelect }: { title: string; docs: DocumentSummary[]; companyId: string; branchId: string; onSelect: (key: string) => void }) {
  return <ReportTable title={title} columns={["Reference", "Posted", "Lines", "Qty in", "Qty out", "Value", "Status", "Open"]} empty="No posted documents found in this register.">{docs.map((doc) => <tr key={doc.key}><td><button className="ir-link-button" type="button" onFocus={() => onSelect(doc.key)} onMouseEnter={() => onSelect(doc.key)} onClick={() => onSelect(doc.key)}>{doc.sourceNo}</button></td><td>{formatDate(doc.postedAtUtc)}</td><td className="num">{int(doc.itemCount)}</td><td className="num">{qty(doc.qtyIn)}</td><td className="num">{qty(doc.qtyOut)}</td><td className="num">{money(doc.valueIn || doc.valueOut)}</td><td><Badge tone={doc.isReversal ? "warn" : "ok"}>{doc.isReversal ? "Reversal" : "Posted"}</Badge></td><td>{doc.sourceId ? <Link className="ir-open-link" to={documentPath(companyId, branchId, doc)}>Open</Link> : "-"}</td></tr>)}</ReportTable>;
}

function Exceptions({ rows }: { rows: string[] }) {
  return <section className="ir-report"><h2>Negative stock and inventory exceptions</h2>{rows.length === 0 ? <div className="ir-empty-inline">No exceptions detected from the loaded posted reports.</div> : <div className="ir-exception-list">{rows.map((row) => <div key={row}><AlertTriangle size={16} /> <span>{row}</span></div>)}</div>}</section>;
}

function Reconciliation({ result }: { result: InventoryReconciliationResultDto | null }) {
  return <section className="ir-report"><h2>Inventory reconciliation</h2><div className="ir-recon-grid"><Metric label="Ledger qty" value={qty(result?.ledgerQty)} detail="Posted movements" /><Metric label="FIFO qty" value={qty(result?.fifoQty)} detail="Open lots" /><Metric label="Stock balance qty" value={qty(result?.stockBalanceQty)} detail="Balance table" /><Metric label="Ledger value" value={money(result?.ledgerValue)} detail="Posted value" /><Metric label="FIFO value" value={money(result?.fifoValue)} detail="Lot value" /><Metric label="Status" value={result?.isBalanced ? "Balanced" : "Review"} detail="Ledger/FIFO/balance" tone={result?.isBalanced ? "ok" : "warn"} /></div>{result?.warnings?.length ? <div className="ir-exception-list">{result.warnings.map((warning) => <div key={warning}><AlertTriangle size={16} /> <span>{warning}</span></div>)}</div> : null}</section>;
}

function TransactionPreview({ doc, companyId, branchId }: { doc: DocumentSummary | null; companyId: string; branchId: string }) {
  const [grnDetail, setGrnDetail] = useState<GrnDetailDto | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc?.sourceId || !isGrn(doc.sourceType, doc.sourceNo)) {
      setGrnDetail(null);
      setPreviewError(null);
      setLoadingPreview(false);
      return;
    }

    let alive = true;
    setLoadingPreview(true);
    setPreviewError(null);

    grnApi.getById({ companyId, branchId }, doc.sourceId)
      .then((detail) => {
        if (!alive) return;
        setGrnDetail(detail);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setGrnDetail(null);
        setPreviewError(getError(error));
      })
      .finally(() => {
        if (alive) setLoadingPreview(false);
      });

    return () => {
      alive = false;
    };
  }, [branchId, companyId, doc?.key, doc?.sourceId, doc?.sourceNo, doc?.sourceType]);

  if (!doc) return <div className="ir-preview-card"><h2>Transaction preview</h2><p>Hover, focus, or select a GRN/SIV reference to preview the posted source document.</p></div>;

  const grnLines = grnDetail?.lines ?? [];
  const previewLines = grnDetail ? grnLines.slice(0, 5) : doc.firstLines.slice(0, 5);
  const supplierName = cleanOrNull(grnDetail?.supplierName);
  const receiptDate = cleanOrNull(grnDetail?.receiptDate) || cleanOrNull(grnDetail?.receivedDate) || cleanOrNull(grnDetail?.receivedAtUtc);
  const postedDate = cleanOrNull(grnDetail?.postedAtUtc) || cleanOrNull(grnDetail?.postedAt) || doc.postedAtUtc;
  const location = cleanOrNull(grnDetail?.receivingLocationName) || cleanOrNull(grnDetail?.warehouseName) || cleanOrNull(grnDetail?.locationName);
  const total = grnDetail ? grnTotal(grnDetail) : doc.valueIn || doc.valueOut;

  return <div className="ir-preview-card"><div className="ir-preview-head"><span>{isGrn(doc.sourceType, doc.sourceNo) ? "GRN preview" : doc.sourceType}</span><Badge tone={doc.isReversal ? "warn" : "ok"}>{grnDetail?.status || (doc.isReversal ? "Reversal" : "Posted")}</Badge></div><h2>{grnDetail?.grnNumber || grnDetail?.grnNo || doc.sourceNo}</h2>{loadingPreview ? <div className="ir-preview-note">Loading GRN detail...</div> : null}{previewError ? <div className="ir-preview-note ir-preview-note-warn">{previewError}</div> : null}<dl><div><dt>Supplier</dt><dd>{supplierName || "-"}</dd></div><div><dt>Receipt date</dt><dd>{formatDate(receiptDate)}</dd></div><div><dt>Posted</dt><dd>{formatDate(postedDate)}</dd></div><div><dt>Location</dt><dd>{location || "-"}</dd></div><div><dt>Lines</dt><dd>{int(grnDetail ? grnLines.length : doc.itemCount)}</dd></div><div><dt>Total qty</dt><dd>{qty(grnDetail ? grnLines.reduce((sum, line) => sum + number(line.quantity), 0) : doc.qtyIn)}</dd></div><div><dt>Total value</dt><dd>{money(total)}</dd></div><div><dt>Posted by</dt><dd>{cleanOrNull(grnDetail?.postedByName) || "-"}</dd></div>{grnDetail?.reversalReason || grnDetail?.reverseReason ? <div><dt>Reversal reason</dt><dd>{grnDetail.reversalReason || grnDetail.reverseReason}</dd></div> : null}</dl><h3>{grnDetail ? "First GRN lines" : "First ledger lines"}</h3><div className="ir-preview-lines">{previewLines.map((line: any, index) => <div key={index}><strong>{cleanOrNull(line.itemName) || itemName(line)}</strong><span>{cleanOrNull(line.itemCode) || locationName(line)} / {qty(line.quantity ?? (qtyIn(line) || qtyOut(line)))} {cleanOrNull(line.uomCode) || cleanOrNull(line.uomName) || ""}</span></div>)}</div>{doc.sourceId ? <Link className="ir-btn ir-btn-primary ir-preview-open" to={documentPath(companyId, branchId, doc)}>Open full transaction</Link> : null}</div>;
}

function ReportTable({ title, columns, empty, children }: { title: string; columns: string[]; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="ir-report"><h2>{title}</h2><div className="ir-table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{hasRows ? children : <tr><td colSpan={columns.length} className="ir-empty-cell">{empty}</td></tr>}</tbody></table></div></section>;
}

function Metric({ label, value, detail, tone }: { label: string; value: React.ReactNode; detail: string; tone?: "ok" | "warn" }) {
  return <div className={"ir-metric" + (tone ? " ir-metric-" + tone : "")}><span>{label}</span><strong>{value ?? "-"}</strong><small>{detail}</small></div>;
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  return <span className={"ir-badge ir-badge-" + tone}>{children}</span>;
}

function groupDocuments(rows: InventoryLedgerDto[]): DocumentSummary[] {
  const map = new Map<string, DocumentSummary>();
  for (const row of rows) {
    const sourceNo = refNo(row);
    if (!sourceNo || sourceNo === "-") continue;
    const sourceType = sourceTypeOf(row);
    const key = documentKey(row);
    const current = map.get(key) ?? { key, sourceId: sourceIdOf(row), sourceType, sourceNo, postedAtUtc: postedAt(row), itemCount: 0, qtyIn: 0, qtyOut: 0, valueIn: 0, valueOut: 0, firstLines: [], isReversal: reversalOf(row) };
    current.itemCount += 1;
    current.qtyIn += qtyIn(row);
    current.qtyOut += qtyOut(row);
    const value = Math.abs(valueChange(row));
    if (qtyIn(row) > 0) current.valueIn += value;
    if (qtyOut(row) > 0) current.valueOut += value;
    if (!current.postedAtUtc || String(postedAt(row) || "") > String(current.postedAtUtc)) current.postedAtUtc = postedAt(row);
    if (current.firstLines.length < 8) current.firstLines.push(row);
    current.isReversal = current.isReversal || reversalOf(row);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => String(b.postedAtUtc || "").localeCompare(String(a.postedAtUtc || "")));
}

function buildExceptions(state: LoadState): string[] {
  const rows: string[] = [];
  if (state.reconciliation && !state.reconciliation.isBalanced) rows.push("Ledger, FIFO, and stock-balance totals are not reconciled for this branch.");
  if ((state.valuation?.outOfBalanceCount ?? 0) > 0) rows.push(String(state.valuation?.outOfBalanceCount) + " valuation rows are out of balance.");
  for (const row of state.summary) if (Number(row.onHandBase) < 0) rows.push(row.itemName + " has negative stock at " + row.locationName + ".");
  for (const line of state.ledger) if (balanceQty(line) < 0) rows.push(itemName(line) + " went negative after " + refNo(line) + ".");
  return [...new Set(rows)].slice(0, 50);
}

function readFilters(companyId?: string | null, branchId?: string | null): Filters {
  if (!companyId || !branchId) return EMPTY_FILTERS;
  try { return { ...EMPTY_FILTERS, ...JSON.parse(window.sessionStorage.getItem(filterKey(companyId, branchId)) || "{}") }; } catch { return EMPTY_FILTERS; }
}

function filterKey(companyId: string, branchId: string) { return FILTER_KEY_PREFIX + ":" + companyId + ":" + branchId; }
function cleanOrNull(value: string | null | undefined) { const text = String(value ?? "").trim(); return text ? text : null; }
function idOf(row: any) { return cleanOrNull(row.id); }
function sourceIdOf(row: any) { return cleanOrNull(row.sourceId) || cleanOrNull(row.referenceId); }
function sourceTypeOf(row: any) { return cleanOrNull(row.sourceType) || cleanOrNull(row.referenceType) || cleanOrNull(row.movementType) || "Ledger"; }
function movementOf(row: any) { return cleanOrNull(row.movementType) || cleanOrNull(row.referenceType) || "Movement"; }
function refNo(row: any) { return cleanOrNull(row.sourceNo) || cleanOrNull(row.referenceNo) || "-"; }
function postedAt(row: any) { return cleanOrNull(row.postedAtUtc) || cleanOrNull(row.createdAtUtc); }
function itemName(row: any) { return cleanOrNull(row.itemName) || cleanOrNull(row.itemCode) || "Item"; }
function locationName(row: any) { return cleanOrNull(row.locationName) || cleanOrNull(row.locationCode) || "Location"; }
function qtyIn(row: any) { return number(row.qtyInBase); }
function qtyOut(row: any) { return number(row.qtyOutBase); }
function balanceQty(row: any) { return number(row.balanceBase ?? row.runningQtyBase); }
function valueChange(row: any) { return number(row.valueChange ?? row.valueIn ?? row.valueOut); }
function reversalOf(row: any) { return Boolean(row.isReversal); }
function documentKey(row: any) { return sourceTypeOf(row) + ":" + (sourceIdOf(row) || refNo(row)); }
function isGrn(type: string, no: string) { return type.toUpperCase().includes("GRN") || no.toUpperCase().startsWith("GRN"); }
function isSiv(type: string, no: string) { return type.toUpperCase().includes("SIV") || no.toUpperCase().startsWith("SIV"); }
function documentPath(companyId: string, branchId: string, doc: DocumentSummary) { if (isGrn(doc.sourceType, doc.sourceNo)) return "/companies/" + companyId + "/grns/" + doc.sourceId; return "/companies/" + companyId + "/branches/" + branchId + "/siv/" + doc.sourceId + "/details"; }
function toUtcStart(value: string) { return value ? new Date(value + "T00:00:00").toISOString() : null; }
function toUtcExclusiveEnd(value: string) { if (!value) return null; const date = new Date(value + "T00:00:00"); date.setDate(date.getDate() + 1); return date.toISOString(); }
function number(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function qty(value: unknown) { const n = Number(value); return value === null || value === undefined ? "-" : Number.isFinite(n) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(n) : String(value); }
function money(value: unknown) { const n = Number(value); return value === null || value === undefined ? "-" : Number.isFinite(n) ? new Intl.NumberFormat(undefined, { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n) : String(value); }
function int(value: unknown) { const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat().format(n) : "0"; }
function formatDate(value: string | null | undefined) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatTime(value: string | null | undefined) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date); }
function getError(error: unknown) { const anyError = error as { message?: string; response?: { data?: { message?: string; detail?: string; title?: string } } }; return anyError.response?.data?.detail || anyError.response?.data?.message || anyError.response?.data?.title || anyError.message || "Unable to load inventory reports."; }

function grnTotal(grn: GrnDetailDto) { return number(grn.grandTotal ?? grn.totalAmount ?? grn.totalCost) || grn.lines.reduce((sum, line) => sum + number(line.totalAmount ?? line.lineAmount ?? (number(line.quantity) * number(line.unitCost))), 0); }
