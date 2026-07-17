import type {
  FnbReportColumnDto,
  FnbReportRow,
} from "../api/fnbReportsApi";

type Props = {
  columns: FnbReportColumnDto[];
  rows: FnbReportRow[];
  loading: boolean;
  onRowOpen?: (row: FnbReportRow) => void;
};

function formatCell(value: unknown, format?: string) {
  if (value == null || value === "") return "—";

  if (typeof value === "number") {
    switch (format) {
      case "currency":
        return value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      case "percent":
        return `${value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`;

      case "number":
        return value.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        });

      default:
        return value.toLocaleString();
    }
  }

  if (format === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString();
  }

  return String(value);
}

function isNumeric(format?: string) {
  return format === "number" || format === "currency" || format === "percent";
}

export function FnbReportTable({
  columns,
  rows,
  loading,
  onRowOpen,
}: Props) {
  const visibleColumns = columns.filter((x) => x.isVisible !== false);

  const handleRowClick = (row: FnbReportRow) => {
    const selectedText = window.getSelection()?.toString();
    if (selectedText) return;

    onRowOpen?.(row);
  };

  return (
    <div className="fnb-table-card">
      <div className="fnb-table-toolbar">
        <div>
          <strong>Report Detail</strong>
          <p>Backend-driven ERP report rows.</p>
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
                >
                  {column.label}
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
                  Loading report…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleColumns.length, 1)}
                  className="fnb-empty"
                >
                  No data found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={`${row.itemId ?? "row"}-${row.locationId ?? "all"}-${index}`}
                  className={onRowOpen ? "is-clickable" : ""}
                  onClick={() => handleRowClick(row)}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={isNumeric(column.format) ? "num" : undefined}
                    >
                      {column.key === "itemName" ? (
                        <>
                          <strong>
                            {String(row.itemName || "Unnamed item")}
                          </strong>
                          <span>
                            {String(row.itemCode || "—")} ·{" "}
                            {String(row.uomName || "—")}
                          </span>
                        </>
                      ) : (
                        formatCell(row[column.key], column.format)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}