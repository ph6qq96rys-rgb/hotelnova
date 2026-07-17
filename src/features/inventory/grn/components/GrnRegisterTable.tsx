import type { GrnListDto } from "../types/grn.types";
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

type Props = {
  rows: GrnListDto[];
  loading: boolean;
  onOpen: (row: GrnListDto) => void;
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

export default function GrnRegisterTable({ rows, loading, onOpen }: Props) {
  if (loading) {
    return <GrnRegisterSkeleton />;
  }

  return (
    <div className="erp-table-wrap">
      <table className="table erp-grn-table">
        <thead>
          <tr>
            <th>GRN</th>
            <th>Supplier</th>
            <th>Warehouse</th>
            <th>Received</th>
            <th className="num">Items</th>
            <th className="num">Value</th>
            <th>Status</th>
            <th>Workflow</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="erp-empty-row">
                No goods receipts found.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const metrics = getGrnRowMetrics(row);

              return (
                <tr
                  key={row.id}
                  className={rowStatusClass(metrics.status)}
                  onDoubleClick={() => onOpen(row)}
                >
                  <td>
                    <button
                      type="button"
                      className="erp-link-button"
                      onClick={() => onOpen(row)}
                    >
                      {metrics.grnNumber}
                    </button>
                  </td>
                  <td>{row.supplierName || "Supplier not recorded"}</td>
                  <td>{metrics.warehouse}</td>
                  <td>{metrics.receiptDate}</td>
                  <td className="num">{metrics.lineCount || "—"}</td>
                  <td className="num">{formatMoney(metrics.value)}</td>
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

function GrnRegisterSkeleton() {
  return (
    <div className="erp-table-wrap">
      <table className="table erp-grn-table">
        <thead>
          <tr>
            <th>GRN</th>
            <th>Supplier</th>
            <th>Warehouse</th>
            <th>Received</th>
            <th className="num">Items</th>
            <th className="num">Value</th>
            <th>Status</th>
            <th>Workflow</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, index) => (
            <tr key={index}>
              <td>
                <span className="erp-skeleton erp-skeleton--short" />
              </td>
              <td>
                <span className="erp-skeleton" />
              </td>
              <td>
                <span className="erp-skeleton" />
              </td>
              <td>
                <span className="erp-skeleton erp-skeleton--short" />
              </td>
              <td className="num">
                <span className="erp-skeleton erp-skeleton--tiny" />
              </td>
              <td className="num">
                <span className="erp-skeleton erp-skeleton--short" />
              </td>
              <td>
                <span className="erp-skeleton erp-skeleton--badge" />
              </td>
              <td>
                <span className="erp-skeleton" />
              </td>
              <td className="actions">
                <span className="erp-skeleton erp-skeleton--button" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
