// src/features/inventory/siv/utils/sivWorkflow.ts
// Kept as a thin re-export wrapper so existing imports don't break.
// Core normalization lives in types.ts — import from there for new code.

export type SivStatusKey =
  | "draft" | "submitted" | "approved" | "requestedchanges"
  | "rejected" | "issued" | "posted" | "reversed" | "cancelled" | "unknown";

export type SivWorkflowAction =
  | "edit" | "submit" | "approve" | "requestChanges" | "reject"
  | "issue" | "post" | "reverse" | "print" | "refresh";

export type DocStatus = string;

export function normalizeSivStatus(status?: unknown): SivStatusKey {
  const s = String(status ?? "").trim().toLowerCase().replace(/[\s_]/g, "");
  switch (s) {
    case "0": case "10": case "draft":              return "draft";
    case "1": case "20": case "submitted":           return "submitted";
    case "2": case "30": case "approved":            return "approved";
    case "25": case "requestedchanges":              return "requestedchanges";
    case "4": case "40": case "rejected":            return "rejected";
    case "5": case "8": case "50": case "issued":    return "issued";
    case "3": case "6": case "60": case "posted":    return "posted";
    case "7": case "70": case "reversed":            return "reversed";
    case "80": case "cancelled": case "canceled":   return "cancelled";
    default:                                          return "unknown";
  }
}

export function normalizeStatus(status?: unknown): SivStatusKey {
  return normalizeSivStatus(status);
}

export function prettySivStatus(status?: unknown): string {
  const map: Record<SivStatusKey, string> = {
    draft:            "Draft",
    submitted:        "Submitted",
    approved:         "Approved",
    requestedchanges: "Requested Changes",
    rejected:         "Rejected",
    issued:           "Issued",
    posted:           "Posted",
    reversed:         "Reversed",
    cancelled:        "Cancelled",
    unknown:          "Unknown",
  };
  return map[normalizeSivStatus(status)] ?? "Unknown";
}

export function getAllowedSivActions(status?: unknown): SivWorkflowAction[] {
  switch (normalizeSivStatus(status)) {
    case "draft":            return ["edit", "submit", "refresh"];
    case "requestedchanges": return ["edit", "submit", "refresh"];
    case "submitted":        return ["approve", "requestChanges", "reject", "refresh"];
    case "approved":         return ["issue", "refresh"];
    case "issued":           return ["post", "print", "refresh"];
    case "rejected":         return ["print", "refresh"];
    case "posted":           return ["reverse", "print", "refresh"];
    case "reversed":         return ["print", "refresh"];
    case "cancelled":        return ["print", "refresh"];
    default:                 return ["refresh"];
  }
}

export function resolveSivRoute(companyId: string, sivId: string, status?: unknown): string {
  switch (normalizeSivStatus(status)) {
    case "draft":
    case "requestedchanges":
      return `/companies/${companyId}/siv/drafts/${sivId}/edit`;
    case "submitted":
      return `/companies/${companyId}/siv/approval/${sivId}`;
    default:
      return `/companies/${companyId}/siv/${sivId}`;
  }
}

export function buildSivOpenRoute(companyId: string): string {
  return `/companies/${companyId}/siv`;
}

export function buildSivDraftRoute(companyId: string, sivId: string): string {
  return `/companies/${companyId}/siv/drafts/${sivId}/edit`;
}

export function buildSivNewDraftRoute(companyId: string): string {
  return `/companies/${companyId}/siv/drafts/new`;
}