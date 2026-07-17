import { normalizeStatus, type SivStatus } from "../types/sivTypes";

export type SivWorkspace =
  | "draft"
  | "approval"
  | "issue"
  | "details"
  | "print";

function companyRouteBase(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}`;
}

function branchRouteBase(
  companyId: string,
  branchId: string,
): string {
  return (
    `${companyRouteBase(companyId)}` +
    `/branches/${encodeURIComponent(branchId)}`
  );
}

export function sivListPath(
  companyId: string,
  branchId?: string | null,
): string {
  const base = branchId
    ? branchRouteBase(companyId, branchId)
    : companyRouteBase(companyId);

  return `${base}/siv`;
}

export function sivCreatePath(
  companyId: string,
  branchId: string,
): string {
  return `${branchRouteBase(companyId, branchId)}/siv/drafts/new`;
}

export function sivDraftPath(
  companyId: string,
  branchId: string,
  sivId: string,
): string {
  return (
    `${branchRouteBase(companyId, branchId)}` +
    `/siv/drafts/${encodeURIComponent(sivId)}/edit`
  );
}

export function sivApprovalPath(
  companyId: string,
  sivId: string,
): string {
  return (
    `${companyRouteBase(companyId)}` +
    `/siv/approval/${encodeURIComponent(sivId)}`
  );
}

export function sivDetailsPath(
  companyId: string,
  sivId: string,
): string {
  return (
    `${companyRouteBase(companyId)}` +
    `/siv/${encodeURIComponent(sivId)}/details`
  );
}

export function sivPrintPath(
  companyId: string,
  sivId: string,
): string {
  return (
    `${companyRouteBase(companyId)}` +
    `/siv/${encodeURIComponent(sivId)}/print`
  );
}

export function sivOpenPath(
  companyId: string,
  sivId: string,
): string {
  return (
    `${companyRouteBase(companyId)}` +
    `/siv/${encodeURIComponent(sivId)}`
  );
}

export function getSivWorkspace(status: unknown): SivWorkspace {
  switch (normalizeStatus(status)) {
    case "Draft":
    case "ChangesRequested":
      return "draft";

    case "Submitted":
      return "approval";

    case "Approved":
    case "Issued":
      return "issue";

    default:
      return "details";
  }
}

export function getSivWorkspacePath(
  companyId: string,
  sivId: string,
  status: unknown,
  branchId?: string | null,
): string {
  switch (getSivWorkspace(status)) {
    case "draft":
      if (!branchId) {
        return sivDetailsPath(companyId, sivId);
      }

      return sivDraftPath(companyId, branchId, sivId);

    case "approval":
      return sivApprovalPath(companyId, sivId);

    case "issue":
    case "details":
      return sivDetailsPath(companyId, sivId);

    case "print":
      return sivPrintPath(companyId, sivId);
  }
}

export function isApprovalStatus(
  status: unknown,
): status is SivStatus {
  return normalizeStatus(status) === "Submitted";
}