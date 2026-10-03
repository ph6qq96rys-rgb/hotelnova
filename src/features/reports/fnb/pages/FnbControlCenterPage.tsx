import { useEffect, useMemo, useRef, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { Button } from "../../../../components/ui/button";
import { orgStructureApi } from "../../../hr/api/hrApi";
import type { DepartmentDto } from "../../../hr/types";

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
import { useFnbReportDates } from "../hooks/useFnbReportDates";
import { useStockLocations } from "../hooks/useStockLocations";
import { exportRowsToCsv } from "../utils/fnbReportExport";
import {
  formatReportDateTime,
  formatReportMoney,
  formatReportNumber,
  reportPeriodLabel,
} from "../utils/fnbReportFormatting";

import "./fnb-reports.css";

type ReportFocus = "consumption" | "aging" | null;

const REPORT_METHODS: Record<string, string> = {
  "inventory-valuation": "Inventory quantities use each item's base unit. Values use the company currency and the selected reporting cutoff. Quantities and unit costs from different items are not added together.",
  consumption: "Posted inventory usage is grouped by item and stock location. Store transfers are excluded from consumption. Quantities use each item's base unit; consumption value is not revenue or gross margin.",
  "fifo-aging": "Current remaining FIFO layers are aged from their receipt date. Layer age does not indicate an item's expiry date. Historical inventory valuation is available in Inventory Valuation.",
  "dead-stock": "Stock held at the selected cutoff with no movement for the inactivity threshold. This identifies stock for review; it does not post a write-off or a valuation adjustment.",
  "stock-turnover": "Period consumption value divided by the average of opening and closing inventory value. Turnover is a ratio; it is not annualized. Missing or zero inventory denominators require review.",
};
const MOVEMENT_PAGE_SIZE = 100;

type ReportFamily = {
  key: string;
  title: string;
  owner: string;
  description: string;
  liveReportKeys: string[];
  route?: string;
};

const REPORT_FAMILIES: ReportFamily[] = [
  {
    key: "executive",
    title: "Executive",
    owner: "Management",
    description: "KPI, margin, branch comparison, trend, and exception packs.",
    liveReportKeys: [],
  },
  {
    key: "sales-pos",
    title: "Sales and POS",
    owner: "Sales / Cashier",
    description: "Daily sales, cashier sessions, payment reconciliation, discounts, and COGS posting.",
    liveReportKeys: [],
    route: "sales/reports",
  },
  {
    key: "inventory",
    title: "Inventory control",
    owner: "Store / Controller",
    description: "Stock on hand, valuation, ledger, GRN, SIV, exception, and reconciliation reporting.",
    liveReportKeys: ["inventory-valuation", "fifo-aging", "dead-stock", "stock-turnover", "consumption"],
    route: "inventory-master/reports",
  },
  {
    key: "procurement",
    title: "Procurement",
    owner: "Procurement",
    description: "Purchase requests, supplier performance, price variance, commitments, and matching exceptions.",
    liveReportKeys: [],
  },
  {
    key: "recipe-food-cost",
    title: "Recipe and food cost",
    owner: "Chef / Cost control",
    description: "Recipe cost, menu margin, theoretical versus actual cost, substitutions, and price recommendations.",
    liveReportKeys: ["consumption"],
  },
  {
    key: "production-waste",
    title: "Production and waste",
    owner: "Kitchen / Butchery",
    description: "Production yield, batch cost, WIP, waste, spoilage, and loss accountability.",
    liveReportKeys: [],
  },
  {
    key: "finance",
    title: "Finance reconciliation",
    owner: "Finance",
    description: "COGS, inventory-to-GL, payments, tax, accruals, and period-close exceptions.",
    liveReportKeys: [],
  },
  {
    key: "catering",
    title: "Catering and events",
    owner: "Catering manager",
    description: "Pipeline, event profitability, deposits, consumption, returns, staffing, and closure.",
    liveReportKeys: [],
    route: "eventmanagment/reports",
  },
  {
    key: "workforce-audit",
    title: "Workforce and audit",
    owner: "HR / Compliance",
    description: "Attendance, labor productivity, approvals, user activity, permissions, and access audit.",
    liveReportKeys: [],
  },
];

function numberFrom(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function reportFocus(reportKey: string): ReportFocus {
  const key = reportKey.toLowerCase();
  if (key === "consumption" || key.includes("consumption")) return "consumption";
  if (key === "fifo-aging" || key.includes("aging") || key.includes("ageing")) return "aging";
  return null;
}

function topRowsByValue(rows: FnbReportRow[], limit = 5): FnbReportRow[] {
  return [...rows]
    .sort((a, b) => numberFrom(b.value) - numberFrom(a.value))
    .slice(0, limit);
}

function buildAgingBuckets(rows: FnbReportRow[]) {
  const order = ["0-7 Days", "8-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];
  const buckets = new Map<string, { bucket: string; qty: number; value: number; count: number }>();

  for (const row of rows) {
    const bucket = String(row.bucket || "Unbucketed");
    const current = buckets.get(bucket) ?? { bucket, qty: 0, value: 0, count: 0 };
    current.qty += numberFrom(row.qty ?? row.closingQty);
    current.value += numberFrom(row.value);
    current.count += 1;
    buckets.set(bucket, current);
  }

  return [...buckets.values()].sort((a, b) => {
    const ai = order.indexOf(a.bucket);
    const bi = order.indexOf(b.bucket);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.bucket.localeCompare(b.bucket);
  });
}

function ReportInsightPanel({
  focus,
  rows,
  currencyCode,
}: {
  focus: ReportFocus;
  rows: FnbReportRow[];
  currencyCode?: string;
}) {
  if (!focus || rows.length === 0) return null;

  if (focus === "consumption") {
    const totalValue = rows.reduce((sum, row) => sum + numberFrom(row.value), 0);
    const itemCount = new Set(rows.map((row) => row.itemId).filter(Boolean)).size;
    const locations = new Set(rows.map((row) => row.locationName).filter(Boolean)).size;
    const categories = new Set(rows.map((row) => row.categoryName).filter(Boolean)).size;
    const leadingRows = topRowsByValue(rows);

    return (
      <section className="fnb-insight fnb-insight--consumption" aria-label="Consumption report summary">
        <div className="fnb-insight-hero">
          <div>
            <p className="fnb-section-kicker">Consumption Control</p>
            <h3>Cost concentration and usage movement</h3>
            <span>
              {formatReportNumber(itemCount)} items across {formatReportNumber(locations)} locations and{" "}
              {formatReportNumber(categories)} categories.
            </span>
          </div>
          <div className="fnb-insight-total">
            <span>Total consumed value</span>
            <strong>{formatReportMoney(totalValue, currencyCode)}</strong>
            <small>Quantities are shown per item and unit below</small>
          </div>
        </div>

        <div className="fnb-insight-grid">
          {leadingRows.map((row, index) => {
            const value = numberFrom(row.value);
            const share = totalValue > 0 ? (value / totalValue) * 100 : 0;

            return (
              <article className="fnb-consumption-line" key={`${row.itemId ?? row.itemName}-${index}`}>
                <div>
                  <strong>{String(row.itemName || "Unnamed item")}</strong>
                  <span>{String(row.locationName || row.categoryName || "-")}</span>
                </div>
                <div className="fnb-consumption-value">
                  <strong>{formatReportMoney(value, currencyCode)}</strong>
                  <span>{formatReportNumber(share, 1)}%</span>
                </div>
                <div className="fnb-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(3, share))}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const buckets = buildAgingBuckets(rows);
  const totalValue = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const riskValue = buckets
    .filter((bucket) => bucket.bucket === "61-90 Days" || bucket.bucket === "90+ Days")
    .reduce((sum, bucket) => sum + bucket.value, 0);
  const oldest = [...rows].sort(
    (a, b) => numberFrom(b.daysSinceLastMovement) - numberFrom(a.daysSinceLastMovement),
  )[0];

  return (
    <section className="fnb-insight fnb-insight--aging" aria-label="FIFO aging report summary">
      <div className="fnb-insight-hero">
        <div>
          <p className="fnb-section-kicker">FIFO Aging Control</p>
          <h3>Age exposure by remaining stock value</h3>
          <span>
            {formatReportMoney(riskValue, currencyCode)} sits in 61+ day layers from{" "}
            {formatReportNumber(rows.length)} open FIFO rows.
          </span>
        </div>
        <div className="fnb-insight-total">
          <span>Oldest open layer</span>
          <strong>{formatReportNumber(oldest?.daysSinceLastMovement as number)} days</strong>
          <small>{String(oldest?.itemName || "No item selected")}</small>
        </div>
      </div>

      <div className="fnb-aging-strip">
        {buckets.map((bucket) => {
          const share = totalValue > 0 ? (bucket.value / totalValue) * 100 : 0;

          return (
            <article className="fnb-aging-bucket" key={bucket.bucket}>
              <div>
                <span>{bucket.bucket}</span>
                <strong>{formatReportMoney(bucket.value, currencyCode)}</strong>
              </div>
              <small>
                {formatReportNumber(bucket.count)} remaining layers
              </small>
              <div className="fnb-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.max(3, share))}%` }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function FnbControlCenterPage() {
  const { companyId, branchId } = useAppScope();
  const erpNav = useErpNavigate();

  const selectedBranchId = branchId ?? "";
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentLoadError, setDepartmentLoadError] = useState<string | null>(null);
  const [reportKey, setReportKey] = useState("inventory-valuation");
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [drilldown, setDrilldown] = useState<FnbReportDrilldownDto | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [drilldownRow, setDrilldownRow] = useState<FnbReportRow | null>(null);
  const drilldownAbortRef = useRef<AbortController | null>(null);
  const [showReportMap, setShowReportMap] = useState(false);

  const catalog = useFnbReportCatalog(companyId, selectedBranchId);
  const { from, to, asOfDate, setFrom, setTo, setAsOfDate } = useFnbReportDates(companyId, selectedBranchId, catalog.defaultDate);
  const locations = useStockLocations(companyId, selectedBranchId);
  const supportsDepartmentFilter = catalog.items.some((item) => item.key === reportKey && item.supportsCostCenter);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      if (!companyId || !selectedBranchId || !supportsDepartmentFilter) {
        setDepartments([]);
        setDepartmentId("");
        setDepartmentsLoading(false);
        setDepartmentLoadError(null);
        return;
      }

      setDepartmentsLoading(true);
      setDepartmentLoadError(null);

      try {
        const rows = await orgStructureApi.listDepartments(companyId, {
          branchId: selectedBranchId,
          activeOnly: true,
        });

        if (cancelled) return;

        const activeDepartments = rows
          .filter((department) => (department as any).isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name));

        setDepartments(activeDepartments);
        setDepartmentId((current) =>
          current && activeDepartments.some((department) => department.id === current)
            ? current
            : "",
        );
      } catch (error) {
        if (!cancelled) {
          setDepartmentLoadError(
            error instanceof Error ? error.message : "Failed to load departments.",
          );
          setDepartments([]);
        }
      } finally {
        if (!cancelled) setDepartmentsLoading(false);
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [companyId, selectedBranchId, supportsDepartmentFilter]);

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
      branchId: selectedBranchId,
      reportKey,
      from: selectedReport?.supportsDateRange ? from : "",
      to: selectedReport?.supportsDateRange ? to : "",
      asOfDate: selectedReport?.supportsAsOfDate ? asOfDate : null,
      locationId: locationId || null,
      costCenterId: selectedReport?.supportsCostCenter ? departmentId || null : null,
      days: selectedReport?.supportsDays ? days : null,
    }),
    [
      asOfDate,
      companyId,
      departmentId,
      days,
      from,
      locationId,
      reportKey,
      selectedBranchId,
      selectedReport?.supportsAsOfDate,
      selectedReport?.supportsDateRange,
      selectedReport?.supportsCostCenter,
      selectedReport?.supportsDays,
      to,
    ],
  );

  const report = useFnbReport(reportQuery);

  useEffect(() => {
    drilldownAbortRef.current?.abort();
    setDrilldown(null);
    setDrilldownRow(null);
    setDrilldownLoading(false);
    setDrilldownError(null);
    return () => drilldownAbortRef.current?.abort();
  }, [companyId, selectedBranchId, reportKey, report.appliedQuery]);

  useEffect(() => {
    setLocationId("");
    setDepartmentId("");
    setSearch("");
    setDrilldown(null);
    setDrilldownError(null);
    report.clear();
  }, [companyId, selectedBranchId, report.clear]);

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
        row.consumptionType,
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
    if (!report.data || !report.appliedQuery) return;
    const dateLabel = report.data.asOfDate
      ? `as-of-${report.data.asOfDate}`
      : selectedReport?.supportsDateRange
        ? `${report.data.from}-to-${report.data.to}`
        : "current-snapshot";

    exportRowsToCsv({
      filename: `${report.data.reportKey ?? reportKey}-${dateLabel}.csv`,
      report: { ...report.data, methodology: report.data.methodology || REPORT_METHODS[report.data.reportKey] },
      columns: report.data.columns,
      rows: filteredRows,
      search,
    });
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (report.data) {
      document.title = `${report.data.reportName} - ${report.data.companyName || "Company"}${
        report.data.branchName ? ` - ${report.data.branchName}` : ""
      }`;
    }

    window.addEventListener("afterprint", () => { document.title = originalTitle; }, { once: true });

    window.requestAnimationFrame(() => window.print());
  };

  const handleOpenInventory = () => {
    if (!companyId) return;
    erpNav(`/companies/${companyId}/inventory-master/items`);
  };

  const handleOpenInventoryReports = () => {
    if (!companyId) return;
    erpNav(`/companies/${companyId}/inventory-master/reports`);
  };

  const handleOpenFamily = (family: ReportFamily) => {
    if (!companyId) return;

    if (family.route) {
      erpNav("/companies/" + companyId + "/" + family.route);
      return;
    }

    const firstLiveReport = family.liveReportKeys.find((key) =>
      catalog.items.some((report) => report.key === key),
    );

    if (firstLiveReport) {
      handleReportSelect(firstLiveReport);
    }
  };

  const handleRowOpen = async (row: FnbReportRow, page = 1) => {
    if (!row.itemId || !report.appliedQuery) return;

    drilldownAbortRef.current?.abort();
    const controller = new AbortController();
    drilldownAbortRef.current = controller;

    setDrilldownLoading(true);
    setDrilldownError(null);

    try {
      const result = await getFnbReportDrilldown({
        ...report.appliedQuery,
        itemId: row.itemId,
        locationId: typeof row.locationId === "string" ? row.locationId : null,
        consumptionType: row.consumptionType || null,
        uomName: typeof row.uomName === "string" ? row.uomName : null,
        page,
        pageSize: MOVEMENT_PAGE_SIZE,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setDrilldown({ ...result, itemName: result.itemName || row.itemName,
        uomName: result.uomName || String(row.uomName || ""),
        locationName: result.locationName || String(row.locationName || "All locations") });
      setDrilldownRow(row);
    } catch (err) {
      if (controller.signal.aborted) return;
      setDrilldownError(
        err instanceof Error ? err.message : "Failed to load movement drilldown.",
      );
    } finally {
      if (!controller.signal.aborted) setDrilldownLoading(false);
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

  const branchRequired = !selectedBranchId;
  const result = report.data;
  const pendingFilters = !!report.appliedQuery && JSON.stringify(reportQuery) !== JSON.stringify(report.appliedQuery);
  const periodLabel = selectedReport?.supportsAsOfDate || selectedReport?.supportsDateRange ? reportPeriodLabel(
    result,
    { from, to, asOfDate },
    selectedReport?.supportsAsOfDate,
  ) : "Current snapshot";
  const methodology = result?.methodology || REPORT_METHODS[reportKey];
  const drilldownPage = drilldown?.pagination?.page ?? 1;
  const movementTotalRows = drilldown?.pagination?.totalRows ?? drilldown?.ledger.length ?? 0;
  const movementPageCount = Math.max(1, Math.ceil(movementTotalRows / (drilldown?.pagination?.pageSize ?? MOVEMENT_PAGE_SIZE)));
  const focus = reportFocus(reportKey);
  const liveReportKeys = new Set(catalog.items.map((item) => item.key));
  const liveCategories = new Set(catalog.items.map((item) => item.category).filter(Boolean)).size;

  return (
    <div className="fnb-page">
      <header className="fnb-header">
        <div>
          <p className="fnb-kicker">ERP Reports</p>
          <h1 className="fnb-title">F&amp;B Control Center</h1>
          <p className="fnb-subtitle">
            Consumption, valuation, FIFO aging, dead-stock, and stock turnover reports.
          </p>
        </div>

        <div className="fnb-header-actions">
          <button type="button" className="fnb-btn" onClick={handleOpenInventoryReports}>
            Inventory Reports
          </button>
          <button type="button" className="fnb-btn" onClick={handleOpenInventory}>
            Item Master
          </button>
        </div>
      </header>

      {branchRequired ? (
        <div className="fnb-alert">
          Select a branch to run branch-scoped F&amp;B reports.
        </div>
      ) : null}

      {catalog.error ? <div className="fnb-alert">{catalog.error}</div> : null}
      {locations.error ? <div className="fnb-alert">{locations.error}</div> : null}
      {departmentLoadError ? <div className="fnb-alert">{departmentLoadError}</div> : null}
      {report.error ? <div className="fnb-alert">{report.error}</div> : null}

      <section className="fnb-overview" aria-label="F&B reporting status">
        <div className="fnb-overview-main">
          <span>Report console</span>
          <strong>{catalog.items.length} available reports</strong>
          <small>{liveCategories} categories / reporting for the selected branch</small>
        </div>
        <div className="fnb-overview-actions">
          <button type="button" className="fnb-btn" onClick={handleOpenInventoryReports}>
            Inventory Workspace
          </button>
          <button type="button" className="fnb-btn" onClick={() => setShowReportMap((value) => !value)}>
            {showReportMap ? "Hide Report Map" : "Show Report Map"}
          </button>
        </div>
      </section>

      {showReportMap ? (
        <section className="fnb-family-grid" aria-label="F&B report families">
          {REPORT_FAMILIES.filter(family => !import.meta.env.PROD || family.key !== "catering").map((family) => {
            const liveCount = family.liveReportKeys.filter((key) => liveReportKeys.has(key)).length;
            const isLive = liveCount > 0;
            const isRouted = Boolean(family.route);
            const canOpen = isLive || isRouted;
            return (
              <button
                key={family.key}
                type="button"
                className={isLive && !isRouted ? "fnb-family-card is-live" : "fnb-family-card"}
                disabled={!canOpen}
                onClick={() => handleOpenFamily(family)}
              >
                <span className="fnb-family-owner">{family.owner}</span>
                <strong>{family.title}</strong>
                <small>{family.description}</small>
                <span className={isRouted ? "fnb-family-status linked" : isLive ? "fnb-family-status live" : "fnb-family-status"}>
                  {isRouted ? "Workspace" : isLive ? String(liveCount) + " live" : "Roadmap"}
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

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
                branchId={selectedBranchId}
                departmentId={departmentId}
                from={from}
                to={to}
                asOfDate={asOfDate}
                locationId={locationId}
                days={days}
                search={search}
                locations={locations.items}
                departments={departments}
                loadingDepartments={departmentsLoading}
                loadingLocations={locations.loading}
                hasResult={!!result}
                onDepartmentChange={(nextDepartmentId) => {
                  setDepartmentId(nextDepartmentId);
                  setDrilldown(null);
                  setDrilldownError(null);
                  report.clear();
                }}
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

              {pendingFilters ? <div className="fnb-alert" role="status">Filters have changed. Run the report to apply them. The displayed results, CSV, printout, and movement details use the last completed report.</div> : null}

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

              {methodology ? <section className="fnb-methodology" aria-label="Report methodology"><strong>Report basis</strong><p>{methodology}</p></section> : null}

              {result ? (
                <section className="fnb-report-context" aria-label="Report context">
                  {[
                    ["Period", periodLabel],
                    ["Status", result.periodStatus || "Open"],
                    ["Costing", result.costingMethod || "Configured"],
                    ["Currency", result.currencyCode || "-"],
                    ["Generated", formatReportDateTime(result.generatedAtUtc, result.timeZone)],
                    ["Time zone", result.timeZone || "-"],
                    ["Generated by", result.generatedBy || "-"],
                    ["Scope", result.filterSummary || "-"],
                  ].map(([label, value]) => (
                    <div className="fnb-context-pill" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
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

              {result?.reconciliation ? (
                <section className="fnb-methodology" aria-label="Inventory reconciliation">
                  <strong>Inventory reconciliation: {result.reconciliation.isReconciled ? "Reconciled" : "Difference requires review"}</strong>
                  <p>Current stock balances compared with the posted inventory ledger at report generation.</p>
                  <div className="fnb-report-context">
                    {[
                      ["Stock balance value", result.reconciliation.inventoryValue],
                      ["Ledger value", result.reconciliation.ledgerValue],
                      ["Difference", result.reconciliation.difference],
                    ].map(([label, value]) => <div className="fnb-context-pill" key={String(label)}><span>{label}</span><strong>{formatReportMoney(value, result.currencyCode)}</strong></div>)}
                  </div>
                </section>
              ) : null}

              <FnbReportKpis
                kpis={result?.kpis ?? []}
                rowsShown={filteredRows.length}
                currencyCode={result?.currencyCode}
              />

              {result && search.trim() ? <div className="fnb-result-scope" role="status">Search: “{search.trim()}” · {filteredRows.length} of {result.rows.length} rows. KPI totals cover the full report; the table, insights, CSV, and print detail show the matching rows.</div> : null}

              <ReportInsightPanel
                focus={focus}
                rows={filteredRows}
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
                        {formatReportNumber(drilldown.summary?.totalQty)} net {drilldown.uomName || "qty"} /{" "}
                        {formatReportMoney(drilldown.summary?.totalValue, result?.currencyCode)}
                      </p>
                      {reportKey === "fifo-aging" ? <p>Item stock ledger — all receipt ages</p> : null}
                      <p>Movement details generated {formatReportDateTime(drilldown.generatedAtUtc, result?.timeZone)}. Later postings may change movement totals.</p>
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
                          drilldown.ledger.map((line, index) => (
                            <tr key={`${line.id ?? index}`}>
                              <td>{formatReportDateTime(String(line.postedAtUtc ?? ""), result?.timeZone)}</td>
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
                  <nav className="fnb-movement-pagination" aria-label="Movement pages">
                    <span>{movementTotalRows} movements · Page {drilldownPage} of {movementPageCount}. Totals cover all matching movements.</span>
                    <div className="fnb-toolbar">
                      <Button type="button" variant="outline" size="sm" disabled={drilldownPage <= 1 || !drilldownRow} onClick={() => drilldownRow && void handleRowOpen(drilldownRow, drilldownPage - 1)}>Previous</Button>
                      <Button type="button" variant="outline" size="sm" disabled={drilldownPage >= movementPageCount || !drilldownRow} onClick={() => drilldownRow && void handleRowOpen(drilldownRow, drilldownPage + 1)}>Next</Button>
                    </div>
                  </nav>
                </section>
              ) : null}

              <FnbReportTable
                columns={result?.columns ?? []}
                rows={filteredRows}
                loading={report.loading}
                reportName={result?.reportName ?? selectedReport.name}
                currencyCode={result?.currencyCode}
                hasRun={!!result}
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
