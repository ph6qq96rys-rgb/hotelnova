export type SivRecommendationDecision =
  | "Approve"
  | "PartiallyApprove"
  | "Review"
  | "Reject";

export type SivRecommendationRisk =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export interface SivApprovalLineInput {
  lineId: string;
  approvedQty: number;
}

export interface SivLineRecommendation {
  sivLineId: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  uomCode: string;
  requestedQty: number;
  recommendedQty: number;
  onHandQty?: number | null;
  reservedQty?: number | null;
  availableQty?: number | null;
  projectedQtyAfterApproval?: number | null;
  weeklyAverageUsage?: number | null;
  toBaseFactor?: number | null;
  onHandBaseQty?: number | null;
  reservedBaseQty?: number | null;
  availableBaseQty?: number | null;
  projectedAvailableBaseQty?: number | null;
  averageWeeklyUsageBaseQty?: number | null;
  weeksOfSupplyBefore?: number | null;
  weeksOfSupplyAfter?: number | null;
  weeksOfSupplyAfterApproval?: number | null;
  earliestExpiryUtc?: string | null;
  inventoryIsBalanced: boolean;
  decision: SivRecommendationDecision;
  riskLevel: SivRecommendationRisk;
  riskScore: number;
  reasons: string[];
  warnings: string[];
}

export interface SivRecommendationResult {
  sivId: string;
  decision: SivRecommendationDecision;
  riskLevel: SivRecommendationRisk;
  riskScore: number;
  summary: string;
  evaluatedAtUtc: string;
  lines: SivLineRecommendation[];
  warnings: string[];
}

export interface SivCopilotExplanation {
  isAiGenerated: boolean;
  headline: string;
  summary: string;
  keyReasons: string[];
  suggestedActions: string[];
  fallbackReason?: string | null;
}

export interface SivApprovalCopilotResponse {
  recommendation: SivRecommendationResult;
  explanation?: SivCopilotExplanation | null;
}

export function decisionLabel(value: SivRecommendationDecision): string {
  switch (value) {
    case "Approve":
      return "Approve";
    case "PartiallyApprove":
      return "Partially approve";
    case "Review":
      return "Review";
    case "Reject":
      return "Reject";
  }
}

export function formatRecommendationNumber(
  value: number | null | undefined,
  maximumFractionDigits = 3,
): string {
  if (value == null || !Number.isFinite(value)) return "-";

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}

export function formatRecommendationDate(
  value: string | null | undefined,
): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
