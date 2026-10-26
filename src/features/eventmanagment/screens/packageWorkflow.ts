/** Approval workflow of a catering package revision: draft → waiting for approval → approved, or returned with a reason. */
export type WorkflowStatus = "Draft" | "PendingApproval" | "Approved" | "Returned" | "Archived";

export const WORKFLOW_LABEL: Record<string, string> = {
  Draft: "Draft",
  PendingApproval: "Waiting for approval",
  Approved: "Approved",
  Returned: "Returned for changes",
  Archived: "Archived",
};

export const workflowTone = (status?: string) =>
  status === "Approved" ? "ok" : status === "PendingApproval" ? "info" : status === "Returned" ? "bad" : "muted";
