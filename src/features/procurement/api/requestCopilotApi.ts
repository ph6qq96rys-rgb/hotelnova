import { http } from "../../../api/http";

/** PR-FNB-001 purchase request approval copilot. Advice and evidence only; decisions use the approval endpoints. */
export type CopilotRecommendation = "Approve" | "ReviewRequired" | "ReturnForRevision";
export type CopilotAction = "Warn" | "Review" | "Block";

export type CopilotFinding = { code: string; action: CopilotAction; explanation: string; policyVersionId?: string | null; ruleName?: string | null; revision?: number | null };
export type CopilotEvidence = { ref: string; kind: string; id?: string | null; label: string; quantity?: number | null; unit?: string | null; date?: string | null; status?: string | null; counted: boolean; note?: string | null };
export type CopilotLine = {
  lines: string; lineIds: string[]; itemId?: string | null; itemName: string; baseUnit: string; requestUnit: string;
  requestedQuantity: number; requestedBase?: number | null; usableBase?: number | null; incomingOrdersBase?: number | null; inTransitBase?: number | null;
  dailyConsumption?: number | null; coverageDaysNow?: number | null; coverageDaysAfter?: number | null; demandBase?: number | null; safetyStockBase?: number | null;
  targetBase?: number | null; suggestedBase?: number | null; suggestedRequestUnits?: number | null; proposedBasePrice?: number | null; baselineBasePrice?: number | null;
  priceVariancePercent?: number | null; recommendation: CopilotRecommendation; summary: string; findings: CopilotFinding[]; evidence: CopilotEvidence[]; assumptions: string[];
};
export type CopilotArea = { name: string; status: "Checked" | "Unavailable" | "Failed" | "NotApplicable"; detail?: string | null };
export type CopilotSnapshot = {
  request: { id: string; requisitionNo: string; status: string; requester: string; branch?: string | null; destination?: string | null; requiredByDateUtc: string; justification: string; category: string; priority: string; estimatedTotal: number; missingPrices: number; currency: string };
  recommendation: CopilotRecommendation; summary: string; lines: CopilotLine[]; requestFindings: CopilotFinding[];
  budget?: { status: string; requestValue: number; budgets: { id: string; name: string; amount: number; available: number }[] } | null;
  areas: CopilotArea[]; limitations: string[]; settings: CopilotSettings; ruleVersions: string[]; calculationNote: string;
};
export type CopilotAnalysis = {
  id: string; requisitionId: string; requisitionVersion: string; analyzedAtUtc: string; status: "Current" | "Superseded" | "Failed";
  isStale: boolean; staleReason?: string | null; recommendation: CopilotRecommendation; snapshot?: CopilotSnapshot | null; error?: string | null;
  atFnbStage: boolean; requireReviewAtApproval: boolean; assistantAvailable: boolean;
};
export type CopilotSettings = {
  consumptionLookbackDays: number; defaultCoverageDays: number; duplicateWindowDays: number; priceLookbackDays: number;
  priceIncreaseThresholdPercent: number; returnBelowPercent: number; analysisMaxAgeHours: number; requireReviewAtApproval: boolean;
  assistantEnabled: boolean; version: string;
};
export type CopilotAnswer = { id: string; analysisId: string; question: string; answer: string; citations: CopilotEvidence[]; limitations: string[]; status: "Answered" | "Refused" | "Failed"; atUtc: string };
/** Sent with an F&B decision. Overrides map "lines:code" to the approver's justification. */
export type CopilotDecision = { analysisId: string | null; overrides: Record<string, string>; acknowledgeAnalysisUnavailable: boolean };

const root = (c: string) => `/companies/${c}/procurement`;
export const findingKey = (lines: string, code: string) => `${lines}:${code}`;

export const requestCopilotApi = {
  latest: async (c: string, id: string) => {
    const response = await http.get<CopilotAnalysis | "">(`${root(c)}/requisitions/${id}/copilot`);
    return response.status === 204 || !response.data ? null : (response.data as CopilotAnalysis);
  },
  analyze: async (c: string, id: string) => (await http.post<CopilotAnalysis>(`${root(c)}/requisitions/${id}/copilot/analyze`)).data,
  reduce: async (c: string, id: string, version: string, lines: { lineId: string; approvedQuantity: number }[], reason: string) =>
    http.post(`${root(c)}/requisitions/${id}/copilot/reductions`, { version, lines, reason }),
  ask: async (c: string, id: string, analysisId: string, question: string) =>
    (await http.post<CopilotAnswer>(`${root(c)}/requisitions/${id}/copilot/ask`, { analysisId, question })).data,
  messages: async (c: string, id: string) => (await http.get<CopilotAnswer[]>(`${root(c)}/requisitions/${id}/copilot/messages`)).data,
  settings: async (c: string) => (await http.get<CopilotSettings>(`${root(c)}/copilot-settings`)).data,
  saveSettings: async (c: string, settings: CopilotSettings) => (await http.put<CopilotSettings>(`${root(c)}/copilot-settings`, settings)).data,
};
