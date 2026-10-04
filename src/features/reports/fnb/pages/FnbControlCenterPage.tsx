import { useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { Button } from "../../../../components/ui/button";
import { useI18n } from "../../../../i18n";
import { useErpNavigate } from "../../../../routes/useErpNavigation";

import type { FnbReportQuery, FnbReportRow } from "../api/fnbReportsApi";
import { FnbMovementDrilldown } from "../components/FnbMovementDrilldown";
import { FnbReportContext } from "../components/FnbReportContext";
import { FnbReportFilters } from "../components/FnbReportFilters";
import { FnbReportFamilies } from "../components/FnbReportFamilies";
import { FnbReportInsights } from "../components/FnbReportInsights";
import { FnbReportKpis } from "../components/FnbReportKpis";
import { FnbReportSidebar } from "../components/FnbReportSidebar";
import { FnbReportTable } from "../components/FnbReportTable";
import { useCostCenters } from "../hooks/useCostCenters";
import { useFnbDrilldown } from "../hooks/useFnbDrilldown";
import { useFnbReport } from "../hooks/useFnbReport";
import { useFnbReportCatalog } from "../hooks/useFnbReportCatalog";
import { useFnbReportDates } from "../hooks/useFnbReportDates";
import { useStockLocations } from "../hooks/useStockLocations";
import { exportRowsToCsv } from "../utils/fnbReportExport";
import { reportPeriodLabel } from "../utils/fnbReportFormatting";
import { filterReportRows, REPORT_METHODS, reportFocus, type ReportFamily } from "../utils/fnbReportMeta";

import "./fnb-reports.css";

const DEFAULT_REPORT_KEY = "inventory-valuation";
const DEFAULT_INACTIVE_DAYS = 30;

export default function FnbControlCenterPage() {
  const { tx } = useI18n();
  const { companyId, branchId } = useAppScope();
  const erpNav = useErpNavigate();
  const selectedBranchId = branchId ?? "";

  const [reportKey, setReportKey] = useState(DEFAULT_REPORT_KEY);
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [days, setDays] = useState(DEFAULT_INACTIVE_DAYS);
  const [search, setSearch] = useState("");
  const [showReportMap, setShowReportMap] = useState(false);

  const catalog = useFnbReportCatalog(companyId, selectedBranchId);
  const dates = useFnbReportDates(companyId, selectedBranchId, catalog.defaultDate);
  const locations = useStockLocations(companyId, selectedBranchId);

  // Fall back to the first report when the catalog does not offer the selected key.
  const selectedReport = catalog.items.find((report) => report.key === reportKey) ?? catalog.items[0];
  const activeReportKey = selectedReport?.key ?? reportKey;
  const costCenters = useCostCenters(companyId, selectedBranchId, !!selectedReport?.supportsCostCenter);
  // A department that is no longer active in this branch is not a valid filter.
  const costCenterId = costCenters.items.some((department) => department.id === departmentId) ? departmentId : "";

  const reportQuery = useMemo<FnbReportQuery>(() => ({
    companyId: companyId ?? "",
    branchId: selectedBranchId,
    reportKey: activeReportKey,
    from: selectedReport?.supportsDateRange ? dates.from : "",
    to: selectedReport?.supportsDateRange ? dates.to : "",
    asOfDate: selectedReport?.supportsAsOfDate ? dates.asOfDate : null,
    locationId: locationId || null,
    costCenterId: selectedReport?.supportsCostCenter ? costCenterId || null : null,
    days: selectedReport?.supportsDays ? days : null,
  }), [activeReportKey, companyId, costCenterId, dates.asOfDate, dates.from, dates.to, days, locationId, selectedBranchId,
    selectedReport?.supportsAsOfDate, selectedReport?.supportsCostCenter, selectedReport?.supportsDateRange, selectedReport?.supportsDays]);

  const report = useFnbReport(reportQuery);
  const drilldown = useFnbDrilldown(report.appliedQuery);
  const clearReport = report.clear;

  // A new company or branch invalidates every scoped filter and result.
  useEffect(() => {
    setLocationId("");
    setDepartmentId("");
    setSearch("");
    clearReport();
  }, [companyId, selectedBranchId, clearReport]);

  const result = report.data;
  const filteredRows = useMemo(() => filterReportRows(result?.rows ?? [], search), [result?.rows, search]);

  const selectReport = (key: string) => {
    setReportKey(key);
    setSearch("");
    clearReport();
  };

  const openPath = (path: string) => {
    if (companyId) erpNav(`/companies/${companyId}/${path}`);
  };

  const openFamily = (family: ReportFamily) => {
    if (family.route) {
      openPath(family.route);
      return;
    }
    const firstLiveReport = family.liveReportKeys.find((key) => catalog.items.some((item) => item.key === key));
    if (firstLiveReport) selectReport(firstLiveReport);
  };

  const handleExport = () => {
    if (!result || !report.appliedQuery) return;
    const dateLabel = result.asOfDate
      ? `as-of-${result.asOfDate}`
      : selectedReport?.supportsDateRange
        ? `${result.from}-to-${result.to}`
        : "current-snapshot";

    exportRowsToCsv({
      filename: `${result.reportKey || activeReportKey}-${dateLabel}.csv`,
      report: { ...result, methodology: result.methodology || REPORT_METHODS[result.reportKey] },
      columns: result.columns,
      rows: filteredRows,
      search,
    });
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (result) {
      document.title = [result.reportName, result.companyName || tx("Company"), result.branchName].filter(Boolean).join(" - ");
    }
    window.addEventListener("afterprint", () => { document.title = originalTitle; }, { once: true });
    window.requestAnimationFrame(() => window.print());
  };

  if (!companyId) {
    return (
      <div className="fnb-page">
        <div className="fnb-empty-card">
          <h2>{tx("Company scope required")}</h2>
          <p>{tx("Select a company before opening F&B reports.")}</p>
        </div>
      </div>
    );
  }

  const branchRequired = !selectedBranchId;
  const pendingFilters = !!report.appliedQuery && JSON.stringify(reportQuery) !== JSON.stringify(report.appliedQuery);
  const periodLabel = selectedReport?.supportsAsOfDate || selectedReport?.supportsDateRange
    ? reportPeriodLabel(result, dates, selectedReport?.supportsAsOfDate)
    : tx("Current snapshot");
  const methodology = result?.methodology || REPORT_METHODS[activeReportKey];
  const liveCategories = new Set(catalog.items.map((item) => item.category).filter(Boolean)).size;
  const errors = [catalog.error, locations.error, costCenters.error, report.error].filter(Boolean) as string[];

  return (
    <div className="fnb-page">
      <header className="fnb-header">
        <div>
          <p className="fnb-kicker">{tx("ERP Reports")}</p>
          <h1 className="fnb-title">{tx("F&B Control Center")}</h1>
          <p className="fnb-subtitle">{tx("Consumption, valuation, FIFO aging, dead-stock, and stock turnover reports.")}</p>
        </div>
        <div className="fnb-header-actions">
          <Button type="button" variant="outline" size="sm" onClick={() => openPath("inventory-master/reports")}>
            {tx("Inventory Reports")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openPath("inventory-master/items")}>
            {tx("Item Master")}
          </Button>
        </div>
      </header>

      {branchRequired ? <div className="fnb-alert">{tx("Select a branch to run branch-scoped F&B reports.")}</div> : null}
      {errors.map((error) => <div key={error} className="fnb-alert">{tx(error)}</div>)}

      <section className="fnb-overview" aria-label={tx("F&B reporting status")}>
        <div className="fnb-overview-main">
          <span>{tx("Report console")}</span>
          <strong>{tx("{count} available reports", { count: catalog.items.length })}</strong>
          <small>{tx("{count} categories / reporting for the selected branch", { count: liveCategories })}</small>
        </div>
        <div className="fnb-overview-actions">
          <Button type="button" variant="outline" size="sm" aria-expanded={showReportMap} onClick={() => setShowReportMap((value) => !value)}>
            {showReportMap ? tx("Hide Report Map") : tx("Show Report Map")}
          </Button>
        </div>
      </section>

      {showReportMap ? <FnbReportFamilies liveReportKeys={catalog.items.map((item) => item.key)} onOpen={openFamily} /> : null}

      <section className="fnb-shell">
        <FnbReportSidebar reports={catalog.items} selected={activeReportKey} loading={catalog.loading} onSelect={selectReport} />

        <main className="fnb-main">
          {selectedReport ? (
            <>
              <FnbReportFilters
                report={selectedReport}
                branchId={selectedBranchId}
                departmentId={costCenterId}
                from={dates.from}
                to={dates.to}
                asOfDate={dates.asOfDate}
                locationId={locationId}
                days={days}
                search={search}
                locations={locations.items}
                departments={costCenters.items}
                loadingDepartments={costCenters.loading}
                loadingLocations={locations.loading}
                hasResult={!!result}
                onDepartmentChange={(next) => {
                  setDepartmentId(next);
                  clearReport();
                }}
                onFromChange={dates.setFrom}
                onToChange={dates.setTo}
                onAsOfDateChange={dates.setAsOfDate}
                onLocationChange={setLocationId}
                onDaysChange={setDays}
                onSearchChange={setSearch}
                onRun={report.run}
                onExport={handleExport}
                onPrint={handlePrint}
                running={report.loading || branchRequired}
              />

              {pendingFilters ? (
                <div className="fnb-alert" role="status">
                  {tx("Filters have changed. Run the report to apply them. The displayed results, CSV, printout, and movement details use the last completed report.")}
                </div>
              ) : null}

              <FnbReportContext report={result} methodology={methodology} periodLabel={periodLabel} />

              <FnbReportKpis kpis={result?.kpis ?? []} rowsShown={filteredRows.length} currencyCode={result?.currencyCode} />

              {result && search.trim() ? (
                <div className="fnb-result-scope" role="status">
                  {tx("Search: “{search}” · {shown} of {total} rows. KPI totals cover the full report; the table, insights, CSV, and print detail show the matching rows.", {
                    search: search.trim(), shown: filteredRows.length, total: result.rows.length,
                  })}
                </div>
              ) : null}

              <FnbReportInsights focus={reportFocus(activeReportKey)} rows={filteredRows} currencyCode={result?.currencyCode} />

              {drilldown.error ? <div className="fnb-alert">{tx(drilldown.error)}</div> : null}
              {drilldown.loading ? (
                <div className="fnb-panel" role="status">{tx("Loading movement drilldown...")}</div>
              ) : drilldown.data ? (
                <FnbMovementDrilldown
                  drilldown={drilldown.data}
                  reportKey={activeReportKey}
                  currencyCode={result?.currencyCode}
                  timeZone={result?.timeZone}
                  page={drilldown.page}
                  pageCount={drilldown.pageCount}
                  totalRows={drilldown.totalRows}
                  onPageChange={drilldown.goToPage}
                  onOpenItem={() => drilldown.data?.itemId && openPath(`inventory-master/items/${drilldown.data.itemId}/edit`)}
                  onClose={drilldown.close}
                />
              ) : null}

              <FnbReportTable
                columns={result?.columns ?? []}
                rows={filteredRows}
                loading={report.loading}
                reportName={result?.reportName ?? tx(selectedReport.name)}
                currencyCode={result?.currencyCode}
                timeZone={result?.timeZone}
                hasRun={!!result}
                onRowOpen={(row: FnbReportRow) => void drilldown.open(row)}
              />
            </>
          ) : (
            <div className="fnb-empty-card">
              <h2>{tx("No reports available")}</h2>
              <p>{tx(catalog.loading ? "Loading reports..." : "The F&B report catalog is empty.")}</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
