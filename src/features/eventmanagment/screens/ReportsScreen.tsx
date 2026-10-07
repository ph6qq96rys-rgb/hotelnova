// src/features/eventmanagment/screens/ReportsScreen.tsx
//
// Catering reports: KPIs from GET /catering/dashboard/kpis (last 30 days by default)
// plus the event-scoped financial panels.

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Package } from "lucide-react";
import { getCateringKpis, type CateringKpiDashboardDto, type CateringKpiMetricDto } from "../api/cateringManagementApi";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { formatDay as formatDate } from "../sales/ui";

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <header className="erp-panel-header">
      <h3>{title}</h3>
      {meta ? <span>{meta}</span> : null}
    </header>
  );
}

type ReportsScreenProps = {
  companyId: string;
  branchId: string;
};

type DashboardState = {
  loading: boolean;
  error: string | null;
  data: CateringKpiDashboardDto | null;
};

function formatMetric(metric: CateringKpiMetricDto, currencyCode: string): string {
  if (metric.unit === "money") return formatCurrency(metric.value, currencyCode);
  if (metric.unit === "percent") return `${metric.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  return metric.value.toLocaleString();
}

export function ReportsScreen({ companyId, branchId }: ReportsScreenProps) {
  const [state, setState] = useState<DashboardState>({ loading: false, error: null, data: null });

  useEffect(() => {
    if (!companyId) {
      setState({ loading: false, error: "Select a company workspace to load reports.", data: null });
      return;
    }

    const controller = new AbortController();
    setState({ loading: true, error: null, data: null });

    void (async () => {
      try {
        const data = await getCateringKpis(companyId, { branchId, signal: controller.signal });
        if (!controller.signal.aborted) setState({ loading: false, error: null, data });
      } catch (error) {
        if (!controller.signal.aborted) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          setState({
            loading: false,
            error: status === 403 ? "You do not have access to catering KPIs." : "Catering KPIs could not be loaded.",
            data: null,
          });
        }
      }
    })();

    return () => controller.abort();
  }, [branchId, companyId]);

  const data = state.data;
  const currency = data?.currencyCode ?? "";

  return (
    <div className="erp-stack">
      <header className="erp-screen-header">
        <div className="erp-screen-title">
          <span>
            <BarChart3 size={18} />
          </span>
          <div>
            <h2>Reports</h2>
            <p>Catering KPIs, top packages and event financial analysis.</p>
          </div>
        </div>
        {data ? (
          <small>
            {formatDate(data.fromUtc)} – {formatDate(data.toUtc)}
          </small>
        ) : null}
      </header>

      {state.error ? (
        <div className="erp-event-alert" role="alert">
          <AlertTriangle size={17} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <section className="erp-panel">
        <PanelHeader meta={data ? `${data.metrics.length} indicators` : undefined} title="Key indicators" />
        {state.loading ? (
          <p className="erp-record-empty" role="status">
            Loading indicators.
          </p>
        ) : data && data.metrics.length ? (
          <div className="erp-event-kpis">
            {data.metrics.map((metric) => (
              <article className="erp-metric tone-info" key={metric.key} title={metric.helpText ?? undefined}>
                <span>{metric.label}</span>
                <strong>{formatMetric(metric, currency)}</strong>
                {metric.helpText ? <small>{metric.helpText}</small> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="erp-record-empty">No indicators returned.</p>
        )}
      </section>

      <div className="erp-split">
        <section className="erp-panel">
          <PanelHeader meta={data ? `${data.topPackages.length} packages` : undefined} title="Top packages" />
          {data && data.topPackages.length ? (
            <ul className="erp-task-list">
              {data.topPackages.map((item) => (
                <li key={item.packageName}>
                  <span className="erp-task-list__icon">
                    <Package size={15} />
                  </span>
                  <div>
                    <strong>{item.packageName}</strong>
                    <small>
                      {item.eventCount} events · {item.guestCount} guests · {formatCurrency(item.revenue, currency)}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="erp-record-empty">
              {state.loading ? "Loading packages." : "No package sales in this period."}
            </p>
          )}
        </section>

        <section className="erp-panel">
          <PanelHeader
            meta={data ? `${data.mostProfitableEvents.length} events` : undefined}
            title="Most profitable events"
          />
          {data && data.mostProfitableEvents.length ? (
            <ul className="erp-task-list">
              {data.mostProfitableEvents.map((event) => (
                <li key={event.eventId}>
                  <span className="erp-task-list__icon">
                    <CalendarDays size={15} />
                  </span>
                  <div>
                    <strong>
                      {event.eventNo} · {event.venueName}
                    </strong>
                    <small>
                      {formatDate(event.eventDateUtc)} · {event.guestCount} guests · margin{" "}
                      {formatCurrency(event.contributionMargin, currency)} (
                      {event.contributionMarginPercent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%)
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="erp-record-empty">
              {state.loading ? "Loading events." : "No analysed events in this period."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
