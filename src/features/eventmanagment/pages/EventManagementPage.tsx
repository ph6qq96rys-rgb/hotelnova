import { useLocation } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { CateringLayout } from "../components/CateringLayout";
import SalesWorkbenchPage from "../sales/SalesWorkbenchPage";
import { ButcherySetup } from "../screens/ButcherySetup";
import { ButcheryWorkbench } from "../screens/ButcheryWorkbench";
import { CutStock } from "../screens/CutStock";
import { EventOperations } from "../screens/EventOperations";
import { OrderPipeline } from "../screens/OrderPipeline";
import { PackagesScreen } from "../screens/PackagesScreen";
import { ProductionPlanning } from "../screens/ProductionPlanning";
import { ReportsScreen } from "../screens/ReportsScreen";
import "./event-management.css";
import "./catering-workspace.css";

/**
 * Catering and butchery module router. Every operational screen is keyed by a catering event
 * (event-scoped endpoints); the quotation-scoped workspace that called retired endpoints is gone.
 */
export default function EventManagementPage() {
  const { pathname, search } = useLocation();
  const { companyId, branchId } = useAppScope();
  const module = pathname.split("/").pop();
  const view = new URLSearchParams(search).get("view");
  const scope = companyId + branchId;

  if (module === "portal") return <SalesWorkbenchPage />;

  let content;
  if (module === "command" || module === "eventmanagment") {
    content =
      view === "packages" ? (
        <PackagesScreen key={scope} companyId={companyId} branchId={branchId} />
      ) : (
        <OrderPipeline companyId={companyId} branchId={branchId} calendar={view === "calendar"} />
      );
  } else if (module === "butchery") {
    content =
      view === "production" ? (
        <ProductionPlanning key={scope} companyId={companyId} branchId={branchId} />
      ) : view === "stock" ? (
        <CutStock key={scope} companyId={companyId} branchId={branchId} />
      ) : view === "setup" ? (
        <ButcherySetup key={scope} companyId={companyId} branchId={branchId} />
      ) : (
        <ButcheryWorkbench key={scope} companyId={companyId} branchId={branchId} />
      );
  } else if (module === "event" || module === "kitchen" || module === "finance" || module === "inventory") {
    content = <EventOperations key={scope + module} companyId={companyId} branchId={branchId} mode={module} />;
  } else if (module === "reports") {
    content = (
      <section className="co-workspace">
        <ReportsScreen key={scope} companyId={companyId} branchId={branchId} />
      </section>
    );
  } else {
    content = <OrderPipeline companyId={companyId} branchId={branchId} calendar={false} />;
  }
  return <CateringLayout>{content}</CateringLayout>;
}
