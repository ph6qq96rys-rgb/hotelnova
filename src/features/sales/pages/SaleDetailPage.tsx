// src/features/sales/pages/SaleDetailPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";

import { salesApi } from "../api/salesApi";
import type { SaleDto } from "../api/salesTypes";
import { SaleInventoryConsumptionPanel } from "../../pos/components/SaleInventoryConsumptionPanel";

import {
  Alert,
  Button,
  Card,
  InventoryBadge,
  Kpi,
  PaymentStatusBadge,
  SaleStatusBadge,
  dateTime,
  extractApiError,
  money,
} from "../components/pos-ui";

import "../components/pos.css";

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "notFound"; message: string }
  | { status: "error"; message: string };

type SalePaths = {
  dashboard: string;
  register: string;
  saleDetail: (saleId: string) => string;
};

type DocumentTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  paid: number;
  balance: number;
  lineCount: number;
  paymentCount: number;
};

function numberOf(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(2)}%`;
}

function safeText(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function joinBusinessLabel(...parts: Array<unknown>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" - ");
}

function shortReference(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";

  return text ? text.slice(0, 8).toUpperCase() : "";
}

function getSaleValue<T = unknown>(sale: SaleDto, key: string): T | undefined {
  return (sale as any)?.[key] as T | undefined;
}

function buildDocumentTotals(sale: SaleDto | null): DocumentTotals {
  if (!sale) {
    return {
      subtotal: 0,
      discount: 0,
      tax: 0,
      serviceCharge: 0,
      total: 0,
      cogs: 0,
      grossProfit: 0,
      marginPct: 0,
      paid: 0,
      balance: 0,
      lineCount: 0,
      paymentCount: 0,
    };
  }

  const items = sale.saleItems ?? [];
  const payments = sale.payments ?? [];
  const total = numberOf(sale.totalAmount);
  const cogs = numberOf(sale.totalCogs);
  const grossProfit = numberOf(sale.grossProfit ?? total - cogs);
  const paid = payments.reduce((sum, row) => sum + numberOf(row.amount), 0);

  return {
    subtotal: numberOf(getSaleValue(sale, "subTotal") ?? getSaleValue(sale, "subtotal") ?? total),
    discount: numberOf(getSaleValue(sale, "discountAmount")),
    tax: numberOf(getSaleValue(sale, "taxAmount")),
    serviceCharge: numberOf(getSaleValue(sale, "serviceChargeAmount")),
    total,
    cogs,
    grossProfit,
    marginPct: total > 0 ? (grossProfit / total) * 100 : 0,
    paid,
    balance: Math.max(0, total - paid),
    lineCount: items.length,
    paymentCount: payments.length,
  };
}

function documentStatusText(sale: SaleDto): string {
  if (String(sale.status).toLowerCase().includes("cancel")) return "Cancelled";
  if (!sale.isInventoryPosted) return "Inventory Pending";
  return "Posted";
}

function timelineState(active: boolean, warning = false): string {
  if (warning) return "erp-doc-step erp-doc-step--warning";
  return active ? "erp-doc-step erp-doc-step--done" : "erp-doc-step";
}

export default function SaleDetailPage() {
  const nav = useErpNavigate();
  const { saleId } = useParams<{ saleId: string }>();
  const { companyId, branchId } = useAppScope();

  const [sale, setSale] = useState<SaleDto | null>(null);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [busyAction, setBusyAction] = useState<"inventory" | "cancel" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const paths = useMemo<SalePaths>(
    () => ({
      dashboard: "sales",
      register: "sales/list",
      saleDetail: (id: string) => `sales/details/${id}`,
    }),
    []
  );

  const go = useCallback(
    (path: string, replace = false) => {
      nav(path, { replace });
    },
    [nav]
  );

  const normalizedSaleId = saleId?.trim() ?? "";
  const hasCompanyScope = Boolean(companyId);
  const totals = useMemo(() => buildDocumentTotals(sale), [sale]);

  const errorMessage =
    pageState.status === "error" || pageState.status === "notFound"
      ? pageState.message
      : null;

  const load = useCallback(async () => {
    setNotice(null);

    if (!hasCompanyScope || !companyId) {
      setSale(null);
      setPageState({
        status: "error",
        message:
          "Company context is required. Reopen this document from the sales register.",
      });
      return;
    }

    if (!normalizedSaleId) {
      setSale(null);
      setPageState({
        status: "error",
        message: "Sale document reference is missing. Reopen the sale from the register.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    setPageState({ status: "loading" });

    try {
      const response = await salesApi.get(companyId, branchId || "", normalizedSaleId);
      const data = (response as any).data ?? response ?? null;

      if (requestId !== requestIdRef.current) return;

      if (!data) {
        setSale(null);
        setPageState({
          status: "notFound",
          message: "Sales document was not found for the selected company.",
        });
        return;
      }

      setSale(data);
      setPageState({ status: "ready" });
    } catch (error: any) {
      if (requestId !== requestIdRef.current) return;

      setSale(null);

      if (error?.response?.status === 404) {
        setPageState({
          status: "notFound",
          message: "Sales document was not found for the selected company.",
        });
        return;
      }

      setPageState({
        status: "error",
        message: extractApiError(error, "Unable to load the sales document."),
      });
    }
  }, [companyId, branchId, hasCompanyScope, normalizedSaleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryInventoryPosting = useCallback(async () => {
    if (!sale || !companyId) return;

    setBusyAction("inventory");
    setNotice(null);

    try {
      await salesApi.postCogs(companyId, branchId || "", sale.id);
      setNotice("Inventory and COGS posting completed successfully.");
      await load();
    } catch (error) {
      setPageState({
        status: "error",
        message: extractApiError(
          error,
          "Inventory and COGS posting failed. Review recipe setup, stock availability, and branch consumption locations."
        ),
      });
    } finally {
      setBusyAction(null);
    }
  }, [sale, companyId, branchId, load]);

  const cancelSale = useCallback(async () => {
    if (!sale || !companyId) return;

    const confirmed = window.confirm(
      `Cancel sales document ${sale.saleNo}? This action should only be used for approved operational corrections.`
    );

    if (!confirmed) return;

    setBusyAction("cancel");
    setNotice(null);

    try {
      await salesApi.cancel(
        companyId,
        branchId || "",
        sale.id,
        "Cancelled from sales document workspace"
      );
      go(paths.register, true);
    } catch (error) {
      setPageState({
        status: "error",
        message: extractApiError(error, "Unable to cancel the sales document."),
      });
    } finally {
      setBusyAction(null);
    }
  }, [sale, companyId, branchId, paths.register, go]);

  if (!companyId) {
    return (
      <div className="pos-page">
        <style>{css}</style>
        <Alert tone="warning">
          Company context is required before opening a sales document workspace.
        </Alert>
      </div>
    );
  }

  if (pageState.status === "idle" || pageState.status === "loading") {
    return (
      <div className="pos-page">
        <style>{css}</style>
        <DocumentSkeleton />
      </div>
    );
  }

  if (!sale || pageState.status === "error" || pageState.status === "notFound") {
    return (
      <div className="pos-page">
        <style>{css}</style>
        <Card title="Sales Document Not Available" subtitle="The requested sales document could not be opened.">
          <Alert tone="danger">{errorMessage ?? "Sales document could not be loaded."}</Alert>

          <div className="erp-doc-actions" style={{ marginTop: 12 }}>
            <Button onClick={() => go(paths.register)}>Back to Sales Register</Button>
            <Button onClick={() => void load()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="pos-page erp-doc-page">
      <style>{css}</style>

      <DocumentHeader
        sale={sale}
        totals={totals}
        busyAction={busyAction}
        onBack={() => go(paths.register)}
        onRefresh={() => void load()}
        onRetryInventory={() => void retryInventoryPosting()}
        onCancel={() => void cancelSale()}
      />

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <DocumentKpis totals={totals} sale={sale} />

      <div className="erp-doc-layout">
        <div className="erp-doc-main">
          <DocumentTimeline sale={sale} />
          <SaleLinesCard sale={sale} />
          <InventoryAuditCard sale={sale} />
        </div>

        <aside className="erp-doc-side">
          <DocumentSummaryCard sale={sale} totals={totals} />
          <DocumentStatusCard sale={sale} />
          <PaymentsCard sale={sale} totals={totals} />
          <AuditTraceCard sale={sale} />
        </aside>
      </div>
    </div>
  );
}
function InfoField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="erp-info-field">
      <div className="erp-info-label">{label}</div>
      <div className="erp-info-value">{value ?? "-"}</div>
    </div>
  );
}
function DocumentHeader({
  sale,
  totals,
  busyAction,
  onBack,
  onRefresh,
  onRetryInventory,
  onCancel,
}: {
  sale: SaleDto;
  totals: DocumentTotals;
  busyAction: "inventory" | "cancel" | null;
  onBack: () => void;
  onRefresh: () => void;
  onRetryInventory: () => void;
  onCancel: () => void;
}) {
  const customerName = safeText(getSaleValue(sale, "customerName"), "Walk-in Customer");
  const cashierName = safeText(getSaleValue(sale, "cashierName"), "Cashier");
  const terminal = safeText(getSaleValue(sale, "terminal"), "POS Terminal");
  const orderType = safeText(getSaleValue(sale, "orderType"), "Restaurant Sale");

  return (
    <div className="erp-doc-hero">
      <div>
        <p className="erp-doc-kicker">Sales Document Workspace</p>
        <h1>{sale.saleNo}</h1>
        <p className="erp-doc-subtitle">
          {customerName} - {orderType} - {cashierName} - {terminal}
        </p>

        <div className="erp-doc-badges">
          <SaleStatusBadge status={sale.status} />
          <PaymentStatusBadge status={sale.paymentStatus} />
          <InventoryBadge posted={sale.isInventoryPosted} />
          <span className="erp-doc-badge">{dateTime(sale.soldAtUtc)}</span>
        </div>
      </div>

      <div className="erp-doc-hero-right">
        <span className="erp-doc-total-label">Document Total</span>
        <strong>{money(totals.total)}</strong>
        <span className="erp-doc-margin">Gross Margin {percent(totals.marginPct)}</span>

        <div className="erp-doc-actions">
          <Button onClick={onBack}>Back</Button>
          <Button onClick={onRefresh}>Refresh</Button>
          {!sale.isInventoryPosted ? (
            <Button onClick={onRetryInventory} disabled={Boolean(busyAction)}>
              {busyAction === "inventory" ? "Posting..." : "Post Inventory"}
            </Button>
          ) : null}
          <Button variant="danger" onClick={onCancel} disabled={Boolean(busyAction)}>
            {busyAction === "cancel" ? "Cancelling..." : "Cancel Document"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentKpis({ totals, sale }: { totals: DocumentTotals; sale: SaleDto }) {
  return (
    <div className="erp-doc-kpis">
      <Kpi label="Net Sales" value={money(totals.total)} />
      <Kpi label="Tax" value={money(totals.tax)} />
      <Kpi label="Discount" value={money(totals.discount)} />
      <Kpi label="Service Charge" value={money(totals.serviceCharge)} />
      <Kpi label="COGS" value={money(totals.cogs)} />
      <Kpi label="Gross Profit" value={money(totals.grossProfit)} />
      <Kpi label="Margin" value={percent(totals.marginPct)} />
      <Kpi label="Inventory" value={sale.isInventoryPosted ? "Posted" : "Pending"} />
    </div>
  );
}

function DocumentTimeline({ sale }: { sale: SaleDto }) {
  const paid = (sale.payments?.length ?? 0) > 0;
  const cancelled = String(sale.status).toLowerCase().includes("cancel");

  return (
    <Card title="Document Timeline" subtitle="Operational and financial posting lifecycle">
      <div className="erp-doc-timeline">
        <div className={timelineState(true)}>
          <strong>Created</strong>
          <span>{dateTime(sale.soldAtUtc)}</span>
        </div>
        <div className={timelineState(paid)}>
          <strong>Payment Captured</strong>
          <span>{paid ? "Payment records available" : "No payment records found"}</span>
        </div>
        <div className={timelineState(sale.isInventoryPosted, !sale.isInventoryPosted)}>
          <strong>Inventory & COGS</strong>
          <span>{sale.isInventoryPosted ? "Posted successfully" : "Pending posting"}</span>
        </div>
        <div className={timelineState(!cancelled, cancelled)}>
          <strong>Document Status</strong>
          <span>{documentStatusText(sale)}</span>
        </div>
      </div>
    </Card>
  );
}

function SaleLinesCard({ sale }: { sale: SaleDto }) {
  const items = sale.saleItems ?? [];

  return (
    <Card title="Sales Lines" subtitle="Item-level commercial, inventory, and profitability detail">
      <div className="erp-doc-table-wrap">
        <table className="pos-table erp-doc-table">
          <thead>
            <tr>
              <th>Menu Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Unit Price</th>
              <th style={{ textAlign: "right" }}>Line Total</th>
              <th style={{ textAlign: "right" }}>Line COGS</th>
              <th style={{ textAlign: "right" }}>Gross Profit</th>
              <th style={{ textAlign: "right" }}>Margin</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7}>No sales lines were found for this document.</td>
              </tr>
            ) : (
              items.map((item) => {
                const lineTotal = numberOf(item.lineTotal);
                const lineCogs = numberOf(item.lineCogs);
                const lineProfit = lineTotal - lineCogs;
                const lineMargin = lineTotal > 0 ? (lineProfit / lineTotal) * 100 : 0;

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.menuItemName}</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ textAlign: "right" }}>{money(item.unitPrice)}</td>
                    <td style={{ textAlign: "right" }}>{money(lineTotal)}</td>
                    <td style={{ textAlign: "right" }}>{money(lineCogs)}</td>
                    <td style={{ textAlign: "right" }}>{money(lineProfit)}</td>
                    <td style={{ textAlign: "right" }}>{percent(lineMargin)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InventoryAuditCard({ sale }: { sale: SaleDto }) {
  return (
    <Card title="Inventory Consumption Audit" subtitle="FIFO consumption and COGS posting traceability">
      {sale.isInventoryPosted ? (
        <SaleInventoryConsumptionPanel saleId={sale.id} />
      ) : (
        <Alert tone="warning">
          Inventory audit is unavailable until inventory and COGS posting succeeds. Review recipe configuration, FIFO stock, and branch consumption locations before retrying.
        </Alert>
      )}
    </Card>
  );
}

function DocumentSummaryCard({ sale, totals }: { sale: SaleDto; totals: DocumentTotals }) {
  return (
    <Card title="Financial Summary" subtitle="Document settlement overview">
      <div className="erp-doc-summary">
        <Row label="Subtotal" value={money(totals.subtotal)} />
        <Row label="Discount" value={money(totals.discount)} />
        <Row label="Tax" value={money(totals.tax)} />
        <Row label="Service Charge" value={money(totals.serviceCharge)} />
        <Row label="Document Total" value={money(totals.total)} strong />
        <Row label="Amount Paid" value={money(totals.paid)} />
        <Row label="Outstanding Balance" value={money(totals.balance)} warning={totals.balance > 0} />
        <Row label="COGS" value={money(totals.cogs)} />
        <Row label="Gross Profit" value={money(totals.grossProfit)} strong />
        <Row label="Gross Margin" value={percent(totals.marginPct)} />
      </div>
    </Card>
  );
}

function DocumentStatusCard({ sale }: { sale: SaleDto }) {
  return (
    <Card title="Posting Status" subtitle="ERP control status">
      <div className="erp-doc-status-stack">
        <div>
          <span>Sale Status</span>
          <SaleStatusBadge status={sale.status} />
        </div>
        <div>
          <span>Payment Status</span>
          <PaymentStatusBadge status={sale.paymentStatus} />
        </div>
        <div>
          <span>Inventory Status</span>
          <InventoryBadge posted={sale.isInventoryPosted} />
        </div>
      </div>

      <div className="erp-doc-control-note">
        {sale.isInventoryPosted
          ? "Inventory and COGS were posted by the backend workflow."
          : "Inventory posting is pending. Financial margin may be incomplete until COGS is posted."}
      </div>
    </Card>
  );
}

function PaymentsCard({ sale, totals }: { sale: SaleDto; totals: DocumentTotals }) {
  const payments = sale.payments ?? [];

  return (
    <Card title="Payment Settlement" subtitle={`${payments.length} payment record(s)`}>
      <div className="erp-doc-table-wrap">
        <table className="pos-table erp-doc-table erp-doc-compact-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Reference</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>

          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={3}>No payment records found.</td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.method}</td>
                  <td>{payment.referenceCode || "-"}</td>
                  <td style={{ textAlign: "right" }}>{money(payment.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-doc-summary" style={{ marginTop: 10 }}>
        <Row label="Total Paid" value={money(totals.paid)} strong />
        <Row label="Balance" value={money(totals.balance)} warning={totals.balance > 0} />
      </div>
    </Card>
  );
}

function AuditTraceCard({ sale }: { sale: SaleDto }) {
  const branchLabel = safeText(
    joinBusinessLabel(
      getSaleValue(sale, "branchCode"),
      getSaleValue(sale, "branchName")
    )
  );
  const cashierName = safeText(getSaleValue(sale, "cashierName"));
  const terminal = safeText(
    getSaleValue(sale, "terminal") ??
      joinBusinessLabel(getSaleValue(sale, "storeCode"), getSaleValue(sale, "storeName"))
  );
  const sessionLabel = safeText(
    getSaleValue(sale, "sessionLabel") ??
      shortReference(getSaleValue(sale, "posSessionId"))
  );
  const documentType = safeText(
    getSaleValue(sale, "documentType") ??
      getSaleValue(sale, "sourceName"),
    "Sales Document"
  );
  const externalReference = safeText(getSaleValue(sale, "externalReferenceNo"));

  return (
    <Card title="Audit Information" subtitle="Operational traceability">
      <div className="erp-doc-audit-grid">
        <InfoField label="Branch" value={branchLabel} />
        <InfoField label="Cashier" value={cashierName} />
        <InfoField label="Terminal" value={terminal} />
        <InfoField label="Session" value={sessionLabel} />
        <InfoField label="Document Type" value={documentType} />
        <InfoField label="Document No" value={sale.saleNo} />
        <InfoField label="Sold At" value={dateTime(sale.soldAtUtc)} />
        <InfoField label="Reference" value={externalReference} />
      </div>
    </Card>
  );
}

function AuditCard({ sale }: { sale: SaleDto }) {
  const cashierName = safeText(getSaleValue(sale, "cashierName"), "-");
  const terminal = safeText(getSaleValue(sale, "terminal"), "-");
  const sessionNo = safeText(getSaleValue(sale, "sessionNo"), "-");
  const branchName = safeText(getSaleValue(sale, "branchName"), "-");

  return (
    <Card title="Audit Information" subtitle="Operational traceability">
      <div className="erp-doc-audit-grid">
        <InfoField label="Branch" value={branchName} />
        <InfoField label="Cashier" value={cashierName} />
        <InfoField label="Terminal" value={terminal} />
        <InfoField label="Session" value={sessionNo} />
        <InfoField label="Sold At" value={dateTime(sale.soldAtUtc)} />
        <InfoField label="Document No" value={sale.saleNo} />
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  warning,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`erp-doc-summary-row ${strong ? "erp-doc-summary-row--strong" : ""} ${warning ? "erp-doc-summary-row--warning" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="erp-doc-skeleton">
      <div className="erp-doc-skeleton-hero" />
      <div className="erp-doc-skeleton-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} />
        ))}
      </div>
      <Alert>Loading sales document workspace...</Alert>
    </div>
  );
}

