export type SivStatusKey =
  | "draft"
  | "submitted"
  | "approved"
  | "requestedchanges"
  | "rejected"
  | "posted"
  | "reversed"
  | "cancelled"
  | "unknown";

export type SivWorkflowView =
  | "draft-edit"
  | "approval"
  | "details";

export type SivWorkflowAction =
  | "edit"
  | "submit"
  | "approve"
  | "requestChanges"
  | "reject"
  | "issue"
  | "post"
  | "reverse"
  | "print"
  | "refresh";

export function normalizeSivStatus(status?: unknown): SivStatusKey {
  if (status == null || status === "") return "unknown";

  const raw = String(status).trim().toLowerCase().replace(/\s+/g, "");

  switch (raw) {
    case "0":
    case "10":
    case "draft":
      return "draft";

    case "1":
    case "20":
    case "submitted":
      return "submitted";

    case "2":
    case "30":
    case "approved":
      return "approved";

    case "3":
    case "25":
    case "requestedchanges":
    case "requestedchange":
      return "requestedchanges";

    case "4":
    case "40":
    case "rejected":
      return "rejected";

    case "5":
    case "50":
    case "posted":
      return "posted";

    case "6":
    case "60":
    case "reversed":
      return "reversed";

    case "70":
    case "cancelled":
    case "canceled":
      return "cancelled";

    default:
      return "unknown";
  }
}

export function prettySivStatus(status?: unknown): string {
  switch (normalizeSivStatus(status)) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "requestedchanges":
      return "Requested Changes";
    case "rejected":
      return "Rejected";
    case "posted":
      return "Posted";
    case "reversed":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

export function getSivWorkflowView(status?: unknown): SivWorkflowView {
  switch (normalizeSivStatus(status)) {
    case "draft":
    case "requestedchanges":
      return "draft-edit";

    case "submitted":
      return "approval";

    case "approved":
    case "rejected":
    case "posted":
    case "reversed":
    case "cancelled":
    case "unknown":
    default:
      return "details";
  }
}

export function getAllowedSivActions(status?: unknown): SivWorkflowAction[] {
  switch (normalizeSivStatus(status)) {
    case "draft":
      return ["edit", "submit", "refresh"];

    case "requestedchanges":
      return ["edit", "submit", "refresh"];

    case "submitted":
      return ["approve", "requestChanges", "reject", "refresh"];

    case "approved":
      return ["issue", "post", "print", "refresh"];

    case "rejected":
      return ["print", "refresh"];

    case "posted":
      return ["reverse", "print", "refresh"];

    case "reversed":
      return ["print", "refresh"];

    case "cancelled":
      return ["print", "refresh"];

    case "unknown":
    default:
      return ["refresh"];
  }
}

export function resolveSivRoute(companyId: string, sivId: string, status?: unknown): string {
  const view = getSivWorkflowView(status);

  switch (view) {
    case "draft-edit":
      return `/companies/${companyId}/siv/drafts/${sivId}`;
    case "approval":
      return `/companies/${companyId}/siv/approval/${sivId}`;
    case "details":
    default:
      return `/companies/${companyId}/siv/${sivId}`;
  }
}