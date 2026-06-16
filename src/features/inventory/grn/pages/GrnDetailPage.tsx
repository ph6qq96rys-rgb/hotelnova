import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import type { GrnDetailDto } from "../types/grn.types";
import "./GrnDetailPage.css";

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

type GrnLine = {
  id?: string;
  itemId?: string;
  itemName?: string;
  itemCode?: string;
  quantity?: number;
  qty?: number;
  uomId?: string;
  uomName?: string;
  uomCode?: string;
  unitCost?: number;
  taxAmount?: number;
  batchNo?: string | null;
  expiryDate?: string | null;
  expiryDateUtc?: string | null;
};

type GrnDetailView = GrnDetailDto & {
  id?: string;
  grnNumber?: string | null;
  supplierName?: string | null;
  status?: string | null;
  receivingLocationName?: string | null;
  locationName?: string | null;
  warehouseName?: string | null;
  receivedDate?: string | null;
  receivedAt?: string | null;
  receiptDate?: string | null;
  receivedAtUtc?: string | null;
  postedAt?: string | null;
  postedAtUtc?: string | null;
  notes?: string | null;
  hasIssues?: boolean | null;
  hasIssuedLines?: boolean | null;
  isIssued?: boolean | null;
  issued?: boolean | null;
  lines?: GrnLine[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown): string {
  return number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function date(value: unknown): string {
  const raw = text(value);
  if (!raw) return "—";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString();
}

function getErrorMessage(error: unknown, fallback: string): string {
  const e = error as ApiError;

  return (
    e?.response?.data?.title ||
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

function statusOf(grn: GrnDetailView): string {
  return text(grn.status).toUpperCase() || "DRAFT";
}

function isPosted(grn: GrnDetailView): boolean {
  return statusOf(grn) === "POSTED";
}

function hasIssuedStock(grn: GrnDetailView): boolean {
  return Boolean(
    grn.hasIssues ||
      grn.hasIssuedLines ||
      grn.isIssued ||
      grn.issued
  );
}

function canReverse(grn: GrnDetailView): boolean {
  return isPosted(grn) && !hasIssuedStock(grn);
}

function receiptDateOf(grn: GrnDetailView): unknown {
  return (
    grn.receivedDate ??
    grn.receivedAt ??
    grn.receiptDate ??
    grn.receivedAtUtc
  );
}

function locationOf(grn: GrnDetailView): string {
  return text(
    grn.receivingLocationName ??
      grn.locationName ??
      grn.warehouseName
  );
}

function lineQuantity(line: GrnLine): number {
  return number(line.quantity ?? line.qty);
}

function lineTotal(line: GrnLine): number {
  return lineQuantity(line) * number(line.unitCost) + number(line.taxAmount);
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`grn-status grn-status--${value.toLowerCase()}`}>
      {value || "—"}
    </span>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grn-field-view">
      <div className="grn-field-label">{label}</div>
      <div className="grn-field-value">{value || "—"}</div>
    </div>
  );
}

export default function GrnDetailPage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();
  const { grnId } = useParams<{ grnId: string }>();

  const [data, setData] = useState<GrnDetailView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !grnId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await grnApi.getById(companyId, grnId);
      setData(result as GrnDetailView);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load GRN."));
    } finally {
      setLoading(false);
    }
  }, [companyId, grnId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = useMemo<GrnLine[]>(() => {
    return Array.isArray(data?.lines) ? data.lines : [];
  }, [data]);

  const totalCost = useMemo(() => {
    return lines.reduce((sum, line) => sum + lineTotal(line), 0);
  }, [lines]);

  async function handleReverse() {
    if (!companyId || !grnId || !data) return;

    if (!canReverse(data)) {
      setError("Only posted GRNs with no issued stock can be reversed.");
      return;
    }

    const grnNo = text(data.grnNumber) || grnId;

    const reason = window.prompt(
      `Enter reversal reason for GRN ${grnNo}`,
      "Incorrect receipt"
    );

    if (!reason?.trim()) {
      setError("Reversal reason is required.");
      return;
    }

    const confirmed = window.confirm(
      `Reverse GRN ${grnNo}? This action will create reversal inventory entries.`
    );

    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      await grnApi.reverseById(companyId, grnId, {
        reason: reason.trim(),
      });

      setSuccess("GRN reversed successfully.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reverse GRN."));
    } finally {
      setBusy(false);
    }
  }

  if (!companyId) {
    return (
      <main className="grn-detail-page">
        <section className="grn-empty">Select a company to continue.</section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="grn-detail-page">
        <section className="grn-empty">Loading GRN…</section>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="grn-detail-page">
        <div className="grn-alert grn-alert--error">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grn-detail-page">
        <section className="grn-empty">GRN not found.</section>
      </main>
    );
  }

  const status = statusOf(data);
  const reversible = canReverse(data);

  return (
    <main className="grn-detail-page">
      <header className="grn-detail-header">
        <div>
          <h1>GRN {text(data.grnNumber) || "—"}</h1>
          <p>
            {text(data.supplierName) || "No supplier"} ·{" "}
            {date(receiptDateOf(data))}
          </p>
        </div>

        <div className="grn-actions">
          <button
            type="button"
            className="grn-btn"
            onClick={() => navigate(`/companies/${companyId}/grns`)}
          >
            All GRNs
          </button>

          {isPosted(data) && (
            <button
              type="button"
              className="grn-btn grn-btn--danger"
              disabled={!reversible || busy}
              title={
                reversible
                  ? "Reverse this GRN"
                  : "Cannot reverse after stock has been issued"
              }
              onClick={() => void handleReverse()}
            >
              {busy ? "Reversing…" : "Reverse"}
            </button>
          )}
        </div>
      </header>

      {error && <div className="grn-alert grn-alert--error">{error}</div>}
      {success && <div className="grn-alert grn-alert--success">{success}</div>}

      <section className="grn-stats">
        <article>
          <span>Status</span>
          <strong>
            <StatusBadge value={status} />
          </strong>
        </article>

        <article>
          <span>Lines</span>
          <strong>{lines.length}</strong>
        </article>

        <article>
          <span>Total Cost</span>
          <strong>${money(totalCost)}</strong>
        </article>

        <article>
          <span>Issued</span>
          <strong>
            {isPosted(data)
              ? hasIssuedStock(data)
                ? "Yes"
                : "No"
              : "N/A"}
          </strong>
        </article>
      </section>

      <section className="grn-card">
        <h3>Receipt Information</h3>

        <div className="grn-info-grid">
          <Field label="GRN Number" value={text(data.grnNumber) || "—"} />
          <Field label="Status" value={<StatusBadge value={status} />} />
          <Field label="Location" value={locationOf(data) || "—"} />
          <Field label="Supplier" value={text(data.supplierName) || "—"} />
          <Field label="Received" value={date(receiptDateOf(data))} />
          <Field label="Posted" value={date(data.postedAt ?? data.postedAtUtc)} />
          <Field label="Notes" value={text(data.notes) || "—"} />
        </div>
      </section>

      <section className="grn-card">
        <h3>Line Items</h3>

        <div className="grn-table-wrap">
          <table className="grn-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>UOM</th>
                <th>Unit Cost</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Batch</th>
                <th>Expiry</th>
              </tr>
            </thead>

            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={9}>No line items.</td>
                </tr>
              ) : (
                lines.map((line, index) => (
                  <tr key={line.id ?? `${line.itemId}-${index}`}>
                    <td>{index + 1}</td>
                    <td className="grn-strong">
                      {text(line.itemName ?? line.itemCode ?? line.itemId) ||
                        "—"}
                    </td>
                    <td>{money(lineQuantity(line))}</td>
                    <td>
                      {text(line.uomName ?? line.uomCode ?? line.uomId) || "—"}
                    </td>
                    <td>${money(line.unitCost)}</td>
                    <td>${money(line.taxAmount)}</td>
                    <td className="grn-strong">${money(lineTotal(line))}</td>
                    <td>{text(line.batchNo) || "—"}</td>
                    <td>
                      {text(line.expiryDate ?? line.expiryDateUtc).slice(
                        0,
                        10
                      ) || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="grn-sticky-bar">
        <span>
          {reversible
            ? "Eligible for reversal because it is posted and not issued."
            : "Only posted, unissued GRNs can be reversed."}
        </span>

        <div className="grn-actions">
          <button
            type="button"
            className="grn-btn"
            onClick={() => navigate(`/companies/${companyId}/grns`)}
          >
            Back
          </button>

          {isPosted(data) && (
            <button
              type="button"
              className="grn-btn grn-btn--danger"
              disabled={!reversible || busy}
              onClick={() => void handleReverse()}
            >
              {busy ? "Reversing…" : "Reverse"}
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}