const css = `
.erp-doc-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.erp-doc-hero {
  border: 1px solid #dbe3ef;
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.18), transparent 36%),
    linear-gradient(135deg, #0f172a 0%, #111827 48%, #1f2937 100%);
  color: #fff;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.18);
}

.erp-doc-kicker {
  margin: 0 0 6px;
  color: #facc15;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.erp-doc-hero h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1;
  font-weight: 950;
  letter-spacing: -0.04em;
}

.erp-doc-subtitle {
  margin: 10px 0 0;
  color: #cbd5e1;
  line-height: 1.5;
}

.erp-doc-badges,
.erp-doc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.erp-doc-badges {
  margin-top: 14px;
}

.erp-doc-badge {
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(255,255,255,.1);
  color: #fff;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 800;
}

.erp-doc-hero-right {
  min-width: 310px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.08);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.erp-doc-total-label,
.erp-doc-margin {
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 800;
}

.erp-doc-hero-right strong {
  font-size: 30px;
  line-height: 1;
}

.erp-doc-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
}

.erp-doc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 14px;
  align-items: start;
}

.erp-doc-main,
.erp-doc-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.erp-doc-timeline {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.erp-doc-step {
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.erp-doc-step strong {
  color: #0f172a;
}

.erp-doc-step span {
  color: #64748b;
  font-size: 12px;
}

.erp-doc-step--done {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.erp-doc-step--warning {
  border-color: #fde68a;
  background: #fffbeb;
}

.erp-doc-table-wrap {
  overflow-x: auto;
}

.erp-doc-table th,
.erp-doc-table td {
  white-space: nowrap;
}

.erp-doc-compact-table th,
.erp-doc-compact-table td {
  font-size: 12px;
}

.erp-doc-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.erp-doc-summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #eef2f7;
  padding-bottom: 8px;
  color: #64748b;
}

.erp-doc-summary-row strong {
  color: #0f172a;
}

.erp-doc-summary-row--strong {
  color: #0f172a;
  font-weight: 900;
}

.erp-doc-summary-row--warning strong {
  color: #b45309;
}

.erp-doc-status-stack {
  display: grid;
  gap: 10px;
}

.erp-doc-status-stack > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.erp-doc-status-stack span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.erp-doc-control-note {
  margin-top: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  color: #475569;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.erp-doc-audit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.erp-doc-skeleton {
  display: grid;
  gap: 14px;
}

.erp-doc-skeleton-hero,
.erp-doc-skeleton-grid > div {
  border-radius: 18px;
  background: linear-gradient(90deg, #f1f5f9, #fff, #f1f5f9);
  animation: erpDocPulse 1.2s ease-in-out infinite;
}

.erp-doc-skeleton-hero {
  height: 190px;
}

.erp-doc-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.erp-doc-skeleton-grid > div {
  height: 86px;
}

@keyframes erpDocPulse {
  0%, 100% { opacity: .65; }
  50% { opacity: 1; }
}

@media (max-width: 1180px) {
  .erp-doc-layout {
    grid-template-columns: 1fr;
  }

  .erp-doc-hero {
    flex-direction: column;
  }

  .erp-doc-hero-right {
    width: 100%;
    align-items: flex-start;
    min-width: 0;
  }
}

@media (max-width: 840px) {
  .erp-doc-kpis,
  .erp-doc-timeline,
  .erp-doc-skeleton-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .erp-doc-kpis,
  .erp-doc-timeline,
  .erp-doc-audit-grid,
  .erp-doc-skeleton-grid {
    grid-template-columns: 1fr;
  }

  .erp-doc-hero {
    padding: 18px;
  }
}
`;
