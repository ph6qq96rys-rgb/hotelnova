import { useMemo, useState } from "react";

import { useI18n } from "../../../../i18n";
import type {
  FnbReportColumnDto,
  FnbReportRow,
} from "../api/fnbReportsApi";
import { formatReportValue, visibleReportColumns } from "../utils/fnbReportFormatting";

type Props = {
  columns: FnbReportColumnDto[];
  rows: FnbReportRow[];
  loading: boolean;
  reportName?: string;
  currencyCode?: string;
  /** Company reporting time zone for date-time columns. */
  timeZone?: string | null;
  hasRun?: boolean;
  onRowOpen?: (row: FnbReportRow) => void;
};

type SortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

function isNumeric(format?: string) {
  return format === "number" || format === "currency" || format === "percent";
}

function compareValues(a: unknown, b: unknown, format?: string) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === "number" && typeof b === "number") return a - b;

  if (format === "date") {
    const aTime = new Date(String(a)).getTime();
    const bTime = new Date(String(b)).getTime();
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function FnbReportTable({
  columns,
  rows,
  loading,
  reportName,
  currencyCode = "ETB",
  timeZone,
  hasRun = true,
  onRowOpen,
}: Props) {
  const { tx } = useI18n();
  const [sort, setSort] = useState<SortState>(null);
  const visibleColumns = useMemo(() => visibleReportColumns(columns), [columns]);
  const title = reportName || tx("Report detail");

  const sortedRows = useMemo(() => {
    if (!sort) return rows;

    const column = visibleColumns.find((x) => x.key === sort.key);
    return [...rows].sort((a, b) => {
      const result = compareValues(a[sort.key], b[sort.key], column?.format);
      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, sort, visibleColumns]);

  const toggleSort = (column: FnbReportColumnDto) => {
    if (column.isSortable === false) return;

    setSort((current) => {
      if (current?.key !== column.key) {
        return { key: column.key, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { key: column.key, direction: "desc" };
      }

      return null;
    });
  };

  const handleRowClick = (row: FnbReportRow) => {
    const selectedText = window.getSelection()?.toString();
    if (selectedText || !row.itemId) return;

    onRowOpen?.(row);
  };

  const renderCell = (row: FnbReportRow, column: FnbReportColumnDto) => {
    if (column.key === "itemName") {
      return (
        <>
          <strong>{String(row.itemName || tx("Unnamed item"))}</strong>
          <span>
            {String(row.itemCode || "-")} - {String(row.uomName || "-")}
          </span>
        </>
      );
    }

    return formatReportValue(row[column.key], column.format, currencyCode, timeZone);
  };

  const renderSortMarker = (column: FnbReportColumnDto) => {
    if (column.isSortable === false) return null;
    if (sort?.key !== column.key) return <span aria-hidden="true">{tx("Sort")}</span>;
    return <span aria-hidden="true">{sort.direction === "asc" ? tx("Asc") : tx("Desc")}</span>;
  };

  return (
    <div className="fnb-table-card">
      <div className="fnb-table-toolbar">
        <div>
          <strong>{title}</strong>
          <p>{tx("Quantities use each item's base unit. Select an item to inspect its posted movements.")}</p>
        </div>
      </div>

      <div className="fnb-table-wrap">
        <table className="fnb-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={isNumeric(column.format) ? "num" : undefined}
                  aria-sort={sort?.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none"}
                >
                  <button
                    type="button"
                    className="fnb-sort-btn"
                    onClick={() => toggleSort(column)}
                    disabled={column.isSortable === false}
                  >
                    <span>{tx(column.label)}</span>
                    {renderSortMarker(column)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={Math.max(visibleColumns.length, 1)}
                  className="fnb-empty"
                >
                  {tx("Loading report...")}
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleColumns.length, 1)}
                  className="fnb-empty"
                >
                  {hasRun ? tx("No rows match this report selection.") : tx("Choose the report filters and select Run to load results.")}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const canOpen = Boolean(onRowOpen && row.itemId);

                return (
                  <tr
                    key={`${row.itemId ?? "row"}-${row.locationId ?? "all"}-${index}`}
                    className={canOpen ? "is-clickable" : undefined}
                    onClick={() => handleRowClick(row)}
                    tabIndex={canOpen ? 0 : undefined}
                    onKeyDown={(event) => {
                      if (canOpen && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onRowOpen?.(row);
                      }
                    }}
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        className={isNumeric(column.format) ? "num" : undefined}
                      >
                        {renderCell(row, column)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && sortedRows.length > 0 ? (
        <div className="fnb-mobile-list" aria-label={title}>
          {sortedRows.map((row, index) => {
            const canOpen = Boolean(onRowOpen && row.itemId);

            return (
              <button
                key={`${row.itemId ?? "row"}-${row.locationId ?? "all"}-${index}-card`}
                type="button"
                className={canOpen ? "fnb-mobile-row is-clickable" : "fnb-mobile-row"}
                onClick={() => handleRowClick(row)}
                disabled={!canOpen}
              >
                <strong>{String(row.itemName || row.itemCode || tx("Report row"))}</strong>
                <span>{String(row.locationName || row.categoryName || "-")}</span>
                <dl>
                  {visibleColumns
                    .filter((column) => column.key !== "itemName")
                    .map((column) => (
                      <div key={column.key}>
                        <dt>{tx(column.label)}</dt>
                        <dd>{renderCell(row, column)}</dd>
                      </div>
                    ))}
                </dl>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
