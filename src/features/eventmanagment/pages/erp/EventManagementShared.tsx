import type { ReactNode } from "react";
import { AlertTriangle, ClipboardCheck, ShieldCheck } from "lucide-react";
import { formatCurrency } from "../../../../shared/currency/currencyFormat";
import type { CateringOperationalSnapshot, CateringPackageSummaryDto, EventQuotationSummaryDto } from "../../api/cateringManagementApi";
import type { Metric, Risk } from "./eventManagementTypes";
import { formatDate, readinessLabel, toneFor } from "./eventManagementUtils";

export function MetricCard({ metric }: { metric: Metric }) {
  return <article className={`erp-metric tone-${metric.tone}`}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>;
}

export function ContextPanel({ quotation, snapshot, loading, risks }: { quotation: EventQuotationSummaryDto | null; snapshot: CateringOperationalSnapshot | null; loading: boolean; risks: Risk[] }) {
  if (!quotation) {
    return <section className="erp-context-panel erp-context-panel--empty"><div className="erp-empty-state"><ClipboardCheck size={22} /><strong>No event selected</strong><span>Choose a quotation from the workbench.</span></div></section>;
  }

  return (
    <section className="erp-context-panel">
      <div className="erp-context-hero">
        <span>{loading ? "Loading" : quotation.status}</span>
        <strong>{quotation.reference} / {quotation.customerName}</strong>
        <small>{quotation.eventType} / {quotation.guestCount} guests</small>
      </div>
      <div className="erp-context-facts">
        <span>Date</span>
        <strong>{formatDate(quotation.eventStartUtc)}</strong>
        <span>Quote value</span>
        <strong>{formatCurrency(quotation.currentVersion?.totalAmount ?? 0)}</strong>
        <span>Deposit</span>
        <strong>{formatCurrency(quotation.currentVersion?.depositAmount ?? 0)}</strong>
        <span>Menu</span>
        <strong>{snapshot?.menuPlan?.status ?? "Pending"}</strong>
        <span>Inventory</span>
        <strong>{snapshot?.inventoryReservation?.status ?? "Pending"}</strong>
        <span>Closure</span>
        <strong>{readinessLabel(snapshot?.closureReadiness?.canClose)}</strong>
      </div>
      <NextActionStrip quotation={quotation} snapshot={snapshot} riskCount={risks.length} />
    </section>
  );
}

function NextActionStrip({ quotation, snapshot, riskCount }: { quotation: EventQuotationSummaryDto; snapshot: CateringOperationalSnapshot | null; riskCount: number }) {
  const version = quotation.currentVersion;
  const needsApproval = Boolean(version?.requiresApproval && version.approvalStatus !== "Approved");
  const menuStatus = snapshot?.menuPlan?.status ?? "Pending";
  const inventoryStatus = snapshot?.inventoryReservation?.status ?? "Pending";
  const canClose = snapshot?.closureReadiness?.canClose === true;
  const actions = [
    { role: "Sales", action: needsApproval ? "Approve quotation" : "Quote accepted", detail: needsApproval ? "Manager approval owns the gate." : "Customer terms are ready.", tone: needsApproval ? "warning" : "success" },
    { role: "Kitchen", action: menuStatus === "Approved" ? "Menu approved" : "Finalize menu plan", detail: "Recipes, portions, diet notes.", tone: menuStatus === "Approved" ? "success" : "info" },
    { role: "Inventory", action: inventoryStatus === "Reserved" ? "Stock reserved" : "Forecast and reserve", detail: "Shortages, SIV, issue timing.", tone: inventoryStatus === "Reserved" ? "success" : "info" },
    { role: "Finance", action: canClose ? "Ready to close" : "Clear close blockers", detail: `${riskCount} exception${riskCount === 1 ? "" : "s"} tracked.`, tone: canClose ? "success" : "warning" },
  ];

  return (
    <div className="erp-next-actions" aria-label="Next role actions">
      {actions.map((item) => (
        <article className={`erp-action-chip tone-${item.tone}`} key={item.role}>
          <span>{item.role}</span>
          <strong>{item.action}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </div>
  );
}
export function ScreenHeader({ icon, title, subtitle, action, onAction }: { icon: ReactNode; title: string; subtitle: string; action: string; onAction?: () => void }) {
  return <header className="erp-screen-header"><div className="erp-screen-title"><span>{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>{onAction ? <button className="erp-button" onClick={onAction} type="button"><ShieldCheck size={16} />{action}</button> : null}</header>;
}

export function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return <header className="erp-panel-header"><h3>{title}</h3>{meta ? <span>{meta}</span> : null}</header>;
}

export function PackageCard({ item }: { item: CateringPackageSummaryDto }) {
  return <article className="erp-package-card"><div><strong>{item.name}</strong><StatusBadge status={item.publishToPortal ? "Portal" : "Internal"} /></div><span>{item.code} / {item.currentVersion?.pricingType ?? "Pricing"}</span><p>{item.description || "No description configured."}</p><small>{formatCurrency(item.currentVersion?.basePrice ?? 0)} / {item.currentVersion?.minimumGuests ?? 0}-{item.currentVersion?.maximumGuests ?? "any"} guests</small></article>;
}

export function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="erp-summary-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status || "Pending";
  return <span className={`erp-status tone-${toneFor(value)}`}>{value}</span>;
}

export function RiskItem({ title, detail, tone }: Risk) {
  return <article className={`erp-risk tone-${tone}`}><AlertTriangle size={15} /><div><strong>{title}</strong><span>{detail}</span></div></article>;
}

export function Checklist({ items }: { items: Array<[string, boolean]> }) {
  return <div className="erp-checklist">{items.map(([label, done]) => <div key={label}><span className={done ? "is-done" : ""}>{done ? <ClipboardCheck size={14} /> : <AlertTriangle size={14} />}</span><strong>{label}</strong><small>{done ? "Ready" : "Needs action"}</small></div>)}</div>;
}


