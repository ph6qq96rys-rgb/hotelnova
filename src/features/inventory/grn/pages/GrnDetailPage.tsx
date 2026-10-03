import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { useI18n } from "../../../../i18n";
import { formatCurrency } from "../../../../shared/currency/currencyFormat";
import { useCompanyCurrency } from "../../../../shared/currency/useCompanyCurrency";
import { grnApi, type GrnScope } from "../api/grnApi";
import GrnReversalModal from "../components/GrnReverseModal";
import type { GrnDetailDto, GrnLineDto } from "../types/grn.types";
import {
  getGrnLineAmount,
  getGrnLineCount,
  getGrnLineTotal,
  getGrnLocationName,
  getGrnNumber,
  getGrnReceiptDate,
  getGrnTotal,
} from "../helpers/grn.formatters";
import {
  formatGrnStatusLabel,
  normalizeGrnStatus,
  type GrnStatus,
} from "../helpers/grn.status";

import "../styles/GrnPages.erp.css";

type TabKey = "items" | "inventory" | "audit";
type ReversalMode = "request" | "approval";

type RouteParams = {
  companyId?: string;
  branchId?: string;
  grnId?: string;
  id?: string;
};

type ApiErrorPayload = {
  title?: string;
  detail?: string;
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
};

type GrnLineView = GrnLineDto & {
  qty?: number | null;
};

type GrnDetailView = GrnDetailDto & {
  id: string;
  companyId: string;
  status: GrnStatus;
  lines: GrnLineView[];
  branchName?: string | null;
  postedByName?: string | null;
  createdByName?: string | null;
  reversalReason?: string | null;
};

const QTY_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
});

function cleanOptional(value?: string | null): string | undefined {
  const cleaned = String(value ?? "").trim();
  return cleaned || undefined;
}

function toViewModel(dto: GrnDetailDto): GrnDetailView {
  return {
    ...dto,
    id: dto.id,
    companyId: dto.companyId ?? "",
    status: normalizeGrnStatus(dto.status),
    lines: Array.isArray(dto.lines) ? dto.lines : [],
  };
}

function getApiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: string | ApiErrorPayload };
    message?: string;
  };

  const data = err.response?.data;

  if (typeof data === "string") return data.trim() || fallback;

  if (data && typeof data === "object") {
    if (data.errors) {
      return Object.entries(data.errors)
        .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : value}`)
        .join("\n");
    }

    return data.detail ?? data.message ?? data.error ?? data.title ?? err.message ?? fallback;
  }

  return err.message ?? fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatQty(value?: number | null): string {
  return QTY_FORMATTER.format(Number(value ?? 0));
}

function formatMoney(value?: number | null, currencyCode?: string | null): string {
  return formatCurrency(value, currencyCode);
}

function getWarehouseLabel(grn: GrnDetailDto & { branchName?: string | null }, tx: (text: string) => string = (text) => text): string {
  const warehouse = getGrnLocationName(grn) || tx("Warehouse not recorded");
  return grn.branchName ? `${grn.branchName} - ${warehouse}` : warehouse;
}

function getLineQty(line: GrnLineView): number {
  return Number(line.quantity ?? line.qty ?? 0);
}

function statusClass(status: GrnStatus): string {
  return `erp-grn-status erp-grn-status--${String(status).toLowerCase()}`;
}

function buildGrnPath(companyId: string, grnId?: string, suffix = ""): string {
  if (!grnId) return `/companies/${companyId}/grns`;
  return `/companies/${companyId}/grns/${grnId}${suffix}`;
}

function isReversalRequested(status: string): boolean {
  const normalized = status.replace(/[_\s-]/g, "").toUpperCase();
  return normalized === "REVERSALREQUESTED";
}

function isCarcassLine(line: GrnLineView): boolean {
  const text = `${line.itemCode ?? ""} ${line.itemName ?? ""} ${line.notes ?? ""}`.toLowerCase();
  return text.includes("carcass") || text.includes("carcase") || text.includes("beef side") || text.includes("half side");
}

function buildButcheryFromGrnPath(companyId: string, grnId: string): string {
  const params = new URLSearchParams({ source: "grn", grnId });
  return `/companies/${companyId}/eventmanagment/butchery?${params.toString()}`;
}

export default function GrnDetailPage() {
  const navigate = useNavigate();
  const params = useParams<RouteParams>();
  const { companyId: scopeCompanyId, companyName } = useAppScope();
  const { tx } = useI18n();
  const currencyCode = useCompanyCurrency();

  const companyId = cleanOptional(params.companyId) ?? cleanOptional(scopeCompanyId) ?? "";
  const grnId = cleanOptional(params.grnId) ?? cleanOptional(params.id) ?? "";

  const scope = useMemo<GrnScope | null>(() => {
    if (!companyId) return null;
    return { companyId };
  }, [companyId]);

  const [doc, setDoc] = useState<GrnDetailView | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("items");
  const [reverseOpen, setReverseOpen] = useState(false);

  const load = useCallback(async () => {
    if (!scope || !grnId) {
      setDoc(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const dto = await grnApi.getById(scope, grnId);
      setDoc(toViewModel(dto));
    } catch (err) {
      setDoc(null);
      setError(getApiError(err, tx("Unable to load goods receipt.")));
    } finally {
      setLoading(false);
    }
  }, [grnId, scope, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!doc) return;

    document.title = `${getGrnNumber(doc)} - ${companyName || doc.supplierName || "Goods Receipt"}`;
  }, [companyName, doc]);

  const lines = doc?.lines ?? [];
  const status = doc?.status ?? "DRAFT";
  const statusText = String(status).toUpperCase();

  const lineCount = doc ? getGrnLineCount(doc) : lines.length;
  const totalValue = doc ? getGrnTotal(doc) : 0;
  const printGeneratedAt = useMemo(
    () => formatDateTime(new Date().toISOString()),
    [],
  );

  const totalQty = useMemo(
    () => lines.reduce((sum, line) => sum + getLineQty(line), 0),
    [lines],
  );

  const canEdit = statusText === "DRAFT";
  const canPost = statusText === "DRAFT";
  const canRequestReversal = statusText === "POSTED";
  const canApproveRejectReversal = isReversalRequested(statusText);
  const carcassLines = useMemo(() => lines.filter(isCarcassLine), [lines]);
  const carcassQty = useMemo(() => carcassLines.reduce((sum, line) => sum + getLineQty(line), 0), [carcassLines]);
  const canCreateButcheryYield = !import.meta.env.PROD && statusText === "POSTED" && carcassLines.length > 0;

  const reversalMode: ReversalMode = canApproveRejectReversal ? "approval" : "request";

  const postReceipt = useCallback(async () => {
    if (!scope || !doc?.id) return;

    setPosting(true);
    setError("");

    try {
      await grnApi.postDraft(scope, doc.id);
      await load();
    } catch (err) {
      setError(getApiError(err, tx("Unable to post goods receipt.")));
    } finally {
      setPosting(false);
    }
  }, [doc?.id, load, scope, tx]);

  if (!companyId) {
    return (
      <main className="page erp-grn-page">
        <section className="erp-empty-state">
          <h2>{tx("Select a company")}</h2>
          <p>{tx("Select a company workspace before opening goods receipts.")}</p>
        </section>
      </main>
    );
  }

  if (!grnId) {
    return (
      <main className="page erp-grn-page">
        <section className="erp-empty-state">
          <h2>{tx("Goods receipt reference missing")}</h2>
          <p>{tx("The page URL does not include a valid GRN reference.")}</p>
          <button type="button" className="btn" onClick={() => navigate(buildGrnPath(companyId))}>
            {tx("Open Goods Receipts")}
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page erp-grn-page">
        <section className="erp-inline-state">{tx("Loading goods receipt...")}</section>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="page erp-grn-page">
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <section className="erp-empty-state">
          <h2>{tx("Goods receipt not found")}</h2>
          <p>{tx("Open the receipt list and try again.")}</p>
          <button type="button" className="btn" onClick={() => navigate(buildGrnPath(companyId))}>
            {tx("Open Goods Receipts")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page erp-grn-page">
      <section className="erp-grn-print-header" aria-label={tx("Printable goods receipt header")}>
        <div>
          <div className="erp-grn-print-company">{companyName || tx("Company")}</div>
          <div className="erp-grn-print-subtitle">
            {doc.branchName || tx("Branch")} - {getWarehouseLabel(doc, tx)}
          </div>
        </div>
        <div className="erp-grn-print-meta">
          <span>{tx("Goods Receipt")}</span>
          <strong>{getGrnNumber(doc)}</strong>
          <span>{tx(formatGrnStatusLabel(status))}</span>
        </div>
      </section>

      <section className="erp-grn-print-strip" aria-label={tx("Printable receipt summary")}>
        <Info label={tx("Receipt Date")} value={formatDate(getGrnReceiptDate(doc))} />
        <Info label={tx("Supplier")} value={doc.supplierName || tx("Supplier not recorded")} />
        <Info label={tx("Items")} value={String(lineCount)} />
        <Info label={tx("Total Quantity")} value={formatQty(totalQty)} />
        <Info label={tx("Inventory Value")} value={formatMoney(totalValue, currencyCode)} />
      </section>

      <header className="erp-grn-detail-hero">
        <div>
          <button
            type="button"
            className="erp-back-link"
            onClick={() => navigate(buildGrnPath(companyId))}
          >
            {`- ${tx("Goods Receipts")}`}
          </button>
          <div className="erp-kicker">{tx("Goods Receipt")}</div>
          <h1>{getGrnNumber(doc)}</h1>
          <p>
            {doc.supplierName || tx("Supplier not recorded")} - {getWarehouseLabel(doc, tx)}
          </p>
        </div>

        <div className="erp-command-bar">
          <span className={statusClass(status)}>{tx(formatGrnStatusLabel(status))}</span>

          {canEdit ? (
            <button
              type="button"
              className="btn"
              onClick={() => navigate(buildGrnPath(companyId, doc.id, "/edit"))}
            >
              {tx("Edit")}
            </button>
          ) : null}

          {canPost ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={posting}
              onClick={() => void postReceipt()}
            >
              {posting ? tx("Posting...") : tx("Post Receipt")}
            </button>
          ) : null}

          {canRequestReversal || canApproveRejectReversal ? (
            <button
              type="button"
              className={canApproveRejectReversal ? "btn btn-primary" : "btn btn-danger"}
              onClick={() => setReverseOpen(true)}
            >
              {canApproveRejectReversal ? tx("Approve / Reject Reversal") : tx("Request Reversal")}
            </button>
          ) : null}

          <button type="button" className="btn" onClick={() => window.print()}>
            {tx("Print")}
          </button>
        </div>
      </header>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="erp-grn-summary-grid">
        <Summary label={tx("Receipt Date")} value={formatDate(getGrnReceiptDate(doc))} />
        <Summary label={tx("Warehouse")} value={getWarehouseLabel(doc, tx)} />
        <Summary label={tx("Items")} value={String(lineCount)} />
        <Summary label={tx("Total Quantity")} value={formatQty(totalQty)} />
        <Summary label={tx("Inventory Value")} value={formatMoney(totalValue, currencyCode)} />
      </section>

      {canCreateButcheryYield ? (
        <section className="erp-grn-butchery-handoff" aria-label={tx("Butchery yield handoff")}>
          <div>
            <span>{tx("Butchery ready")}</span>
            <strong>{tx("Create yield sheet from this carcass receipt")}</strong>
            <p>
              {tx("This posted GRN contains carcass stock. Start the butchery breakdown from the received batch instead of re-entering supplier, weight, cost, and warehouse details.")}
            </p>
          </div>
          <div className="erp-grn-butchery-handoff__facts">
            <span>{tx("Carcass lines")}</span><strong>{String(carcassLines.length)}</strong>
            <span>{tx("Received weight")}</span><strong>{formatQty(carcassQty)} {carcassLines[0]?.uomCode || carcassLines[0]?.uomName || ""}</strong>
            <span>{tx("Source GRN")}</span><strong>{getGrnNumber(doc)}</strong>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(buildButcheryFromGrnPath(companyId, doc.id))}
          >
            {tx("Create Butchery Yield Sheet")}
          </button>
        </section>
      ) : null}
      <div className="erp-grn-detail-layout">
        <section className="card erp-grn-card">
          <nav className="erp-tabs" aria-label={tx("Goods receipt detail tabs")}>
            {TAB_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={tab === option.key ? "active" : ""}
                onClick={() => setTab(option.key)}
              >
                {option.key === "items" ? `${tx("Items")} (${lineCount})` : tx(option.label)}
              </button>
            ))}
          </nav>

          {tab === "items" ? <ItemsTable lines={lines} currencyCode={currencyCode} /> : null}
          {tab === "inventory" ? (
            <InventoryImpact doc={doc} lines={lines} totalValue={totalValue} currencyCode={currencyCode} />
          ) : null}
          {tab === "audit" ? <AuditTrail doc={doc} /> : null}
        </section>

        <aside className="erp-side-panel">
          <div className="card">
            <h3>{tx("Document Summary")}</h3>
            <Info label={tx("Status")} value={tx(formatGrnStatusLabel(status))} />
            <Info label={tx("Supplier")} value={doc.supplierName || "-"} />
            <Info label={tx("Branch")} value={doc.branchName || "-"} />
            <Info label={tx("Warehouse")} value={getGrnLocationName(doc) || "-"} />
            <Info label={tx("Received")} value={formatDate(getGrnReceiptDate(doc))} />
            <Info label={tx("Value")} value={formatMoney(totalValue, currencyCode)} />
          </div>

          <div className="card">
            <h3>{tx("Workflow")}</h3>
            <Workflow status={status} />
          </div>
        </aside>
      </div>

      <GrnReversalModal
        open={reverseOpen}
        mode={reversalMode}
        companyId={companyId}
        grn={{
          id: doc.id,
          grnNumber: getGrnNumber(doc),
          supplierName: doc.supplierName,
          receivingLocationName: getGrnLocationName(doc),
          receivedDate: getGrnReceiptDate(doc),
          status: doc.status,
          reversalReason: doc.reversalReason,
          reverseReason: doc.reverseReason,
        }}
        onClose={() => setReverseOpen(false)}
        onCompleted={async () => {
          setReverseOpen(false);
          await load();
        }}
      />

      <footer className="erp-grn-print-footer">
        <div>
          <span>{tx("Prepared by")}</span>
          <strong>{doc.createdByName || "-"}</strong>
        </div>
        <div>
          <span>{tx("Posted by")}</span>
          <strong>{doc.postedByName || "-"}</strong>
        </div>
        <div>
          <span>{tx("Printed")}</span>
          <strong>{printGeneratedAt}</strong>
        </div>
        <div className="erp-grn-print-signature">
          <span>{tx("Received / Verified by")}</span>
        </div>
      </footer>
    </main>
  );
}

const TAB_OPTIONS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "items", label: "Items" },
  { key: "inventory", label: "Inventory Impact" },
  { key: "audit", label: "Audit Trail" },
];

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="erp-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="erp-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ItemsTable({ lines, currencyCode }: { lines: GrnLineView[]; currencyCode: string }) {
  const { tx } = useI18n();
  return (
    <div className="erp-table-wrap">
      <table className="table erp-grn-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{tx("Item")}</th>
            <th className="num">{tx("Received Qty")}</th>
            <th>{tx("UOM")}</th>
            <th className="num">{tx("Unit Cost")}</th>
            <th className="num">{tx("Line Value")}</th>
            <th>{tx("Batch")}</th>
            <th>{tx("Expiry")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="erp-empty-row">
                {tx("No items on this goods receipt.")}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => {
              const qty = getLineQty(line);
              const lineValue = getGrnLineAmount(line);

              return (
                <tr key={line.id || index}>
                  <td>{String(line.lineNo ?? index + 1).padStart(2, "0")}</td>
                  <td>
                    <strong>{line.itemName || tx("Unknown item")}</strong>
                    <small>{line.itemCode || ""}</small>
                  </td>
                  <td className="num">{formatQty(qty)}</td>
                  <td>{line.uomCode || line.uomName || "-"}</td>
                  <td className="num">{formatMoney(line.unitCost, currencyCode)}</td>
                  <td className="num">{formatMoney(lineValue, currencyCode)}</td>
                  <td>{line.batchNo || "-"}</td>
                  <td>{formatDate(line.expiryDate)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function InventoryImpact({
  doc,
  lines,
  totalValue,
  currencyCode,
}: {
  doc: GrnDetailView;
  lines: GrnLineView[];
  totalValue: number;
  currencyCode: string;
}) {
  const { tx } = useI18n();
  return (
    <div className="erp-impact-grid">
      <Summary label={tx("FIFO Lots Created")} value={String(lines.length)} />
      <Summary label={tx("Warehouse")} value={getWarehouseLabel(doc, tx)} />
      <Summary label={tx("Inventory Added")} value={formatMoney(totalValue, currencyCode)} />
      <Summary label={tx("Posting Rule")} value={tx("Receipt increases stock")} />
    </div>
  );
}

function AuditTrail({ doc }: { doc: GrnDetailView }) {
  const { tx } = useI18n();
  const events = [
    {
      label: tx("Created"),
      at: doc.createdAt ?? doc.createdAtUtc,
      by: doc.createdByName,
    },
    {
      label: tx("Posted"),
      at: doc.postedAt ?? doc.postedAtUtc,
      by: doc.postedByName,
    },
    {
      label: tx("Reversal Requested"),
      at: doc.reversedAt ?? doc.reversedAtUtc,
      by: doc.reversedByUser,
      note: doc.reversalReason ?? doc.reverseReason,
    },
    {
      label: tx("Reversed"),
      at: doc.reversedAt ?? doc.reversedAtUtc,
      by: doc.reversedByUser,
      note: doc.reversalReason ?? doc.reverseReason,
    },
  ].filter((event) => Boolean(event.at));

  if (events.length === 0) {
    return <div className="erp-empty-row">{tx("No audit events recorded.")}</div>;
  }

  return (
    <div className="erp-audit-list">
      {events.map((event, index) => (
        <div className="erp-audit-item" key={`${event.label}-${event.at}`}>
          <span>{index + 1}</span>
          <div>
            <strong>{event.label}</strong>
            <p>
              {formatDateTime(event.at)}
              {event.by ? ` - ${event.by}` : ""}
            </p>
            {event.note ? <p>{event.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Workflow({ status }: { status: GrnStatus }) {
  const { tx } = useI18n();
  const statusText = String(status).replace(/[_\s-]/g, "").toUpperCase();

  const steps =
    statusText === "REVERSALREQUESTED"
      ? ["DRAFT", "POSTED", "REVERSALREQUESTED", "REVERSED"]
      : ["DRAFT", "POSTED", "REVERSED"];

  const currentIndex = Math.max(
    steps.findIndex((step) => step === statusText),
    0,
  );

  return (
    <div className="erp-workflow">
      {steps.map((step, index) => (
        <div key={step} className={index <= currentIndex ? "done" : ""}>
          <span />
          {tx(formatGrnStatusLabel(step as GrnStatus))}
        </div>
      ))}
    </div>
  );
}

