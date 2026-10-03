// src/features/eventmanagment/screens/ReportsScreen.tsx
//
// The Reports route has existed in routeConfig since the module was added, but
// no ReportsScreen was ever written and moduleFromParam did not recognise
// "reports" — so clicking Reports silently rendered the Command screen. This is
// that missing screen.
//
// It reads the catering KPI dashboard endpoint, which the UI never called, and
// pairs it with the event-scoped financial analysis panels.

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, ListChecks } from "lucide-react";
import {
  getCateringDashboard,
  type CateringEventScopedSnapshot,
  type EventDashboardDto,
} from "../api/cateringManagementApi";
import { PanelHeader, StatusBadge } from "../pages/erp/EventManagementShared";
import { formatDate } from "../pages/erp/eventManagementUtils";
import { FinalBillsPanel, ProfitabilityPanel, ReconciliationsPanel } from "./OperationsPanels";

type ReportsScreenProps = {
  companyId: string;
  branchId: string;
  workspace: CateringEventScopedSnapshot | null;
};

type DashboardState = {
  loading: boolean;
  error: string | null;
  data: EventDashboardDto | null;
};

export function ReportsScreen({ companyId, branchId, workspace }: ReportsScreenProps) {
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
        const data = await getCateringDashboard(companyId, { branchId, signal: controller.signal });
        if (!controller.signal.aborted) setState({ loading: false, error: null, data });
      } catch {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: "The catering dashboard endpoint did not return data.",
            data: null,
          });
        }
      }
    })();

    return () => controller.abort();
  }, [branchId, companyId]);

  return (
    <div className="erp-stack">
      <header className="erp-screen-header">
        <div className="erp-screen-title">
          <span>
            <BarChart3 size={18} />
          </span>
          <div>
            <h2>Reports</h2>
            <p>Catering KPIs, outstanding tasks and event financial analysis.</p>
          </div>
        </div>
        {state.data ? <small>Generated {formatDate(state.data.generatedAtUtc)}</small> : null}
      </header>

      {state.error ? (
        <div className="erp-event-alert" role="status">
          <AlertTriangle size={17} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <section className="erp-panel">
        <PanelHeader
          meta={state.data ? `${state.data.cards.length} indicators` : undefined}
          title="Key indicators"
        />
        {state.loading ? (
          <p className="erp-record-empty">Loading indicators.</p>
        ) : state.data && state.data.cards.length ? (
          <div className="erp-event-kpis">
            {state.data.cards.map((card) => (
              <article className={`erp-metric tone-${toneFromSeverity(card.severity)}`} key={card.key}>
                <span>{card.title}</span>
                <strong>
                  {card.value.toLocaleString()}
                  {card.unit ? ` ${card.unit}` : ""}
                </strong>
                <small>{card.severity}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="erp-record-empty">No indicators returned.</p>
        )}
      </section>

      <div className="erp-split">
        <section className="erp-panel">
          <PanelHeader
            meta={state.data ? `${state.data.tasks.length} open` : undefined}
            title="Outstanding tasks"
          />
          {state.data && state.data.tasks.length ? (
            <ul className="erp-task-list">
              {state.data.tasks.map((task) => (
                <li key={task.key}>
                  <span className="erp-task-list__icon">
                    <ListChecks size={15} />
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {task.area}
                      {task.dueAtUtc ? ` · due ${formatDate(task.dueAtUtc)}` : ""}
                    </small>
                  </div>
                  <StatusBadge status={task.severity} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="erp-record-empty">
              {state.loading ? "Loading tasks." : "No outstanding tasks reported."}
            </p>
          )}
        </section>

        <section className="erp-panel">
          <PanelHeader
            meta={state.data ? `${state.data.upcomingEvents.length} scheduled` : undefined}
            title="Upcoming events"
          />
          {state.data && state.data.upcomingEvents.length ? (
            <ul className="erp-task-list">
              {state.data.upcomingEvents.map((event) => (
                <li key={event.eventQuotationId}>
                  <span className="erp-task-list__icon">
                    <CalendarDays size={15} />
                  </span>
                  <div>
                    <strong>
                      {event.reference} · {event.customerName}
                    </strong>
                    <small>
                      {event.eventType} · {event.guestCount} guests ·{" "}
                      {formatDate(event.eventStartUtc)}
                    </small>
                  </div>
                  <StatusBadge status={event.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="erp-record-empty">
              {state.loading ? "Loading events." : "No upcoming events scheduled."}
            </p>
          )}
        </section>
      </div>

      <ProfitabilityPanel workspace={workspace} />
      <FinalBillsPanel workspace={workspace} />
      <ReconciliationsPanel workspace={workspace} />
    </div>
  );
}

function toneFromSeverity(severity: string): string {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "warning") return "warning";
  if (normalized === "success") return "success";
  return "info";
}
