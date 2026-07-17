// GrnReversalModal.tsx

import { useMemo, useState } from "react";
import { grnApi } from "../api/grnApi";
import "../styles/GrnPages.erp.css";

type Mode = "request" | "approval";

type Props = {
  open: boolean;
  mode: Mode;
  companyId: string;
  grn: {
    id: string;
    grnNumber?: string | null;
    supplierName?: string | null;
    receivingLocationName?: string | null;
    receivedDate?: string | Date | null;
    status?: string | null;
    reversalReason?: string | null;
    reverseReason?: string | null;
  } | null;
  busy?: boolean;
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
};

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function apiError(error: unknown, fallback: string): string {
  const e = error as {
    response?: {
      data?: {
        title?: string;
        detail?: string;
        message?: string;
        error?: string;
      };
    };
    message?: string;
  };

  return (
    e.response?.data?.detail ||
    e.response?.data?.message ||
    e.response?.data?.error ||
    e.response?.data?.title ||
    e.message ||
    fallback
  );
}

function statusOf(value?: string | null): string {
  return clean(value).toUpperCase();
}

export default function GrnReversalModal({
  open,
  mode,
  companyId,
  grn,
  busy = false,
  onClose,
  onCompleted,
}: Props) {
  const existingReason = clean(grn?.reversalReason ?? grn?.reverseReason);
  const [reason, setReason] = useState(existingReason);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState<"request" | "approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = statusOf(grn?.status);
  const cleanReason = clean(reason);
  const cleanRejectReason = clean(rejectReason);

  const canRequest =
    mode === "request" &&
    companyId &&
    grn?.id &&
    status === "POSTED" &&
    cleanReason.length >= MIN_REASON_LENGTH &&
    cleanReason.length <= MAX_REASON_LENGTH &&
    !busy &&
    !submitting;

  const canApprove =
    mode === "approval" &&
    companyId &&
    grn?.id &&
    status === "REVERSALREQUESTED" &&
    !busy &&
    !submitting;

  const canReject =
    mode === "approval" &&
    companyId &&
    grn?.id &&
    status === "REVERSALREQUESTED" &&
    cleanRejectReason.length >= 5 &&
    cleanRejectReason.length <= MAX_REASON_LENGTH &&
    !busy &&
    !submitting;

  const title = useMemo(
    () =>
      mode === "approval"
        ? "Approve Goods Receipt Reversal"
        : "Request Goods Receipt Reversal",
    [mode],
  );

  if (!open || !grn) return null;

  async function submitRequest() {
    if (!canRequest || !grn?.id) return;

    setSubmitting("request");
    setError(null);

    try {
      await grnApi.requestReversal(companyId, grn.id, {
        reason: cleanReason,
      });

      await onCompleted();
      onClose();
    } catch (err) {
      setError(apiError(err, "Unable to request reversal."));
    } finally {
      setSubmitting(null);
    }
  }

  async function approveReversal() {
    if (!canApprove || !grn?.id) return;

    setSubmitting("approve");
    setError(null);

    try {
      await grnApi.approveReversal(companyId, grn.id);

      await onCompleted();
      onClose();
    } catch (err) {
      setError(apiError(err, "Unable to approve reversal."));
    } finally {
      setSubmitting(null);
    }
  }

  async function rejectReversal() {
    if (!canReject || !grn?.id) return;

    setSubmitting("reject");
    setError(null);

    try {
      await grnApi.rejectReversal(companyId, grn.id, {
        reason: cleanRejectReason,
      });

      await onCompleted();
      onClose();
    } catch (err) {
      setError(apiError(err, "Unable to reject reversal."));
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="grn-reversal-modal-backdrop" role="presentation">
      <section
        className="grn-reversal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grn-reversal-title"
      >
        <header className="grn-reversal-modal__header">
          <div>
            <div className="grn-reversal-modal__kicker">Inventory Control</div>
            <h2 id="grn-reversal-title">{title}</h2>
            <p>
              {mode === "approval"
                ? "Review the request before approving the real inventory reversal."
                : "Submit a reversal request for manager approval."}
            </p>
          </div>

          <button
            type="button"
            className="grn-reversal-modal__close"
            onClick={onClose}
            disabled={Boolean(submitting) || busy}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <div className="grn-reversal-modal__summary">
          <div>
            <span>GRN Number</span>
            <strong>{grn.grnNumber || grn.id}</strong>
          </div>
          <div>
            <span>Supplier</span>
            <strong>{grn.supplierName || "—"}</strong>
          </div>
          <div>
            <span>Receiving Warehouse</span>
            <strong>{grn.receivingLocationName || "—"}</strong>
          </div>
          <div>
            <span>Received Date</span>
            <strong>{formatDate(grn.receivedDate)}</strong>
          </div>
        </div>

        {mode === "request" ? (
          <>
            <div className="grn-reversal-modal__alert grn-reversal-modal__alert--warning">
              <strong>This request requires approval.</strong>
              <ul>
                <li>The receipt will not be reversed immediately.</li>
                <li>A manager must approve the request.</li>
                <li>FIFO, ledger, and stock balances change only after approval.</li>
              </ul>
            </div>

            <label className="grn-reversal-modal__field">
              <span>Reason for Reversal *</span>
              <textarea
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(null);
                }}
                placeholder="Enter the business reason for requesting this reversal."
                disabled={Boolean(submitting) || busy}
                autoFocus
              />
              <small>
                {cleanReason.length}/{MAX_REASON_LENGTH} characters · Minimum{" "}
                {MIN_REASON_LENGTH}.
              </small>
            </label>
          </>
        ) : (
          <>
            <div className="grn-reversal-modal__alert grn-reversal-modal__alert--warning">
              <strong>Approval will perform the real reversal.</strong>
              <ul>
                <li>FIFO lots will be reversed.</li>
                <li>Inventory ledger reversal entries will be posted.</li>
                <li>Stock balances will be reduced.</li>
                <li>The action will fail if stock from this receipt was consumed.</li>
              </ul>
            </div>

            <div className="grn-reversal-modal__field">
              <span>Requested Reason</span>
              <div className="grn-reversal-modal__readonly">
                {existingReason || "No reason recorded."}
              </div>
            </div>

            <label className="grn-reversal-modal__field">
              <span>Reject Reason</span>
              <textarea
                value={rejectReason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  setError(null);
                }}
                placeholder="Required only if rejecting the reversal request."
                disabled={Boolean(submitting) || busy}
              />
            </label>
          </>
        )}

        {error ? (
          <div className="grn-reversal-modal__alert grn-reversal-modal__alert--danger">
            {error}
          </div>
        ) : null}

        <footer className="grn-reversal-modal__actions">grnApi.rejectReversal
          <button type="button" className="btn" onClick={onClose} disabled={Boolean(submitting) || busy}>
            Cancel
          </button>

          {mode === "request" ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canRequest}
              onClick={() => void submitRequest()}
            >
              {submitting === "request" ? "Submitting…" : "Request Reversal"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                disabled={!canReject}
                onClick={() => void rejectReversal()}
              >
                {submitting === "reject" ? "Rejecting…" : "Reject Request"}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                disabled={!canApprove}
                onClick={() => void approveReversal()}
              >
                {submitting === "approve" ? "Reversing…" : "Approve & Reverse"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}