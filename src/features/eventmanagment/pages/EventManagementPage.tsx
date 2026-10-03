import { ProductionPlanning } from "../screens/ProductionPlanning";
import { CutStock } from "../screens/CutStock";
import { ButcherySetup } from "../screens/ButcherySetup";
import { EventOperations } from "../screens/EventOperations";
import { EventDocuments } from "../screens/EventDocuments";
import { ButcheryWorkbench } from "../screens/ButcheryWorkbench";
import { CateringLayout } from "../components/CateringLayout";
import { OrderPipeline } from "../screens/OrderPipeline";
import { PackagesScreen } from "../screens/PackagesScreen";
import SalesWorkbenchPage from "../sales/SalesWorkbenchPage";
import { useCallback, useMemo } from "react";
import { AlertTriangle, FlaskConical, RefreshCw, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { getOrCreateCateringEventForQuotation } from "../api/cateringManagementApi";
import type { ModuleKey } from "./erp/eventManagementTypes";
import { buildMetrics, buildRiskQueue } from "./erp/eventManagementUtils";
import { ContextPanel, MetricCard } from "./erp/EventManagementShared";
import {
  ButcheryScreen,
  CommandScreen,
  EventOpsScreen,
  FinanceScreen,
  InventoryScreen,
  KitchenScreen,
  PortalScreen,
  SalesScreen,
} from "./erp/EventManagementScreens";
import { ActionCenter } from "../components/ActionCenter";
import { EventLifecycleRail } from "../components/EventLifecycleRail";
import {
  DispatchPanel,
  EquipmentPlansPanel,
  FinalBillsPanel,
  ProductionPlansPanel,
  ProfitabilityPanel,
  ReconciliationsPanel,
  ReturnsPanel,
  StaffingPlansPanel,
  WastePanel,
} from "../screens/OperationsPanels";
import { ReportsScreen } from "../screens/ReportsScreen";
import { actionsForModule, type ActionContext } from "../workspace/eventActions";
import { buildLifecycle } from "../workspace/lifecycle";
import { isSampleRecord, useCateringWorkspace } from "../workspace/useCateringWorkspace";
import "./event-management.css";
import "./catering-workspace.css";

const moduleLabels: Record<ModuleKey, string> = {
  command: "Order pipeline",
  sales: "Sales",
  event: "Event Ops",
  kitchen: "Kitchen",
  butchery: "Butchery",
  inventory: "Inventory",
  finance: "Finance",
  reports: "Reports",
  portal: "Customer Portal",
};

const moduleKeys = Object.keys(moduleLabels) as ModuleKey[];

function moduleFromParam(value?: string): ModuleKey {
  const normalized = (value ?? "command").toLowerCase();
  return (moduleKeys as string[]).includes(normalized) ? (normalized as ModuleKey) : "command";
}

function OperationalWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathParts = location.pathname.split("/").filter(Boolean);
  const searchParams = new URLSearchParams(location.search);
  const activeModule = moduleFromParam(pathParts[pathParts.length - 1]);
  const sourceGrnId = searchParams.get("source") === "grn" ? searchParams.get("grnId") : null;

  const { companyId, branchId } = useAppScope();
  const workspace = useCateringWorkspace(companyId, branchId);

  const {
    quotations,
    inquiries,
    packages,
    selectedQuotation,
    selectQuotation,
    quotationSnapshot,
    eventWorkspace,
    eventLoading,
  } = workspace;

  const metrics = useMemo(
    () => buildMetrics(inquiries, quotations, quotationSnapshot),
    [inquiries, quotationSnapshot, quotations],
  );
  const risks = useMemo(
    () => buildRiskQueue(quotationSnapshot, quotations),
    [quotationSnapshot, quotations],
  );
  const lifecycle = useMemo(
    () => buildLifecycle(eventWorkspace, quotationSnapshot),
    [eventWorkspace, quotationSnapshot],
  );

  const openModule = useCallback(
    (module: string) => {
      const next = [...pathParts];
      next[next.length - 1] = module;
      navigate(`/${next.join("/")}${location.search}`);
    },
    [location.search, navigate, pathParts],
  );

  // Resolving the event lazily keeps every action working from a quotation
  // selection without creating events the operator never asked for.
  const actionContext = useMemo<ActionContext | null>(() => {
    if (!companyId || !selectedQuotation || isSampleRecord(selectedQuotation.id)) return null;
    const quotationId = selectedQuotation.id;
    return {
      companyId,
      quotationId,
      ensureEventId: async () => {
        if (eventWorkspace?.event.id) return eventWorkspace.event.id;
        const event = await getOrCreateCateringEventForQuotation(companyId, quotationId);
        return event.id;
      },
    };
  }, [companyId, eventWorkspace, selectedQuotation]);

  const actionsDisabledReason = actionContext
    ? null
    : workspace.usingSampleData
      ? "Actions are disabled while sample data is shown."
      : "Select a live quotation to run actions.";

  const moduleActions = activeModule === "reports" || activeModule === "sales" || activeModule === "command" || activeModule === "portal"
    ? []
    : actionsForModule(activeModule).filter(a => !["production-plan", "equipment-plan", "staffing-plan", "final-bill-preview"].includes(a.key));

  return (
    <main className="erp-event-shell erp-event-shell--single-nav">
      <section className="erp-event-main">
        <header className="erp-event-topbar">
          <div>
            <span className="erp-eyebrow">Event Management / {moduleLabels[activeModule]}</span>
            <h1>{moduleLabels[activeModule]}</h1>
          </div>
          <div className="erp-event-tools">
            <label className="erp-event-picker" aria-label="Select event">
              <span>Event</span>
              <select
                onChange={(event) => selectQuotation(event.target.value)}
                value={selectedQuotation?.id ?? ""}
              >
                {quotations.length === 0 ? <option value="">No events available</option> : null}
                {quotations.map((quotation) => (
                  <option key={quotation.id} value={quotation.id}>
                    {quotation.reference} · {quotation.customerName}
                    {isSampleRecord(quotation.id) ? " (sample)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-search" aria-label="Search quotations">
              <Search size={16} />
              <input
                onChange={(event) => {
                  const term = event.target.value.trim().toLowerCase();
                  if (!term) return;
                  const match = quotations.find((quotation) =>
                    [quotation.reference, quotation.customerName, quotation.eventType, quotation.status]
                      .join(" ")
                      .toLowerCase()
                      .includes(term),
                  );
                  if (match) selectQuotation(match.id);
                }}
                placeholder="Jump to customer or quote"
              />
            </label>
            <button
              className="erp-icon-button"
              onClick={workspace.refresh}
              title="Refresh workspace"
              type="button"
            >
              <RefreshCw size={17} className={workspace.status === "loading" ? "is-spinning" : ""} />
            </button>
          </div>
        </header>

        {workspace.error ? (
          <div className="erp-event-alert" role="status">
            <AlertTriangle size={17} />
            <span>{workspace.error}</span>
          </div>
        ) : null}

        {workspace.usingSampleData ? (
          <div className="erp-event-alert erp-event-alert--sample" role="status">
            <FlaskConical size={17} />
            <span>
              Showing illustrative sample data because no live quotations were returned. Nothing here
              reflects your database, and actions are disabled.
            </span>
          </div>
        ) : null}

        {workspace.degraded.length ? (
          <div className="erp-event-alert" role="status">
            <AlertTriangle size={17} />
            <span>Could not load: {workspace.degraded.join(", ")}. Those lists are empty rather than estimated.</span>
          </div>
        ) : null}

        {workspace.eventError ? (
          <div className="erp-event-alert" role="status">
            <AlertTriangle size={17} />
            <span>{workspace.eventError}</span>
          </div>
        ) : null}

        <section hidden={activeModule === "butchery"} className="erp-event-kpis" aria-label="Event management KPIs">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        {activeModule !== "butchery" && selectedQuotation && !isSampleRecord(selectedQuotation.id) ? (
          <EventLifecycleRail loading={eventLoading} onOpenModule={openModule} stages={lifecycle} />
        ) : null}

        {activeModule !== "butchery" && <ContextPanel
          loading={workspace.status === "loading"}
          quotation={selectedQuotation}
          risks={risks}
          snapshot={quotationSnapshot}
        />}

        <section className="erp-event-grid">
          <div className="erp-workbench">
            {activeModule === "command" && (
              <CommandScreen
                eventWorkspace={eventWorkspace}
                onSelectQuotation={selectQuotation}
                quotations={quotations}
                risks={risks}
                selectedQuotationId={selectedQuotation?.id ?? null}
                snapshot={quotationSnapshot}
              />
            )}

            {activeModule === "sales" && (
              <SalesScreen
                inquiries={inquiries}
                onSelectQuotation={selectQuotation}
                packages={packages}
                quotations={quotations}
                selectedQuotationId={selectedQuotation?.id ?? null}
              />
            )}

            {activeModule === "event" && (
              <div className="erp-stack">
                <EventOpsScreen
                  eventWorkspace={eventWorkspace}
                  quotation={selectedQuotation}
                  snapshot={quotationSnapshot}
                />
                <EventDocuments key={eventWorkspace?.event.id ?? "none"} event={eventWorkspace?.event ?? null} mode="event" />
              </div>
            )}

            {activeModule === "kitchen" && (
              <div className="erp-stack">
                <KitchenScreen
                  eventWorkspace={eventWorkspace}
                  packages={packages}
                  snapshot={quotationSnapshot}
                />
                <EventDocuments key={eventWorkspace?.event.id ?? "none"} event={eventWorkspace?.event.id ? eventWorkspace.event : null} mode="kitchen" />
              </div>
            )}

            {activeModule === "butchery" && (
              <ButcheryScreen
                quotation={selectedQuotation}
                snapshot={quotationSnapshot}
                sourceGrnId={sourceGrnId}
              />
            )}

            {activeModule === "inventory" && (
              <div className="erp-stack">
                <InventoryScreen eventWorkspace={eventWorkspace} snapshot={quotationSnapshot} />
                <DispatchPanel workspace={eventWorkspace} />
                <ReturnsPanel workspace={eventWorkspace} />
                <WastePanel workspace={eventWorkspace} />
              </div>
            )}

            {activeModule === "finance" && (
              <div className="erp-stack">
                <FinanceScreen
                  eventWorkspace={eventWorkspace}
                  quotation={selectedQuotation}
                  snapshot={quotationSnapshot}
                />
                <ReconciliationsPanel workspace={eventWorkspace} />
                <EventDocuments key={eventWorkspace?.event.id ?? "none"} event={eventWorkspace?.event ?? null} mode="finance" />
                <ProfitabilityPanel workspace={eventWorkspace} />
              </div>
            )}

            {activeModule === "reports" && (
              <ReportsScreen branchId={branchId} companyId={companyId} workspace={eventWorkspace} />
            )}

            {activeModule === "portal" && <PortalScreen packages={packages} />}

            {moduleActions.length ? (
              <ActionCenter
                actions={moduleActions}
                context={actionContext}
                disabledReason={actionsDisabledReason}
                onCompleted={() => workspace.refresh()}
                title={`${moduleLabels[activeModule]} actions`}
              />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

export default function EventManagementPage() {
 const { pathname, search } = useLocation();
 const { companyId, branchId } = useAppScope();
 const module = pathname.split("/").pop();
 const view = new URLSearchParams(search).get("view");
 if (module === "portal") return <SalesWorkbenchPage />;
 return <CateringLayout>{module === "command" || module === "eventmanagment" ? view === "packages" ? <PackagesScreen key={companyId + branchId} companyId={companyId} branchId={branchId}/> : <OrderPipeline companyId={companyId} branchId={branchId} calendar={view === "calendar"}/> : module === "butchery" && view === "production" ? <ProductionPlanning key={companyId + branchId} companyId={companyId} branchId={branchId}/> : module === "butchery" && view === "stock" ? <CutStock key={companyId + branchId} companyId={companyId} branchId={branchId}/> : module === "butchery" && view === "setup" ? <ButcherySetup key={companyId + branchId} companyId={companyId} branchId={branchId}/> : module === "butchery" ? <ButcheryWorkbench key={companyId + branchId} companyId={companyId} branchId={branchId}/> : module === "event" || module === "kitchen" || module === "finance" ? <EventOperations key={companyId + branchId + module} companyId={companyId} branchId={branchId} mode={module}/> : <OperationalWorkspace key={companyId + branchId + module} />}</CateringLayout>;
}
