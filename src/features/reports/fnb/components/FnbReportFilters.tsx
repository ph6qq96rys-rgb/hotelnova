import type { FnbReportCatalogItemDto } from "../api/fnbReportsApi";
import type { StockLocationOption } from "../hooks/useStockLocations";

type Props = {
  report: FnbReportCatalogItemDto;
  from: string;
  to: string;
  asOfDate: string;
  locationId: string;
  days: number;
  search: string;
  locations: StockLocationOption[];
  loadingLocations: boolean;
  running: boolean;
  hasRows: boolean;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onAsOfDateChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onDaysChange: (v: number) => void;
  onSearchChange: (v: string) => void;
  onRun: () => void;
  onExport: () => void;
  onPrint: () => void;
};

export function FnbReportFilters(props: Props) {
  const usesAsOfDate = props.report.supportsAsOfDate;
  const usesDateRange = props.report.supportsDateRange && !usesAsOfDate;

  return (
    <div className="fnb-panel">
      <div className="fnb-panel-heading">
        <div>
          <p className="fnb-section-kicker">{props.report.category}</p>
          <h2 className="fnb-section-title">{props.report.name}</h2>
          <p className="fnb-section-subtitle">{props.report.description}</p>
        </div>
      </div>

      <div className="fnb-filter-grid">
        {usesDateRange && (
          <>
            <label>
              <span>From</span>
              <input
                className="fnb-input"
                type="date"
                value={props.from}
                onChange={(e) => props.onFromChange(e.target.value)}
              />
            </label>

            <label>
              <span>To</span>
              <input
                className="fnb-input"
                type="date"
                value={props.to}
                onChange={(e) => props.onToChange(e.target.value)}
              />
            </label>
          </>
        )}

        {usesAsOfDate && (
          <label>
            <span>As of</span>
            <input
              className="fnb-input"
              type="date"
              value={props.asOfDate}
              onChange={(e) => props.onAsOfDateChange(e.target.value)}
            />
          </label>
        )}

        {props.report.supportsLocation && (
          <label>
            <span>Location</span>
            <select
              className="fnb-input"
              value={props.locationId}
              onChange={(e) => props.onLocationChange(e.target.value)}
              disabled={props.loadingLocations}
            >
              <option value="">All locations</option>
              {props.locations.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code ? `${x.code} - ${x.name}` : x.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {props.report.supportsDays && (
          <label>
            <span>Inactive Days</span>
            <input
              className="fnb-input"
              type="number"
              min={1}
              value={props.days}
              onChange={(e) => props.onDaysChange(Number(e.target.value || 30))}
            />
          </label>
        )}

        <label className="fnb-search-field">
          <span>Search current result</span>
          <input
            className="fnb-input"
            placeholder="Item, code, location, category..."
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
          />
        </label>
      </div>

      <div className="fnb-toolbar">
        <button
          type="button"
          className="fnb-btn fnb-btn--primary"
          onClick={props.onRun}
          disabled={props.running}
        >
          {props.running ? "Running..." : "Run Report"}
        </button>

        <button
          type="button"
          className="fnb-btn"
          onClick={props.onExport}
          disabled={props.running || !props.hasRows}
        >
          Export CSV
        </button>

        <button
          type="button"
          className="fnb-btn"
          onClick={props.onPrint}
          disabled={props.running || !props.hasRows}
        >
          Print
        </button>
      </div>
    </div>
  );
}
