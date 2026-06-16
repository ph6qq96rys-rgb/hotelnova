import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import "./GrnReversePage.css";

type ApiError = {
  response?: {
    data?: {
      title?: string;
      detail?: string;
      message?: string;
    };
  };
  message?: string;
};

type FindGrnResult = {
  id?: string | null;
  grnNumber?: string | null;
  status?: string | null;
  hasIssues?: boolean | null;
  hasIssuedLines?: boolean | null;
  isIssued?: boolean | null;
  issued?: boolean | null;
};

function clean(value: string): string {
  return value.trim();
}

function errorMessage(error: unknown, fallback: string): string {
  const e = error as ApiError;

  return (
    e?.response?.data?.title ||
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

function isPosted(row: FindGrnResult): boolean {
  return String(row.status ?? "").trim().toUpperCase() === "POSTED";
}

function hasIssuedStock(row: FindGrnResult): boolean {
  return Boolean(
    row.hasIssues ||
      row.hasIssuedLines ||
      row.isIssued ||
      row.issued
  );
}

function canReverseRow(row: FindGrnResult): boolean {
  return isPosted(row) && !hasIssuedStock(row);
}

export default function GrnReversePage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();

  const [grnNumber, setGrnNumber] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanedGrnNumber = clean(grnNumber);
  const cleanedBatchNo = clean(batchNo);
  const cleanedReason = clean(reason);

  const mode = useMemo<"GRN" | "BATCH" | null>(() => {
    if (cleanedGrnNumber) return "GRN";
    if (cleanedBatchNo) return "BATCH";
    return null;
  }, [cleanedGrnNumber, cleanedBatchNo]);

  const canSubmit = Boolean(companyId && mode && cleanedReason.length >= 5);

  function clearForm() {
    setGrnNumber("");
    setBatchNo("");
    setReason("");
    setError(null);
    setMessage(null);
  }

  async function submit() {
    if (!companyId || !canSubmit || !mode) return;

    const confirmed = window.confirm(
      "Reverse this GRN? This will affect inventory ledger and audit history."
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const body = {
        reason: cleanedReason,
      };

      if (mode === "GRN") {
        const row = (await grnApi.findByNumber(
          companyId,
          cleanedGrnNumber
        )) as FindGrnResult | null;

        if (!row?.id) {
          throw new Error(
            "GRN number was not found. Open the GRN list and confirm the number."
          );
        }

        if (!canReverseRow(row)) {
          throw new Error(
            "Only posted GRNs with no issued stock can be reversed."
          );
        }

        await grnApi.reverseById(companyId, String(row.id), body);
      } else {
        await grnApi.reverseByBatch(companyId, cleanedBatchNo, body);
      }

      setMessage("GRN reversal completed successfully.");
      setGrnNumber("");
      setBatchNo("");
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "Failed to reverse GRN."));
    } finally {
      setBusy(false);
    }
  }

  if (!companyId) {
    return (
      <main className="grn-reverse-page">
        <section className="grn-empty">Select a company to continue.</section>
      </main>
    );
  }

  return (
    <main className="grn-reverse-page">
      <header className="grn-reverse-header">
        <div>
          <h1>Reverse GRN</h1>
          <p>
            Reverse posted, unissued receipts by GRN number or batch number.
            Every reversal requires an audit reason.
          </p>
        </div>

        <button
          type="button"
          className="grn-btn"
          onClick={() => navigate(`/companies/${companyId}/grns`)}
        >
          All GRNs
        </button>
      </header>

      {error && <div className="grn-alert grn-alert--error">{error}</div>}
      {message && (
        <div className="grn-alert grn-alert--success">{message}</div>
      )}

      <section className="grn-card">
        <div className="grn-reverse-grid">
          <div className="grn-field">
            <label htmlFor="grnNumber">GRN Number</label>
            <input
              id="grnNumber"
              value={grnNumber}
              onChange={(e) => {
                setGrnNumber(e.target.value);
                if (e.target.value.trim()) setBatchNo("");
              }}
              placeholder="GRN-000123"
              disabled={busy}
            />
          </div>

          <div className="grn-field">
            <label htmlFor="batchNo">Batch Number</label>
            <input
              id="batchNo"
              value={batchNo}
              onChange={(e) => {
                setBatchNo(e.target.value);
                if (e.target.value.trim()) setGrnNumber("");
              }}
              placeholder="Batch number"
              disabled={busy}
            />
          </div>
        </div>

        <div className="grn-field grn-field--full">
          <label htmlFor="reason">Reversal Reason</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Example: Supplier invoice mismatch, wrong quantity, duplicate receipt..."
            disabled={busy}
          />
          <small>Minimum 5 characters required for audit compliance.</small>
        </div>
      </section>

      <section className="grn-warning">
        <strong>Important:</strong> only posted GRNs that have not been issued
        should be reversible. This action affects inventory, FIFO lots, and the
        inventory ledger.
      </section>

      <footer className="grn-reverse-actions">
        <button
          type="button"
          className="grn-btn"
          disabled={busy}
          onClick={clearForm}
        >
          Clear
        </button>

        <button
          type="button"
          className="grn-btn grn-btn--danger"
          disabled={!canSubmit || busy}
          onClick={() => void submit()}
        >
          {busy ? "Reversing…" : "Reverse GRN"}
        </button>
      </footer>
    </main>
  );
}