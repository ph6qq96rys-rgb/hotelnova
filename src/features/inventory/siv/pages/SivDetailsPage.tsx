import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { sivApi } from "../api/sivApi";
import "./siv-draft.css";

function safeString(value: unknown): string {
  return value == null ? "" : String(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function formatQty(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

type WorkflowStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Issued"
  | "Posted"
  | "RequestedChanges"
  | "Rejected"
  | "Reversed"
  | "Cancelled"
  | "Unknown";

function normalizeStatus(value?: string | number | null): WorkflowStatus {
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
    case "8":
    case "50":
    case "issued":
      return "Issued";
    case "3":
    case "6":
    case "60":
    case "posted":
      return "Posted";
    case "7":
    case "70":
    case "reversed":
      return "Reversed";
    case "80":
    case "cancelled":
    case "canceled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function statusTone(status?: string | number | null): "neutral" | "good" | "warn" {
  const s = normalizeStatus(status);

  if (s === "Approved" || s === "Issued" || s === "Posted") return "good";
  if (s === "Submitted" || s === "RequestedChanges") return "warn";

  return "neutral";
}

type Notice = {
  kind: "success" | "info" | "error";
  message: string;
} | null;

type SivLineVm = {
  id: string;
  itemId: string;
  itemName: string;
  uomId: string;
  uomName: string;
  uomCode: string;
  qty: number;
  remarks: string;
  batchNo: string;
  expiryDate: string;
  availableQty?: number;
  availableBaseQty?: number;
};

type SivVm = {
  id: string;
  number: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  departmentName: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  issueDate: string;
  remarks: string;
  notes: string;
  docStatus: WorkflowStatus;
  rowVersion?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lines: SivLineVm[];
};

function unwrapApi(input: any): any {
  return input?.data?.data ?? input?.data ?? input ?? {};
}

function pickLines(input: any): any[] {
  const raw = unwrapApi(input);

  const lines =
    raw?.lines ??
    raw?.sivLines ??
    raw?.issueLines ??
    raw?.stockIssueVoucherLines ??
    raw?.stockIssueLines ??
    raw?.lineItems ??
    raw?.items ??
    raw?.details ??
    raw?.documentLines ??
    [];

  return Array.isArray(lines) ? lines : [];
}

function mapDetailsToVm(input: any): SivVm {
  const raw = unwrapApi(input);
  const linesRaw = pickLines(raw);

  return {
    id: safeString(raw?.id),
    number: safeString(raw?.number ?? raw?.documentNumber ?? raw?.voucherNo ?? raw?.id),
    companyId: safeString(raw?.companyId),
    branchId: safeString(raw?.branchId),
    departmentId: safeString(raw?.departmentId),
    departmentName: safeString(raw?.departmentName ?? raw?.department?.name),
    fromLocationId: safeString(raw?.fromLocationId ?? raw?.locationId),
    fromLocationName: safeString(
      raw?.fromLocationName ?? raw?.fromLocation?.name ?? raw?.locationName
    ),
    toLocationId: safeString(raw?.toLocationId),
    toLocationName: safeString(raw?.toLocationName ?? raw?.toLocation?.name),
    issueDate: safeString(raw?.issueDate ?? raw?.documentDate),
    remarks: safeString(raw?.remarks),
    notes: safeString(raw?.notes),
    docStatus: normalizeStatus(raw?.status ?? raw?.docStatus),
    rowVersion: raw?.rowVersion ?? null,
    createdAt: raw?.createdAt ?? raw?.createdOn ?? null,
    updatedAt: raw?.updatedAt ?? raw?.modifiedAt ?? raw?.lastModifiedAt ?? null,
    lines: linesRaw.map((line: any) => ({
      id: safeString(line?.id),
      itemId: safeString(
        line?.itemId ?? line?.inventoryItemId ?? line?.productId ?? line?.stockItemId
      ),
      itemName: safeString(
        line?.itemName ??
          line?.inventoryItemName ??
          line?.productName ??
          line?.stockItemName ??
          line?.item?.name ??
          line?.inventoryItem?.name
      ),
      uomId: safeString(line?.uomId ?? line?.unitOfMeasureId ?? line?.baseUomId),
      uomName: safeString(line?.uomName ?? line?.unitOfMeasureName ?? line?.uom?.name),
      uomCode: safeString(
        line?.uomCode ??
          line?.unitOfMeasureCode ??
          line?.baseUomCode ??
          line?.uom ??
          line?.item?.baseUom
      ),
      qty: asNumber(line?.qty ?? line?.quantity ?? line?.issuedQty ?? line?.issueQty, 0),
      remarks: safeString(line?.remarks ?? line?.notes),
      batchNo: safeString(line?.batchNo ?? line?.batchNumber),
      expiryDate: safeString(line?.expiryDate ?? line?.expirationDate),
      availableQty:
        line?.availableQty == null && line?.availableQuantity == null
          ? undefined
          : asNumber(line?.availableQty ?? line?.availableQuantity),
      availableBaseQty:
        line?.availableBaseQty == null && line?.availableQty == null
          ? undefined
          : asNumber(line?.availableBaseQty ?? line?.availableQty),
    })),
  };
}

function buildWorkflowRequest(doc: SivVm, overrideRemarks?: string) {
  return {
    companyId: doc.companyId,
    rowVersion: doc.rowVersion ?? null,
    remarks:
      typeof overrideRemarks === "string"
        ? overrideRemarks.trim() || null
        : doc.remarks?.trim() || null,
  };
}

function requireRemarks(
  action: "requestChanges" | "reject" | "reverse"
): string | null {
  const label =
    action === "requestChanges"
      ? "remarks for requesting changes"
      : action === "reject"
        ? "remarks for rejection"
        : "reason for reversal";

  const text = window.prompt(`Enter ${label}:`, "");
  if (text == null) return null;

  const trimmed = text.trim();

  if (!trimmed) {
    window.alert(`Please enter ${label}.`);
    return null;
  }

  return trimmed;
}

function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn";
  children: React.ReactNode;
}) {
  return <span className={`lux-chip ${tone}`}>{children}</span>;
}

function AlertBar({
  kind,
  message,
  onClose,
}: {
  kind: "error" | "success" | "info";
  message: string;
  onClose: () => void;
}) {
  return (
    <div className={`lux-alert ${kind}`}>
      <div className="lux-alert__msg">{message}</div>
      <button className="lux-btn ghost" onClick={onClose} type="button">
        ✕
      </button>
    </div>
  );
}

function resolvePermissions(status: WorkflowStatus, hasDoc: boolean) {
  const isDraft = status === "Draft";
  const isRequestedChanges = status === "RequestedChanges";
  const isSubmitted = status === "Submitted";
  const isApproved = status === "Approved";
  const isIssued = status === "Issued";
  const isPosted = status === "Posted";

  const canEdit = hasDoc && (isDraft || isRequestedChanges);

  return {
    canEdit,
    canSubmit: canEdit,
    canApprove: hasDoc && isSubmitted,
    canRequestChanges: hasDoc && isSubmitted,
    canReject: hasDoc && isSubmitted,
    canIssue: hasDoc && isApproved,
    canPost: hasDoc && isIssued,
    canReverse: hasDoc && isPosted,
    isApprovalState: hasDoc && isSubmitted,
  };
}

export default function SivDetailsPage() {
  const navigate = useNavigate();

  const params = useParams<{
    companyId?: string;
    sivId?: string;
    id?: string;
    draftId?: string;
  }>();

  const scope = useAppScope() as any;

  const scopedCompanyId = safeString(scope?.companyId);
  const scopedBranchId = safeString(scope?.branchId);

  const companyId = safeString(params.companyId || scopedCompanyId);
  const sivId = safeString(params.sivId || params.id || params.draftId);

  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState<Notice>(null);
  const [doc, setDoc] = React.useState<SivVm | null>(null);

  const canLoad = isUuid(companyId) && isUuid(sivId);

  const load = React.useCallback(async () => {
    if (!canLoad) return;

    setLoading(true);
    setError("");

    try {
      const api = sivApi as any;
      const getFn = api.getById ?? api.getDetails ?? api.getDraft ?? api.get;

      if (!getFn) {
        throw new Error("Missing SIV details API method.");
      }

      const raw = await getFn(companyId, sivId);
      const mapped = mapDetailsToVm(raw);

      setDoc(mapped);
    } catch (e: any) {
      setError(e?.response?.data?.title || e?.message || "Failed to load SIV.");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [canLoad, companyId, sivId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const runWorkflow = React.useCallback(
    async (
      action:
        | "submit"
        | "approve"
        | "requestChanges"
        | "reject"
        | "issue"
        | "post"
        | "reverse"
    ) => {
      if (!doc || !sivId) return;

      setBusy(true);
      setError("");
      setNotice(null);

      try {
        let remarksOverride: string | undefined;

        if (
          action === "requestChanges" ||
          action === "reject" ||
          action === "reverse"
        ) {
          const input = requireRemarks(action);

          if (input === null) {
            setBusy(false);
            return;
          }

          remarksOverride = input;
        }

        const api = sivApi as any;

        const fn =
          action === "submit"
            ? api.submit ?? api.submitForApproval
            : action === "approve"
              ? api.approve
              : action === "requestChanges"
                ? api.requestChanges
                : action === "reject"
                  ? api.reject
                  : action === "issue"
                    ? api.issue
                    : action === "post"
                      ? api.post
                      : api.reverse;

        if (!fn) {
          throw new Error(`Missing SIV API workflow method for ${action}.`);
        }

        await fn(companyId, sivId, buildWorkflowRequest(doc, remarksOverride));

        const messageByAction: Record<typeof action, string> = {
          submit: "SIV submitted for approval successfully.",
          approve: "SIV approved successfully.",
          requestChanges: "Change request sent successfully.",
          reject: "SIV rejected successfully.",
          issue: "SIV issued successfully.",
          post: "SIV posted successfully.",
          reverse: "SIV reversed successfully.",
        };

        setNotice({
          kind: "success",
          message: messageByAction[action],
        });

        await load();
      } catch (e: any) {
        setError(
          e?.response?.data?.title ||
            e?.response?.data?.message ||
            e?.message ||
            `Failed to ${action} SIV.`
        );
      } finally {
        setBusy(false);
      }
    },
    [doc, companyId, sivId, load]
  );

  const status = normalizeStatus(doc?.docStatus);
  const permissions = resolvePermissions(status, !!doc);

  const totalQty = React.useMemo(
    () => doc?.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0) ?? 0,
    [doc]
  );

  if (!companyId || !isUuid(companyId)) {
    return (
      <div className="lux-page">
        <div className="lux-container">
          <div className="lux-card">
            <div className="lux-card__title">Invalid Company Scope</div>
            <div className="lux-card__desc">No valid companyId was found.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!sivId || !isUuid(sivId)) {
    return (
      <div className="lux-page">
        <div className="lux-container">
          <div className="lux-card">
            <div className="lux-card__title">Invalid SIV Id</div>
            <div className="lux-card__desc">The requested SIV id is missing or invalid.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lux-page">
      <div className="lux-sticky">
        <div className="lux-sticky__inner">
          <div className="lux-sticky__left">
            <div className="lux-title">Stock Issue Voucher</div>
            <div className="lux-subtitle">
              Workflow: Draft → Submitted → Approved → Issued → Posted
              <span className="lux-dot">•</span>
              <span className="lux-muted">{companyId}</span>
            </div>
          </div>

          <div className="lux-sticky__right">
            {doc ? <Chip tone={statusTone(doc.docStatus)}>{status}</Chip> : null}

            <button
              className="lux-btn ghost"
              onClick={() => void load()}
              type="button"
              disabled={busy || loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="lux-container">
        <div className="lux-hero">
          <div className="lux-hero__bg" />
          <div className="lux-hero__content">
            <div className="lux-hero__kicker">Inventory • SIV</div>
            <div className="lux-hero__headline">{doc?.number || "SIV Details"}</div>
            <div className="lux-hero__meta">
              <Chip>Branch: {doc?.branchId || scopedBranchId || "—"}</Chip>
              <Chip>Issue Date: {formatDate(doc?.issueDate)}</Chip>
              <Chip>Lines: {doc?.lines.length ?? 0}</Chip>
              <Chip>Total Qty: {formatQty(totalQty)}</Chip>
              <Chip tone={statusTone(doc?.docStatus)}>{status}</Chip>
            </div>
          </div>
        </div>

        {error ? (
          <AlertBar kind="error" message={error} onClose={() => setError("")} />
        ) : null}

        {notice ? (
          <AlertBar
            kind={notice.kind}
            message={notice.message}
            onClose={() => setNotice(null)}
          />
        ) : null}

        {loading ? (
          <div className="lux-card">
            <div className="lux-empty">
              <div className="lux-empty__title">Loading SIV</div>
              <div className="lux-empty__desc">
                Please wait while the document is being loaded.
              </div>
            </div>
          </div>
        ) : !doc ? (
          <div className="lux-card">
            <div className="lux-empty">
              <div className="lux-empty__title">Document not found</div>
              <div className="lux-empty__desc">The SIV could not be loaded.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="lux-card">
              <div className="lux-card__head">
                <div>
                  <div className="lux-card__title">Workflow Status</div>
                  <div className="lux-card__desc">
                    Current status and next available action.
                  </div>
                </div>
                <Chip tone={statusTone(doc.docStatus)}>{status}</Chip>
              </div>

              <div className="lux-grid">
                <div className="lux-field">
                  <label>Draft</label>
                  <input className="lux-input" value="Create or edit issue lines" readOnly />
                </div>

                <div className="lux-field">
                  <label>Submitted</label>
                  <input className="lux-input" value="Waiting for approval" readOnly />
                </div>

                <div className="lux-field">
                  <label>Approved</label>
                  <input className="lux-input" value="Ready to issue stock" readOnly />
                </div>

                <div className="lux-field">
                  <label>Issued</label>
                  <input className="lux-input" value="Ready to post ledger" readOnly />
                </div>

                <div className="lux-field span-2">
                  <label>Current Allowed Action</label>
                  <input
                    className="lux-input"
                    value={
                      permissions.canSubmit
                        ? "Submit for Approval"
                        : permissions.isApprovalState
                          ? "Approve / Request Changes / Reject"
                          : permissions.canIssue
                            ? "Issue"
                            : permissions.canPost
                              ? "Post"
                              : permissions.canReverse
                                ? "Reverse"
                                : "No action available"
                    }
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="lux-card">
              <div className="lux-card__head">
                <div>
                  <div className="lux-card__title">Header</div>
                  <div className="lux-card__desc">Document summary.</div>
                </div>
              </div>

              <div className="lux-grid">
                <div className="lux-field span-2">
                  <label>Document No</label>
                  <input className="lux-input" value={doc.number || doc.id} readOnly />
                </div>

                <div className="lux-field">
                  <label>Status</label>
                  <input className="lux-input" value={status} readOnly />
                </div>

                <div className="lux-field">
                  <label>Company</label>
                  <input className="lux-input" value={doc.companyId || companyId} readOnly />
                </div>

                <div className="lux-field">
                  <label>Branch</label>
                  <input className="lux-input" value={doc.branchId || scopedBranchId} readOnly />
                </div>

                <div className="lux-field">
                  <label>Department</label>
                  <input
                    className="lux-input"
                    value={doc.departmentName || doc.departmentId || "—"}
                    readOnly
                  />
                </div>

                <div className="lux-field">
                  <label>From Location</label>
                  <input
                    className="lux-input"
                    value={doc.fromLocationName || doc.fromLocationId || "—"}
                    readOnly
                  />
                </div>

                <div className="lux-field">
                  <label>To Location</label>
                  <input
                    className="lux-input"
                    value={doc.toLocationName || doc.toLocationId || "—"}
                    readOnly
                  />
                </div>

                <div className="lux-field">
                  <label>Issue Date</label>
                  <input className="lux-input" value={formatDate(doc.issueDate)} readOnly />
                </div>

                <div className="lux-field">
                  <label>Created</label>
                  <input className="lux-input" value={formatDateTime(doc.createdAt)} readOnly />
                </div>

                <div className="lux-field">
                  <label>Last Updated</label>
                  <input className="lux-input" value={formatDateTime(doc.updatedAt)} readOnly />
                </div>

                <div className="lux-field span-2">
                  <label>Remarks</label>
                  <textarea
                    className="lux-input"
                    rows={3}
                    value={doc.remarks || doc.notes || ""}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="lux-card">
              <div className="lux-card__head">
                <div>
                  <div className="lux-card__title">Line Items</div>
                  <div className="lux-card__desc">Items included in this voucher.</div>
                </div>
                <div className="lux-card__headRight">
                  <Chip>{doc.lines.length} line(s)</Chip>
                  <Chip>Total Qty: {formatQty(totalQty)}</Chip>
                </div>
              </div>

              {!doc.lines.length ? (
                <div className="lux-empty">
                  <div className="lux-empty__title">No lines</div>
                  <div className="lux-empty__desc">
                    This SIV does not contain any lines.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="lux-table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>#</th>
                        <th>Item</th>
                        <th style={{ width: 120 }}>UOM</th>
                        <th style={{ width: 120 }}>Qty</th>
                        <th style={{ width: 140 }}>Batch</th>
                        <th style={{ width: 140 }}>Expiry</th>
                        <th style={{ width: 140 }}>Available</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>

                    <tbody>
                      {doc.lines.map((line, index) => (
                        <tr key={line.id || `${line.itemId}_${index}`}>
                          <td>{index + 1}</td>
                          <td>{line.itemName || line.itemId || "—"}</td>
                          <td>{line.uomCode || line.uomName || line.uomId || "—"}</td>
                          <td>{formatQty(line.qty)}</td>
                          <td>{line.batchNo || "—"}</td>
                          <td>{line.expiryDate ? formatDate(line.expiryDate) : "—"}</td>
                          <td>
                            {line.availableBaseQty != null
                              ? formatQty(line.availableBaseQty)
                              : line.availableQty != null
                                ? formatQty(line.availableQty)
                                : "—"}
                          </td>
                          <td>{line.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lux-bottom-actions">
              <button
                className="lux-btn ghost"
                onClick={() => navigate(-1)}
                type="button"
                disabled={busy}
              >
                Back
              </button>

              {permissions.canEdit ? (
                <button
                  className="lux-btn"
                  onClick={() =>
                    navigate(
                      `/companies/${encodeURIComponent(
                        companyId
                      )}/siv/drafts/${encodeURIComponent(doc.id || sivId)}/edit`
                    )
                  }
                  type="button"
                  disabled={busy}
                >
                  Edit Draft
                </button>
              ) : null}

              {permissions.canSubmit ? (
                <button
                  className="lux-btn primary"
                  onClick={() => void runWorkflow("submit")}
                  type="button"
                  disabled={busy || loading}
                >
                  Submit for Approval
                </button>
              ) : null}

              {permissions.isApprovalState ? (
                <button
                  className="lux-btn"
                  onClick={() =>
                    navigate(
                      `/companies/${encodeURIComponent(
                        companyId
                      )}/siv/approval/${encodeURIComponent(doc.id || sivId)}`
                    )
                  }
                  type="button"
                  disabled={busy}
                >
                  Open Approval
                </button>
              ) : null}

              {permissions.canIssue ? (
                <button
                  className="lux-btn primary"
                  onClick={() => void runWorkflow("issue")}
                  type="button"
                  disabled={busy || loading}
                >
                  Issue
                </button>
              ) : null}

              {permissions.canPost ? (
                <button
                  className="lux-btn primary"
                  onClick={() => void runWorkflow("post")}
                  type="button"
                  disabled={busy || loading}
                >
                  Post
                </button>
              ) : null}

              {permissions.canReverse ? (
                <button
                  className="lux-btn danger"
                  onClick={() => void runWorkflow("reverse")}
                  type="button"
                  disabled={busy || loading}
                >
                  Reverse
                </button>
              ) : null}

              <button
                className="lux-btn ghost"
                onClick={() =>
                  navigate(
                    `/companies/${encodeURIComponent(companyId)}/siv/${encodeURIComponent(
                      doc.id || sivId
                    )}/print`
                  )
                }
                type="button"
                disabled={busy || loading}
              >
                Print
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}