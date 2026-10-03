import { formatCurrency } from "../../../../shared/currency/currencyFormat";
import type { CateringOperationalSnapshot, EventInquiryDto, EventQuotationSummaryDto } from "../../api/cateringManagementApi";
import type { Metric, Risk, Tone } from "./eventManagementTypes";

export function buildMetrics(inquiries: EventInquiryDto[], quotations: EventQuotationSummaryDto[], snapshot: CateringOperationalSnapshot | null): Metric[] {
  const accepted = quotations.filter((quote) => ["accepted", "confirmed"].includes(quote.status.toLowerCase())).length;
  const quotedValue = quotations.reduce((sum, quote) => sum + (quote.currentVersion?.totalAmount ?? 0), 0);
  const shortageLines = snapshot?.consumptionForecast?.lines.filter((line) => line.shortageQuantity > 0).length ?? 0;
  return [
    { label: "Open leads", value: `${inquiries.length}`, detail: "Customer requests", tone: inquiries.length ? "info" : "neutral" },
    { label: "Active quotations", value: `${quotations.length}`, detail: `${accepted} accepted or confirmed`, tone: accepted ? "success" : "warning" },
    { label: "Quoted value", value: formatCurrency(quotedValue), detail: "Pipeline value", tone: "info" },
    { label: "Menu readiness", value: snapshot?.menuPlan?.status ?? "Draft", detail: `${snapshot?.menuPlan?.lines.length ?? 0} menu lines`, tone: snapshot?.menuPlan?.status === "Approved" ? "success" : "warning" },
    { label: "Stock gaps", value: `${shortageLines}`, detail: "Forecast shortages", tone: shortageLines ? "critical" : "success" },
    { label: "Close gate", value: readinessLabel(snapshot?.closureReadiness?.canClose), detail: `${snapshot?.closureReadiness?.outstandingActions.length ?? 0} blockers`, tone: snapshot?.closureReadiness?.canClose ? "success" : "warning" },
  ];
}

export function buildRiskQueue(snapshot: CateringOperationalSnapshot | null, quotations: EventQuotationSummaryDto[]): Risk[] {
  const risks: Risk[] = [];
  const pendingApprovals = quotations.filter((quote) => quote.currentVersion?.requiresApproval && quote.currentVersion.approvalStatus.toLowerCase() !== "approved");
  if (pendingApprovals.length) risks.push({ title: "Quotation approval pending", detail: `${pendingApprovals.length} quote versions need commercial approval.`, tone: "warning" });
  const shortages = snapshot?.consumptionForecast?.lines.filter((line) => line.shortageQuantity > 0) ?? [];
  if (shortages.length) risks.push({ title: "Inventory shortage", detail: `${shortages.length} forecast lines are short before reservation.`, tone: "critical" });
  if (snapshot?.menuPlan && snapshot.menuPlan.status !== "Approved") risks.push({ title: "Menu not approved", detail: "Production and inventory should wait for approved menu plan.", tone: "warning" });
  if (snapshot?.closureReadiness && !snapshot.closureReadiness.canClose) risks.push({ title: "Closure blocked", detail: `${snapshot.closureReadiness.outstandingActions.length} finance or operations gates remain.`, tone: "warning" });
  if (!risks.length) risks.push({ title: "Workspace stable", detail: "No critical exceptions detected for the selected event.", tone: "success" });
  return risks;
}

export function readinessLabel(value?: boolean) {
  if (value === true) return "Ready";
  if (value === false) return "Blocked";
  return "Pending";
}

export function toneFor(status: string): Tone {
  const normalized = status.toLowerCase();
  if (["cancelled", "lost", "short", "blocked", "critical", "high", "rejected"].some((token) => normalized.includes(token))) return "critical";
  if (["pending", "draft", "medium", "review", "approval", "internal"].some((token) => normalized.includes(token))) return "warning";
  if (["approved", "accepted", "confirmed", "ready", "reserved", "portal", "posted", "closed", "recipe"].some((token) => normalized.includes(token))) return "success";
  if (["new", "qualified", "info"].some((token) => normalized.includes(token))) return "info";
  return "neutral";
}

export function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
