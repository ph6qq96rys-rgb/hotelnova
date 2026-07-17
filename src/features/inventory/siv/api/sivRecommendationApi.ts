import { http } from "../../../../api/http";

import type {
  SivApprovalCopilotResponse,
} from "../types/sivRecommendation";

export type GetSivApprovalCopilotRequest = {
  companyId: string;
  branchId: string;
  sivId: string;
  signal?: AbortSignal;
};

function requireRouteId(
  name: "companyId" | "branchId" | "sivId",
  value: string,
): string {
  const normalized = value?.trim();

  if (!normalized || normalized === "undefined" || normalized === "null") {
    throw new Error(`${name} is required to load the SIV recommendation.`);
  }

  return encodeURIComponent(normalized);
}

function approvalCopilotUrl(
  request: GetSivApprovalCopilotRequest,
): string {
  const companyId = requireRouteId("companyId", request.companyId);
  const branchId = requireRouteId("branchId", request.branchId);
  const sivId = requireRouteId("sivId", request.sivId);

  return (
    `/companies/${companyId}` +
    `/branches/${branchId}` +
    `/siv/${sivId}` +
    `/approval-copilot`
  );
}

export async function getSivApprovalCopilot(
  request: GetSivApprovalCopilotRequest,
): Promise<SivApprovalCopilotResponse> {
  const response = await http.get<SivApprovalCopilotResponse>(
    approvalCopilotUrl(request),
    {
      signal: request.signal,
    },
  );

  return response.data;
}
