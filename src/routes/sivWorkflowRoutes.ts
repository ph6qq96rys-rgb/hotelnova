export type DocStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Issued"
  | "Posted"
  | "RequestedChanges"
  | "Rejected"
  | "Reversed"
  | "Cancelled"
  | "Unknown"
  | "";

export type WorkflowRouteView = "draft-edit" | "approval" | "details";

export function normalizeStatus(value?: string | number | null): DocStatus {
  if (value == null || value === "") return "Unknown";

  const s = String(value).trim().toLowerCase().replace(/\s+/g, "");

  switch (s) {
    case "0":
    case "10":
    case "draft":
      return "Draft";

    case "1":
    case "20":
    case "submitted":
      return "Submitted";

    case "2":
    case "30":
    case "approved":
      return "Approved";

    case "3":
    case "25":
    case "requestedchanges":
    case "requested_changes":
    case "requestedchange":
      return "RequestedChanges";

    case "4":
    case "40":
    case "rejected":
      return "Rejected";

    case "5":
    case "50":
    case "issued":
      return "Issued";

    case "6":
    case "60":
    case "posted":
      return "Posted";

    case "7":
    case "70":
    case "reversed":
      return "Reversed";

    case "8":
    case "80":
    case "cancelled":
    case "canceled":
      return "Cancelled";

    default:
      return "Unknown";
  }
}

export function getWorkflowView(
  status?: string | number | null
): WorkflowRouteView {
  switch (normalizeStatus(status)) {
    case "Draft":
    case "RequestedChanges":
      return "draft-edit";
    case "Submitted":
      return "approval";
    case "Approved":
    case "Issued":
    case "Posted":
    case "Rejected":
    case "Reversed":
    case "Cancelled":
    case "Unknown":
    default:
      return "details";
  }
}

export function buildSivListRoute(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/siv`;
}

export function buildSivOpenRoute(companyId: string, sivId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/siv/open/${encodeURIComponent(sivId)}`;
}

export function buildSivDraftRoute(companyId: string, sivId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/siv/drafts/${encodeURIComponent(sivId)}`;
}

export function buildSivNewDraftRoute(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/siv/drafts/new`;
}

export function buildSivApprovalRoute(companyId: string, sivId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/siv/approval/${encodeURIComponent(sivId)}`;
}

export function buildSivDetailsRoute(companyId: string, sivId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/siv/${encodeURIComponent(sivId)}`;
}

export function buildSivWorkflowRoute(
  companyId: string,
  sivId: string,
  status?: string | number | null
): string {
  switch (getWorkflowView(status)) {
    case "draft-edit":
      return buildSivDraftRoute(companyId, sivId);
    case "approval":
      return buildSivApprovalRoute(companyId, sivId);
    case "details":
    default:
      return buildSivDetailsRoute(companyId, sivId);
  }
}