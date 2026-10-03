import type { ReactNode } from "react";
import type { CateringOperationalSnapshot, CateringPackageSummaryDto, EventInquiryDto, EventQuotationSummaryDto } from "../../api/cateringManagementApi";

// "reports" is routed in routeConfig.tsx but was missing from this union, so
// moduleFromParam fell through to "command" and the Reports nav item silently
// rendered the Command screen.
export type ModuleKey = "command" | "sales" | "event" | "kitchen" | "butchery" | "inventory" | "finance" | "reports" | "portal";
export type Tone = "critical" | "warning" | "success" | "info" | "neutral";

export type LoadState = {
  loading: boolean;
  error: string | null;
  inquiries: EventInquiryDto[];
  quotations: EventQuotationSummaryDto[];
  packages: CateringPackageSummaryDto[];
  snapshot: CateringOperationalSnapshot | null;
};

export type Metric = { label: string; value: string; detail: string; tone: Tone };
export type Risk = { title: string; detail: string; tone: Tone };
export type ModuleDefinition = { key: ModuleKey; label: string; caption: string; icon: ReactNode };
export type LiteMenuLine = { id: string; courseName: string; menuItemName: string; quantity: number; expectedYieldQuantity: number; requiresRecipe: boolean };
export type LiteRequirement = { id: string; requirementType: string; description: string; severity: string };
export type LiteReservationLine = { id: string; inventoryItemName: string; reservedQuantity: number; status: string };
