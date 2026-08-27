import { useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";

import { FnbReportFilters } from "../components/FnbReportFilters";
import { FnbReportKpis } from "../components/FnbReportKpis";
import { FnbReportSidebar } from "../components/FnbReportSidebar";
import { FnbReportTable } from "../components/FnbReportTable";
import {
  getFnbReportDrilldown,
  type FnbReportDrilldownDto,
  type FnbReportRow,
} from "../api/fnbReportsApi";
import { useFnbReport } from "../hooks/useFnbReport";
import { useFnbReportCatalog } from "../hooks/useFnbReportCatalog";
import { useStockLocations } from "../hooks/useStockLocations";
import { exportRowsToCsv } from "../utils/fnbReportExport";
import {
  formatReportDateTime,
  formatReportMoney,
  formatReportNumber,
  reportPeriodLabel,
  todayLocalIsoDate,
} from "../utils/fnbReportFormatting";

import "./fnb-reports.css";

export default function FnbControlCenterPage() {
  const { companyId, branchId } = useAppScope();
  const erpNav = useErpNavigate();

  const [reportKey, setReportKey] = useState("inventory-valuation");
  const [from, setFrom] = useState(todayLocalIsoDate);
  const [to, setTo] = useState(todayLocalIsoDate);
  const [asOfDate, setAsOfDate] = useState(todayLocalIsoDate);
  const [locationId, setLocationId] = useState("");
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [drilldown, setDrilldown] = useState<FnbReportDrilldownDto | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);

  const catalog = useFnbReportCatalog(companyId, branchId);
  const locations = useStockLocations(companyId, branchId);

  const selectedReport = useMemo(
    () =>
      catalog.items.find((report) => report.key === reportKey) ??
      catalog.items[0],
    [catalog.items, reportKey],
  );

  useEffect(() => {
    if (!selectedReport && catalog.items.length > 0) {
      setReportKey(catalog.items[0].key);
    }
  }, [catalog.items, selectedReport]);

  const reportQuery = useMemo(
    () => ({
      companyId,
      branchId,
      reportKey,
      from,
      to,
      asOfDate: selectedReport?.supportsAsOfDate ? asOfDate : null,
      locationId: locationId || null,
      days: reportKey === "dead-stock" ? days : null,
    }),
    [
      asOfDate,
      branchId,
      companyId,
      days,
      from,
      locationId,
      reportKey,
      selectedReport?.supportsAsOfDate,
      to,
    ],
  );

  const report = useFnbReport(reportQuery);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = report.data?.rows ?? [];

    if (!query) return rows;

    return rows.filter((row) =>
      [
        row.itemName,
        row.itemCode,
        row.locationName,
        row.categoryName,
        row.uomName,
        row.bucket,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [report.data?.rows, search]);

  const handleReportSelect = (key: string) => {
    setReportKey(key);
    setSearch("");
    setDrilldown(null);
    setDrilldownError(null);
    report.clear();
  };

  const handleExport = () => {
    const dateLabel = selectedReport?.supportsAsOfDate
      ? `as-of-${asOfDate}`
      : `${from}-to-${to}`;

    if (!report.data) return;

    exportRowsToCsv({
      filename: `${report.data.reportKey ?? reportKey}-${dateLabel}.csv`,
      report: report.data,
      columns: report.data.columns,
      rows: filteredRows,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenInventory = () => {
    if (!companyId) return;
    erpNav(`/companies/${companyId}/inventory-master/items`);
  };

  const handleRowOpen = async (row: FnbReportRow) => {
    if (!row.itemId || !companyId || !branchId) return;

    setDrilldownLoading(true);
    setDrilldownError(null);

    try {
      const result = await getFnbReportDrilldown({
        ...reportQuery,
        itemId: row.itemId,
        locationId: typeof row.locationId === "string" ? row.locationId : null,
      });
      setDrilldown(result);
    } catch (err) {
      setDrilldownError(
        err instanceof Error ? err.message : "Failed to load movement drilldown.",
      );
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleOpenDrilldownItem = () => {
    if (!companyId || !drilldown?.itemId) return;
    erpNav(`/companies/${companyId}/inventory-master/items/${drilldown.itemId}/edit`);
  };

  if (!companyId) {
    return (
      <div className="fnb-page">
        <div className="fnb-empty-card">
          <h2>Company scope required</h2>
          <p>Select a company before opening F&amp;B reports.</p>
        </div>
      </div>
    );
  }

  const branchRequired = !branchId;
  const result = report.data;
  const hasRows = filteredRows.length > 0;
  const periodLabel = reportPeriodLabel(
    result,
    { from, to, asOfDate },
    selectedReport?.supportsAsOfDate,
  );

  return (
    <div className="fnb-page">
      <header className="fnb-header">
        <div>
          <p className="fnb-kicker">ERP Reports</p>
          <h1 className="fnb-title">F&amp;B Control Center</h1>
          <p className="fnb-subtitle">
            Consumption, COGS, valuation, FIFO aging, dead-stock, and stock turnover reports.
          </p>
        </div>

        <div className="fnb-header-actions">
          <button type="button" className="fnb-btn" onClick={handleOpenInventory}>
            Inventory
          </button>
        </div>
      </header>

      {branchRequired ? (
        <div className="fnb-alert">
          Select a branch to run branch-scoped F&amp;B reports.
        </div>
      ) : null}

      {catalog.error ? <div className="fnb-alert">{catalog.error}</div> : null}
      {report.error ? <div className="fnb-alert">{report.error}</div> : null}

      <section className="fnb-shell">
        <FnbReportSidebar
          reports={catalog.items}
          selected={reportKey}
          loading={catalog.loading}
          onSelect={handleReportSelect}
        />

        <main className="fnb-main">
          {selectedReport ? (
            <>
              <FnbReportFilters
                report={selectedReport}
                from={from}
                to={to}
                asOfDate={asOfDate}
                locationId={locationId}
                days={days}
                search={search}
                locations={locations.items}
                loadingLocations={locations.loading}
                hasRows={hasRows}
                onFromChange={setFrom}
                onToChange={setTo}
                onAsOfDateChange={setAsOfDate}
                onLocationChange={setLocationId}
                onDaysChange={setDays}
                onSearchChange={setSearch}
                onRun={report.run}
                onExport={handleExport}
                onPrint={handlePrint}
                running={report.loading || branchRequired}
              />

              {result ? (
                <section className="fnb-print-header" aria-label="Printable report header">
                  <div>
                    <p>F&amp;B Control Report</p>
                    <h2>{result.reportName}</h2>
                  </div>
                  <div>
                    <strong>{result.companyName || "Company"}</strong>
                    <span>{result.branchName || "Branch"}</span>
                  </div>
                </section>
              ) : null}

              {result ? (
                <section className="fnb-report-context" aria-label="Report context">
                  <div>
                    <span>Period</span>
                    <strong>{periodLabel}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{result.periodStatus || "Open"}</strong>
                  </div>
                  <div>
                    <span>Costing</span>
                    <strong>{result.costingMethod || "Configured"}</strong>
                  </div>
                  <div>
                    <span>Currency</span>
                    <strong>{result.currencyCode || "-"}</strong>
                  </div>
                  <div>
                    <span>Generated</span>
                    <strong>{formatReportDateTime(result.generatedAtUtc)}</strong>
                  </div>
                  <div>
                    <span>Generated By</span>
                    <strong>{result.generatedBy || "-"}</strong>
                  </div>
                  <div>
                    <span>Scope</span>
                    <strong>{result.filterSummary || "-"}</strong>
                  </div>
                  <div>
                    <span>Summary</span>
                    <strong>
                      {formatReportNumber(result.summary?.itemCount)} items /{" "}
                      {formatReportMoney(result.summary?.totalValue, result.currencyCode)}
                    </strong>
                  </div>
                </section>
              ) : null}

              {result?.warnings?.length ? (
                <section className="fnb-warning-list" aria-label="Report warnings">
                  {result.warnings.map((warning) => (
                    <div key={`${warning.code}-${warning.message}`} className="fnb-warning">
                      <strong>{warning.severity || "Warning"}</strong>
                      <span>{warning.message}</span>
                    </div>
                  ))}
                </section>
              ) : null}

              <FnbReportKpis
                kpis={result?.kpis ?? []}
                rowsShown={filteredRows.length}
                currencyCode={result?.currencyCode}
              />

              {drilldownError ? <div className="fnb-alert">{drilldownError}</div> : null}

              {drilldownLoading ? (
                <div className="fnb-panel">Loading movement drilldown...</div>
              ) : drilldown ? (
                <section className="fnb-drilldown">
                  <div className="fnb-table-toolbar">
                    <div>
                      <strong>{drilldown.itemName || "Movement drilldown"}</strong>
                      <p>
                        {drilldown.locationName || "All locations"} /{" "}
                        {formatReportNumber(drilldown.summary?.totalQty)} net qty /{" "}
                        {formatReportMoney(drilldown.summary?.totalValue, result?.currencyCode)}
                      </p>
                    </div>
                    <div className="fnb-toolbar">
                      <button type="button" className="fnb-btn" onClick={handleOpenDrilldownItem}>
                        Open item master
                      </button>
                      <button type="button" className="fnb-btn" onClick={() => setDrilldown(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="fnb-table-wrap">
                    <table className="fnb-table">
                      <thead>
                        <tr>
                          <th>Posted</th>
                          <th>Source</th>
                          <th className="num">Qty In</th>
                          <th className="num">Qty Out</th>
                          <th className="num">Value In</th>
                          <th className="num">Value Out</th>
                          <th>Batch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldown.ledger.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="fnb-empty">
                              No source movements found for this selection.
                            </td>
                          </tr>
                        ) : (
                          drilldown.ledger.slice(0, 100).map((line, index) => (
                            <tr key={`${line.id ?? index}`}>
                              <td>{formatReportDateTime(String(line.postedAtUtc ?? ""))}</td>
                              <td>
                                <strong>{String(line.sourceNo ?? line.sourceType ?? "-")}</strong>
                                <span>{String(line.direction ?? "-")}</span>
                              </td>
                              <td className="num">{formatReportNumber(line.qtyInBase as number)}</td>
                              <td className="num">{formatReportNumber(line.qtyOutBase as number)}</td>
                              <td className="num">
                                {formatReportMoney(line.valueIn as number, result?.currencyCode)}
                              </td>
                              <td className="num">
                                {formatReportMoney(line.valueOut as number, result?.currencyCode)}
                              </td>
                              <td>{String(line.batchNo ?? "-")}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <FnbReportTable
                columns={result?.columns ?? []}
                rows={filteredRows}
                loading={report.loading}
                reportName={result?.reportName ?? selectedReport.name}
                currencyCode={result?.currencyCode}
                onRowOpen={handleRowOpen}
              />
            </>
          ) : (
            <div className="fnb-empty-card">
              <h2>No reports available</h2>
              <p>The F&amp;B report catalog is empty.</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
