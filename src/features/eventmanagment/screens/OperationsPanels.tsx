// src/features/eventmanagment/screens/OperationsPanels.tsx
//
// Panels for the event sub-resources the backend has always returned but the
// UI never rendered: equipment plans, staffing plans, dispatch notes, returns,
// waste, reconciliations, final bills and profitability.
//
// getCateringEventScopedSnapshot already fetches all of these, so no new
// requests are introduced — this is the missing presentation layer. Column keys
// are taken from the catering DTO records in RestaurantFNB.Application.
//
// Both camelCase and PascalCase spellings are offered for each field because
// the API serialises camelCase while some endpoints return raw records.

import type { ReactNode } from "react";
import type { CateringEventScopedSnapshot } from "../api/cateringManagementApi";
import { RecordTable, type RecordColumn } from "../components/RecordTable";
import { PanelHeader } from "../pages/erp/EventManagementShared";
import { activeRows } from "../workspace/record";

function keys(name: string): string[] {
  return [name, name.charAt(0).toUpperCase() + name.slice(1)];
}

const equipmentColumns: RecordColumn[] = [
  { label: "Plan", keys: keys("planNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Planned", keys: keys("plannedAtUtc"), format: "date" },
  { label: "Required", keys: keys("requiredLineCount"), format: "number", align: "end" },
  { label: "Allocated", keys: keys("allocatedLineCount"), format: "number", align: "end" },
  { label: "Short", keys: keys("shortLineCount"), format: "number", align: "end" },
];

const staffingColumns: RecordColumn[] = [
  { label: "Plan", keys: keys("planNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Planned", keys: keys("plannedAtUtc"), format: "date" },
  { label: "Required", keys: keys("requiredCount"), format: "number", align: "end" },
  { label: "Assigned", keys: keys("assignedCount"), format: "number", align: "end" },
  { label: "Confirmed", keys: keys("confirmedCount"), format: "number", align: "end" },
];

const dispatchColumns: RecordColumn[] = [
  { label: "Dispatch", keys: keys("dispatchNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Destination", keys: keys("destination") },
  { label: "Vehicle", keys: keys("vehicleNo") },
  { label: "Driver", keys: keys("driverEmployeeName") },
  { label: "Planned", keys: keys("plannedDispatchAtUtc"), format: "date" },
  { label: "Delivered", keys: keys("deliveredAtUtc"), format: "date" },
];

const returnColumns: RecordColumn[] = [
  { label: "Return", keys: keys("returnNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Returned", keys: keys("returnedAtUtc"), format: "date" },
  { label: "Received by", keys: keys("receivedByEmployeeName") },
  { label: "Issued", keys: keys("totalIssuedQuantity"), format: "number", align: "end" },
  { label: "Returned qty", keys: keys("totalReturnedQuantity"), format: "number", align: "end" },
  { label: "Consumed", keys: keys("totalActualConsumption"), format: "number", align: "end" },
];

const wasteColumns: RecordColumn[] = [
  { label: "Waste", keys: keys("wasteNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Recorded", keys: keys("recordedAtUtc"), format: "date" },
  { label: "Reported by", keys: keys("reportedByEmployeeName") },
  { label: "Quantity", keys: keys("totalWasteQuantity"), format: "number", align: "end" },
  { label: "Est. cost", keys: keys("totalEstimatedCost"), format: "currency", align: "end" },
];

const finalBillColumns: RecordColumn[] = [
  { label: "Bill", keys: keys("billNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Bill date", keys: keys("billDateUtc"), format: "date" },
  { label: "Contract guests", keys: keys("contractGuestCount"), format: "number", align: "end" },
  { label: "Actual guests", keys: keys("actualGuestCount"), format: "number", align: "end" },
  { label: "Per person", keys: keys("pricePerPerson"), format: "currency", align: "end" },
  { label: "Contract", keys: keys("contractAmount"), format: "currency", align: "end" },
];

const profitabilityColumns: RecordColumn[] = [
  { label: "Analysis", keys: keys("analysisNo") },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Calculated", keys: keys("calculatedAtUtc"), format: "date" },
  { label: "Revenue", keys: keys("revenueAmount"), format: "currency", align: "end" },
  { label: "Food cost", keys: keys("foodCostAmount"), format: "currency", align: "end" },
  { label: "Direct cost", keys: keys("totalDirectCostAmount"), format: "currency", align: "end" },
  { label: "Margin", keys: keys("contributionMarginAmount"), format: "currency", align: "end" },
  { label: "Margin %", keys: keys("contributionMarginPercent"), format: "percent", align: "end" },
];

const reconciliationColumns: RecordColumn[] = [
  { label: "Reference", keys: [...keys("reconciliationNo"), ...keys("documentNo"), ...keys("id")] },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Run at", keys: [...keys("calculatedAtUtc"), ...keys("createdAtUtc"), ...keys("runAtUtc")], format: "date" },
];

const productionColumns: RecordColumn[] = [
  { label: "Plan", keys: [...keys("planNo"), ...keys("documentNo")] },
  { label: "Status", keys: keys("status"), format: "status" },
  { label: "Planned", keys: [...keys("plannedAtUtc"), ...keys("createdAtUtc")], format: "date" },
  { label: "Lines", keys: [...keys("lineCount"), ...keys("requiredLineCount")], format: "number", align: "end" },
];

function Panel({
  title,
  rows,
  columns,
  empty,
  children,
}: {
  title: string;
  rows: unknown;
  columns: RecordColumn[];
  empty: string;
  children?: ReactNode;
}) {
  const count = activeRows(rows).length;
  return (
    <section className="erp-panel">
      <PanelHeader meta={count ? `${count} active` : undefined} title={title} />
      <RecordTable columns={columns} empty={empty} rows={rows} />
      {children}
    </section>
  );
}

type PanelProps = { workspace: CateringEventScopedSnapshot | null };

export function EquipmentPlansPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={equipmentColumns}
      empty="No equipment plan generated for this event yet."
      rows={workspace?.equipmentPlans}
      title="Equipment plans"
    />
  );
}

export function StaffingPlansPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={staffingColumns}
      empty="No staffing plan generated for this event yet."
      rows={workspace?.staffingPlans}
      title="Staffing plans"
    />
  );
}

export function DispatchPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={dispatchColumns}
      empty="Nothing dispatched to the venue yet."
      rows={workspace?.dispatches}
      title="Dispatch notes"
    />
  );
}

export function ReturnsPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={returnColumns}
      empty="No returns recorded. Returns drive actual consumption in reconciliation."
      rows={workspace?.returns}
      title="Returns"
    />
  );
}

export function WastePanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={wasteColumns}
      empty="No waste recorded for this event."
      rows={workspace?.waste}
      title="Waste"
    />
  );
}

export function ReconciliationsPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={reconciliationColumns}
      empty="Consumption has not been reconciled yet."
      rows={workspace?.reconciliations}
      title="Reconciliations"
    />
  );
}

export function ProductionPlansPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={productionColumns}
      empty="No production plan generated from the menu yet."
      rows={workspace?.productionPlans}
      title="Production plans"
    />
  );
}

export function FinalBillsPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={finalBillColumns}
      empty="No final bill prepared. Reconciliation normally precedes billing."
      rows={workspace?.finalBills}
      title="Final bills"
    />
  );
}

export function ProfitabilityPanel({ workspace }: PanelProps) {
  return (
    <Panel
      columns={profitabilityColumns}
      empty="No profitability analysis calculated for this event."
      rows={workspace?.profitability}
      title="Profitability"
    />
  );
}
