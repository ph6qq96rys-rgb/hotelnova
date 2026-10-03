import { useCallback, useRef, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { useI18n } from "../../../../i18n";
import { grnApi } from "../api/grnApi";
import type { GrnDetailDto, GrnLineDto, GrnListDto } from "../types/grn.types";
import {
  formatDate,
  formatGrnStatusLabel,
  formatMoney,
  getGrnBranchWarehouse,
  getGrnLineCount,
  getGrnNumber,
  getGrnReceiptDate,
  getGrnTotal,
  getGrnWorkflowText,
  normalizeGrnStatus,
} from "../helpers/grn.index";

const grnRegisterAmharicPhrases: Record<string, string> = {};

function grnRegisterText(language: string, text: string): string {
  return language === "am" ? grnRegisterAmharicPhrases[text] ?? text : text;
}

type Props = {
  rows: GrnListDto[];
  loading: boolean;
  onOpen: (row: GrnListDto) => void;
  currencyCode?: string | null;
};

type GrnRowMetrics = {
  grnNumber: string;
  warehouse: string;
  receiptDate: string;
  lineCount: number;
  value: number;
  status: ReturnType<typeof normalizeGrnStatus>;
  statusLabel: string;
  workflow: string;
};

type PreviewState = {
  rowId: string;
  detail: GrnDetailDto | null;
  loading: boolean;
  error: string | null;
};

function getGrnRowMetrics(row: GrnListDto): GrnRowMetrics {
  const status = normalizeGrnStatus(row.status);

  return {
    grnNumber: getGrnNumber(row),
    warehouse: getGrnBranchWarehouse(row),
    receiptDate: formatDate(getGrnReceiptDate(row)),
    lineCount: getGrnLineCount(row),
    value: getGrnTotal(row),
    status,
    statusLabel: formatGrnStatusLabel(status),
    workflow: getGrnWorkflowText(row),
  };
}

function rowStatusClass(status: GrnRowMetrics["status"]): string {
  switch (status) {
    case "DRAFT":
      return "erp-grn-row erp-grn-row--draft";
    case "POSTED":
      return "erp-grn-row erp-grn-row--posted";
    case "REVERSED":
      return "erp-grn-row erp-grn-row--reversed";
    case "CANCELLED":
      return "erp-grn-row erp-grn-row--cancelled";
    default:
      return "erp-grn-row";
  }
}

function statusBadgeClass(status: GrnRowMetrics["status"]): string {
  switch (status) {
    case "DRAFT":
      return "badge badge-secondary";
    case "SUBMITTED":
      return "badge badge-info";
    case "APPROVED":
      return "badge badge-primary";
    case "POSTED":
      return "badge badge-success";
    case "REVERSED":
      return "badge badge-warning";
    case "CANCELLED":
      return "badge badge-danger";
    default:
      return "badge";
  }
}

export default function GrnRegisterTable({ rows, loading, onOpen, currencyCode }: Props) {
  const { language } = useI18n();
  const { companyId } = useAppScope();
  const tx = (text: string) => grnRegisterText(language, text);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const requestId = useRef(0);

  const clearTimers = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const openPreview = useCallback((row: GrnListDto) => {
    if (!companyId || !row.id) return;

    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (preview?.rowId === row.id && preview.detail) return;

    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      const currentRequest = ++requestId.current;
      setPreview({ rowId: row.id, detail: null, loading: true, error: null });

      grnApi.getById({ companyId }, row.id)
        .then((detail) => {
          if (requestId.current !== currentRequest) return;
          setPreview({ rowId: row.id, detail, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (requestId.current !== currentRequest) return;
          setPreview({ rowId: row.id, detail: null, loading: false, error: getPreviewError(error) });
        });
    }, 180);
  }, [companyId, preview?.detail, preview?.rowId]);

  const closePreview = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setPreview(null), 180);
  }, []);

  if (loading) {
    return <GrnRegisterSkeleton tx={tx} />;
  }

  return (
    <div className="erp-table-wrap">
      <table className="table erp-grn-table">
        <thead>
          <tr>
            <th>GRN</th>
            <th>{tx("Supplier")}</th>
            <th>{tx("Warehouse")}</th>
            <th>{tx("Received")}</th>
            <th className="num">{tx("Items")}</th>
            <th className="num">{tx("Value")}</th>
            <th>{tx("Status")}</th>
            <th>{tx("Workflow")}</th>
            <th className="actions">{tx("Actions")}</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="erp-empty-row">
                {tx("No goods receipts found.")}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const metrics = getGrnRowMetrics(row);
              const isPreviewOpen = preview?.rowId === row.id;

              return (
                <tr
                  key={row.id}
                  className={rowStatusClass(metrics.status)}
                  onDoubleClick={() => onOpen(row)}
                >
                  <td className="erp-grn-reference-cell">
                    <button
                      type="button"
                      className="erp-link-button"
                      onClick={() => onOpen(row)}
                      onMouseEnter={() => openPreview(row)}
                      onMouseLeave={closePreview}
                      onFocus={() => openPreview(row)}
                      onBlur={closePreview}
                      aria-describedby={isPreviewOpen ? `grn-preview-${row.id}` : undefined}
                    >
                      {metrics.grnNumber}
                    </button>
                    {isPreviewOpen ? (
                      <GrnItemsPreview
                        id={`grn-preview-${row.id}`}
                        preview={preview}
                        fallback={row}
                        currencyCode={currencyCode}
                        onMouseEnter={() => {
                          if (closeTimer.current) window.clearTimeout(closeTimer.current);
                        }}
                        onMouseLeave={closePreview}
                      />
                    ) : null}
                  </td>
                  <td>{row.supplierName || tx("Supplier not recorded")}</td>
                  <td>{metrics.warehouse}</td>
                  <td>{metrics.receiptDate}</td>
                  <td className="num">{metrics.lineCount || "-"}</td>
                  <td className="num">{formatMoney(metrics.value, currencyCode ?? undefined)}</td>
                  <td>
                    <span className={statusBadgeClass(metrics.status)}>
                      {metrics.statusLabel}
                    </span>
                  </td>
                  <td>{metrics.workflow}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onOpen(row)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function GrnItemsPreview({
  id,
  preview,
  fallback,
  currencyCode,
  onMouseEnter,
  onMouseLeave,
}: {
  id: string;
  preview: PreviewState;
  fallback: GrnListDto;
  currencyCode?: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const detail = preview.detail;
  const lines = detail?.lines ?? [];
  const totalQty = lines.reduce((sum, line) => sum + number(line.quantity), 0);
  const totalValue = detail ? getGrnTotal(detail) : getGrnTotal(fallback);

  return (
    <div
      id={id}
      className="erp-grn-preview-popover"
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="erp-grn-preview-head">
        <div>
          <span>GRN item details</span>
          <strong>{detail?.grnNumber || detail?.grnNo || getGrnNumber(fallback)}</strong>
        </div>
        <small>{preview.loading ? "Loading..." : `${lines.length || getGrnLineCount(fallback)} item${(lines.length || getGrnLineCount(fallback)) === 1 ? "" : "s"}`}</small>
      </div>

      {preview.error ? <div className="erp-grn-preview-state">{preview.error}</div> : null}
      {!preview.error && preview.loading ? <div className="erp-grn-preview-state">Loading item lines...</div> : null}

      {!preview.loading && !preview.error ? (
        <>
          <div className="erp-grn-preview-summary">
            <span>Supplier</span><strong>{detail?.supplierName || fallback.supplierName || "-"}</strong>
            <span>Total qty</span><strong>{totalQty ? formatQty(totalQty) : "-"}</strong>
            <span>Total value</span><strong>{formatMoney(totalValue, currencyCode ?? undefined)}</strong>
          </div>

          <div className="erp-grn-preview-lines">
            {lines.length === 0 ? (
              <div className="erp-grn-preview-state">No item lines returned for this receipt.</div>
            ) : (
              lines.slice(0, 8).map((line) => <PreviewLine key={line.id} line={line} currencyCode={currencyCode} />)
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function PreviewLine({ line, currencyCode }: { line: GrnLineDto; currencyCode?: string | null }) {
  const lineValue = number(line.totalAmount ?? line.lineAmount ?? number(line.quantity) * number(line.unitCost));

  return (
    <div className="erp-grn-preview-line">
      <div>
        <strong>{line.itemName || line.itemCode || "Inventory item"}</strong>
        <span>{[line.itemCode, line.batchNo ? `Batch ${line.batchNo}` : null, line.expiryDate ? `Exp ${formatDate(line.expiryDate)}` : null].filter(Boolean).join(" / ")}</span>
      </div>
      <div className="erp-grn-preview-line__qty">
        <strong>{formatQty(line.quantity)} {line.uomCode || line.uomName || ""}</strong>
        <span>{formatMoney(line.unitCost, currencyCode ?? undefined)} / {formatMoney(lineValue, currencyCode ?? undefined)}</span>
      </div>
    </div>
  );
}

function GrnRegisterSkeleton({ tx }: { tx: (text: string) => string }) {
  return (
    <div className="erp-table-wrap">
      <table className="table erp-grn-table">
        <thead>
          <tr>
            <th>GRN</th>
            <th>{tx("Supplier")}</th>
            <th>{tx("Warehouse")}</th>
            <th>{tx("Received")}</th>
            <th className="num">{tx("Items")}</th>
            <th className="num">{tx("Value")}</th>
            <th>{tx("Status")}</th>
            <th>{tx("Workflow")}</th>
            <th className="actions">{tx("Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, index) => (
            <tr key={index}>
              <td><span className="erp-skeleton erp-skeleton--short" /></td>
              <td><span className="erp-skeleton" /></td>
              <td><span className="erp-skeleton" /></td>
              <td><span className="erp-skeleton erp-skeleton--short" /></td>
              <td className="num"><span className="erp-skeleton erp-skeleton--tiny" /></td>
              <td className="num"><span className="erp-skeleton erp-skeleton--short" /></td>
              <td><span className="erp-skeleton erp-skeleton--badge" /></td>
              <td><span className="erp-skeleton" /></td>
              <td className="actions"><span className="erp-skeleton erp-skeleton--button" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function number(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatQty(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(numeric)
    : String(value ?? "-");
}

function getPreviewError(error: unknown): string {
  const apiError = error as { message?: string; response?: { data?: { detail?: string; message?: string; title?: string } } };
  return apiError.response?.data?.detail
    ?? apiError.response?.data?.message
    ?? apiError.response?.data?.title
    ?? apiError.message
    ?? "Unable to load GRN item details.";
}
