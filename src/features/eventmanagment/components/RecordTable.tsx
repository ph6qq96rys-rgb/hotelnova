// src/features/eventmanagment/components/RecordTable.tsx
//
// Table for the event sub-resources the API client types as `unknown[]`
// (equipment plans, staffing plans, dispatches, returns, waste,
// reconciliations, final bills, profitability).
//
// Columns declare candidate field names rather than one fixed key, so a screen
// keeps rendering if a backend DTO renames or adds a field, and shows a dash
// rather than crashing when a value is absent.

import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { StatusBadge } from "../pages/erp/EventManagementShared";
import {
  asRecords,
  readId,
  readNumber,
  readStatus,
  readText,
  type UnknownRecord,
} from "../workspace/record";

export type RecordColumn = {
  label: string;
  /** First matching key wins. */
  keys: string[];
  format?: "text" | "number" | "currency" | "percent" | "date" | "status";
  align?: "start" | "end";
};

type RecordTableProps = {
  rows: unknown;
  columns: RecordColumn[];
  empty: string;
  /** Cap displayed rows; the rest are summarised beneath the table. */
  limit?: number;
};

export function RecordTable({ rows, columns, empty, limit = 8 }: RecordTableProps) {
  const records = asRecords(rows);

  if (!records.length) {
    return <p className="erp-record-empty">{empty}</p>;
  }

  const visible = records.slice(0, limit);
  const hidden = records.length - visible.length;

  return (
    <div className="erp-record-table-wrap">
      <table className="erp-record-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.align === "end" ? "is-end" : undefined} key={column.label} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={readId(row, index)}>
              {columns.map((column) => (
                <td className={column.align === "end" ? "is-end" : undefined} key={column.label}>
                  {renderCell(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 ? (
        <small className="erp-record-more">
          {hidden} more row{hidden === 1 ? "" : "s"} not shown.
        </small>
      ) : null}
    </div>
  );
}

function renderCell(row: UnknownRecord, column: RecordColumn) {
  if (column.format === "status") {
    return <StatusBadge status={readStatus(row, column.keys)} />;
  }

  if (column.format === "currency") {
    const value = readNumber(row, column.keys);
    return value === null ? "—" : formatCurrency(value);
  }

  if (column.format === "percent") {
    const value = readNumber(row, column.keys);
    return value === null ? "—" : `${value.toFixed(1)}%`;
  }

  if (column.format === "number") {
    const value = readNumber(row, column.keys);
    return value === null ? "—" : value.toLocaleString();
  }

  if (column.format === "date") {
    const raw = readText(row, column.keys);
    if (!raw) return "—";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return readText(row, column.keys) ?? "—";
}
