import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { useI18n } from "../../../../i18n";
import type { DepartmentDto } from "../../../hr/types";
import type { FnbReportCatalogItemDto } from "../api/fnbReportsApi";
import type { StockLocationOption } from "../hooks/useStockLocations";

type Props = {
  report: FnbReportCatalogItemDto;
  branchId: string;
  departmentId: string;
  from: string;
  to: string;
  asOfDate: string;
  locationId: string;
  days: number;
  search: string;
  locations: StockLocationOption[];
  departments: DepartmentDto[];
  loadingDepartments: boolean;
  loadingLocations: boolean;
  running: boolean;
  hasResult: boolean;
  onDepartmentChange: (v: string) => void;
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

const optionLabel = (option: { code?: string | null; name: string }) =>
  option.code ? `${option.code} - ${option.name}` : option.name;

/** True when the selected report cannot run with the current date and threshold inputs. */
function reportFilterErrors(props: Pick<Props, "report" | "from" | "to" | "asOfDate" | "days">) {
  const usesAsOfDate = props.report.supportsAsOfDate;
  const usesDateRange = props.report.supportsDateRange && !usesAsOfDate;
  return {
    invalidDate: (usesDateRange && (!props.from || !props.to || props.to < props.from)) || (usesAsOfDate && !props.asOfDate),
    invalidDays: props.report.supportsDays && (!Number.isInteger(props.days) || props.days < 1),
  };
}

export function FnbReportFilters(props: Props) {
  const { tx } = useI18n();
  const usesAsOfDate = props.report.supportsAsOfDate;
  const usesDateRange = props.report.supportsDateRange && !usesAsOfDate;
  const { invalidDate, invalidDays } = reportFilterErrors(props);
  const busy = props.running;

  return (
    <div className="fnb-panel">
      <div className="fnb-panel-heading">
        <div>
          <p className="fnb-section-kicker">{tx(props.report.category)}</p>
          <h2 className="fnb-section-title">{tx(props.report.name)}</h2>
          <p className="fnb-section-subtitle">{tx(props.report.description)}</p>
        </div>

        <div className="fnb-filter-actions">
          <Button type="button" size="sm" onClick={props.onRun} disabled={busy || invalidDate || invalidDays} title={tx("Run report")}>
            {busy ? tx("Running...") : tx("Run")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={props.onExport} disabled={busy || !props.hasResult} title={tx("Export CSV")}>
            CSV
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={props.onPrint} disabled={busy || !props.hasResult} title={tx("Print")}>
            {tx("Print")}
          </Button>
        </div>
      </div>

      <div className="fnb-filter-grid">
        {props.report.supportsCostCenter ? (
          <label>
            <span>{tx("Department / cost center")}</span>
            <Select
              value={props.departmentId}
              onChange={(e) => props.onDepartmentChange(e.target.value)}
              disabled={props.loadingDepartments || busy || !props.branchId}
            >
              <option value="">{tx("All departments")}</option>
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>{optionLabel(department)}</option>
              ))}
            </Select>
          </label>
        ) : null}

        {usesDateRange ? (
          <>
            <label>
              <span>{tx("From")}</span>
              <Input type="date" required value={props.from} onChange={(e) => props.onFromChange(e.target.value)} />
            </label>
            <label>
              <span>{tx("To")}</span>
              <Input type="date" required min={props.from} value={props.to} onChange={(e) => props.onToChange(e.target.value)} />
            </label>
          </>
        ) : null}

        {usesAsOfDate ? (
          <label>
            <span>{tx("As of")}</span>
            <Input type="date" required value={props.asOfDate} onChange={(e) => props.onAsOfDateChange(e.target.value)} />
          </label>
        ) : null}

        {props.report.supportsLocation ? (
          <label>
            <span>{tx("Location")}</span>
            <Select
              value={props.locationId}
              onChange={(e) => props.onLocationChange(e.target.value)}
              disabled={props.loadingLocations || busy}
            >
              <option value="">{tx("All locations")}</option>
              {props.locations.map((location) => (
                <option key={location.id} value={location.id}>{optionLabel(location)}</option>
              ))}
            </Select>
          </label>
        ) : null}

        {props.report.supportsDays ? (
          <label>
            <span>{tx("Inactive days")}</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(props.days) ? props.days : ""}
              aria-invalid={invalidDays || undefined}
              onChange={(e) => props.onDaysChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
            />
          </label>
        ) : null}

        <label className="fnb-search-field">
          <span>{tx("Search current result")}</span>
          <Input
            type="search"
            placeholder={tx("Item, code, location, category...")}
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
          />
        </label>
      </div>
      {invalidDate ? <p className="fnb-alert" role="alert">{tx("Enter a valid report date or a date range ending on or after the start date.")}</p> : null}
      {invalidDays ? <p className="fnb-alert" role="alert">{tx("Inactive days must be a whole number greater than zero.")}</p> : null}
    </div>
  );
}
