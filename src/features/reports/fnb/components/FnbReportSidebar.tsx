import type { FnbReportCatalogItemDto } from "../api/fnbReportsApi";

type Props = {
  reports: FnbReportCatalogItemDto[];
  selected: string;
  loading?: boolean;
  onSelect: (key: string) => void;
};

export function FnbReportSidebar({
  reports,
  selected,
  loading = false,
  onSelect,
}: Props) {
  const groupedReports = reports.reduce<Record<string, FnbReportCatalogItemDto[]>>(
    (acc, report) => {
      const group = report.category || "Other";
      acc[group] ??= [];
      acc[group].push(report);
      return acc;
    },
    {},
  );

  return (
    <aside className="fnb-sidebar">
      <h3>Reports</h3>

      {loading ? <p className="fnb-muted">Loading reports...</p> : null}

      {Object.entries(groupedReports).map(([category, items]) => (
        <div key={category} className="fnb-sidebar-group">
          <p className="fnb-sidebar-group-title">{category}</p>

          {items.map((report) => (
            <button
              key={report.key}
              type="button"
              className={
                report.key === selected
                  ? "fnb-sidebar-item fnb-sidebar-item--active"
                  : "fnb-sidebar-item"
              }
              onClick={() => onSelect(report.key)}
            >
              <span>{report.name}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
