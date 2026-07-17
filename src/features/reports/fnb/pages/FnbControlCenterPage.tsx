import { useEffect, useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";

import { FnbReportFilters } from "../components/FnbReportFilters";
import { FnbReportKpis } from "../components/FnbReportKpis";
import { FnbReportSidebar } from "../components/FnbReportSidebar";
import { FnbReportTable } from "../components/FnbReportTable";
import { useFnbReport } from "../hooks/useFnbReport";
import { useFnbReportCatalog } from "../hooks/useFnbReportCatalog";
import { useStockLocations } from "../hooks/useStockLocations";
import { exportRowsToCsv } from "../utils/fnbReportExport";

import "./fnb-reports.css";

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FnbControlCenterPage() {
  const { companyId, branchId } = useAppScope();
  const erpNav = useErpNavigate();

  const [reportKey, setReportKey] = useState("inventory-valuation");
  const [from, setFrom] = useState(getTodayIsoDate);
  const [to, setTo] = useState(getTodayIsoDate);
  const [locationId, setLocationId] = useState("");
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");

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

  const report = useFnbReport({
    companyId,
    branchId,
    reportKey,
    from,
    to,
    locationId: locationId || null,
    days: reportKey === "dead-stock" ? days : null,
  });

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
    report.clear();
  };

  const handleExport = () => {
    exportRowsToCsv({
      filename: `${report.data?.reportKey ?? reportKey}-${from}-to-${to}.csv`,
      rows: filteredRows,
    });
  };

  const handleOpenInventory = () => {
    if (!companyId) return;
    erpNav(`/companies/${companyId}/inventory-master/items`);
  };

  const handleRowOpen = (row: { itemId?: string | null }) => {
    if (!row.itemId || !companyId) return;
    erpNav(`/companies/${companyId}/inventory/items/${row.itemId}`);
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

  return (
    <div className="fnb-page">
      <header className="fnb-header">
        <div>
          <p className="fnb-kicker">ERP Reports</p>
          <h1 className="fnb-title">F&amp;B Control Center</h1>
          <p className="fnb-subtitle">
            Consumption, COGS, valuation, variance, FIFO aging, stock turnover,
            and production yield.
          </p>
        </div>

        <div className="fnb-header-actions">
          <button type="button" className="fnb-btn" onClick={handleOpenInventory}>
            Inventory
          </button>

          <button
            type="button"
            className="fnb-btn fnb-btn--primary"
            onClick={report.run}
            disabled={
              branchRequired ||
              report.loading ||
              catalog.loading ||
              !selectedReport
            }
          >
            {report.loading ? "Running…" : "Run Report"}
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
                locationId={locationId}
                days={days}
                search={search}
                locations={locations.items}
                loadingLocations={locations.loading}
                onFromChange={setFrom}
                onToChange={setTo}
                onLocationChange={setLocationId}
                onDaysChange={setDays}
                onSearchChange={setSearch}
                onRun={report.run}
                onExport={handleExport}
                running={report.loading || branchRequired}
              />

              <FnbReportKpis
                kpis={report.data?.kpis ?? []}
                rowsShown={filteredRows.length}
              />

              <FnbReportTable
                columns={report.data?.columns ?? []}
                rows={filteredRows}
                loading={report.loading}
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