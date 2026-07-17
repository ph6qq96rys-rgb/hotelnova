import { useMemo, useState } from "react";
import { posApi } from "../api/posApi";
import { useAppScope } from "../../../app/useAppScope";
import { extractApiError } from "../utils/posUtils";
import {
  Button,
  Card,
  ensurePosStyles,
  Field,
  money,
  Pill,
} from "../components/posUi";

ensurePosStyles();

type OperationResult = {
  posted?: number;
  skipped?: number;
  failed?: number;
  errors?: string[];
  warnings?: string[];
  totalCogsAmount?: number;
  [key: string]: unknown;
};

type OperationStatus = "IDLE" | "RUNNING" | "SUCCESS" | "WARNING" | "FAILED";

const MAX_PROCESSING_DAYS = 31;

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayIsoDate(): string {
  return toLocalIsoDate(new Date());
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalIsoDate(d);
}

function parseDate(value: string): Date | null {
  if (!value) return null;

  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);

  if (!from || !to) return 0;

  const diff = to.getTime() - from.getTime();
  return Math.floor(diff / 86_400_000) + 1;
}

function statusLabel(status: OperationStatus): string {
  switch (status) {
    case "RUNNING":
      return "Processing";
    case "SUCCESS":
      return "Completed Successfully";
    case "WARNING":
      return "Completed with Exceptions";
    case "FAILED":
      return "Processing Failed";
    default:
      return "Ready for Processing";
  }
}

function statusTone(status: OperationStatus): "green" | "gold" | "red" | undefined {
  if (status === "SUCCESS") return "green";
  if (status === "WARNING" || status === "RUNNING") return "gold";
  if (status === "FAILED") return "red";
  return undefined;
}

function toSafeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildRangeValidation(fromDate: string, toDate: string, rangeDays: number): string {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);

  if (!from || !to) return "Select a valid processing period.";
  if (from > to) return "The start date cannot be later than the end date.";
  if (rangeDays > MAX_PROCESSING_DAYS) {
    return `Process a maximum of ${MAX_PROCESSING_DAYS} days per execution to maintain system performance and audit traceability.`;
  }

  return "";
}

export function PosOperationsPage() {
  const { companyId, branchId } = useAppScope();
  const [fromDate, setFromDate] = useState(todayIsoDate());
  const [toDate, setToDate] = useState(todayIsoDate());
  const [result, setResult] = useState<OperationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<OperationStatus>("IDLE");
  const [error, setError] = useState("");
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const rangeDays = useMemo(() => daysBetween(fromDate, toDate), [fromDate, toDate]);

  const invalidRange = useMemo(
    () => buildRangeValidation(fromDate, toDate, rangeDays),
    [fromDate, rangeDays, toDate]
  );

  const warnings = result?.warnings ?? [];
  const errors = result?.errors ?? [];
  const posted = toSafeNumber(result?.posted);
  const skipped = toSafeNumber(result?.skipped);
  const failed = toSafeNumber(result?.failed);
  const exceptionCount = errors.length + warnings.length;

  const runBulkCogs = async () => {
    if (loading) return;

    if (invalidRange) {
      setError(invalidRange);
      setStatus("FAILED");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setStatus("RUNNING");

    try {
      const response = await posApi.postBulkCogs({ companyId, branchId }, fromDate, toDate);
      const payload = (response ?? {}) as OperationResult;

      setResult(payload);
      setLastRunAt(new Date().toLocaleString());

      const hasFailures =
        toSafeNumber(payload.failed) > 0 || (payload.errors?.length ?? 0) > 0;
      const hasWarnings =
        (payload.warnings?.length ?? 0) > 0 || toSafeNumber(payload.skipped) > 0;

      if (hasFailures) setStatus("FAILED");
      else if (hasWarnings) setStatus("WARNING");
      else setStatus("SUCCESS");
    } catch (err) {
      setStatus("FAILED");
      setError(extractApiError(err, "Bulk COGS posting failed. Review the processing log and try again."));
    } finally {
      setLoading(false);
    }
  };

  const setToday = () => {
    const today = todayIsoDate();
    setFromDate(today);
    setToDate(today);
    setError("");
  };

  const setYesterday = () => {
    const yesterday = addDaysIso(-1);
    setFromDate(yesterday);
    setToDate(yesterday);
    setError("");
  };

  const setLast7Days = () => {
    setFromDate(addDaysIso(-6));
    setToDate(todayIsoDate());
    setError("");
  };

  const setMonthToDate = () => {
    const d = new Date();
    const firstDay = toLocalIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));

    setFromDate(firstDay);
    setToDate(todayIsoDate());
    setError("");
  };

  return (
    <div className="erp-ops-page">
      <style>{css}</style>

      <div className="erp-ops-shell">
        <header className="erp-ops-header">
          <div>
            <h1>POS Operations Control Center</h1>
            <p>
              Execute controlled end-of-day processing, inventory accounting catch-up,
              exception review, and POS operational recovery tasks.
            </p>
          </div>

          <div className="erp-ops-header-actions">
            <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
            {lastRunAt && <Pill>Last execution: {lastRunAt}</Pill>}
          </div>
        </header>

        {(error || invalidRange) && (
          <Card className="erp-ops-alert">
            <strong>{error || invalidRange}</strong>
          </Card>
        )}

        <main className="erp-ops-grid">
          <Card className="erp-job-card">
            <div className="erp-card-title">
              <span>Bulk Cost of Goods Posting</span>
              <Pill tone="gold">Inventory Accounting</Pill>
            </div>

            <p className="erp-muted">
              This controlled process posts cost of goods sold for confirmed POS sales
              that were not posted during checkout. Use it during end-of-day close,
              after interrupted network/API activity, or when accounting requires POS
              inventory consumption to be synchronized.
            </p>

            <div className="erp-date-presets">
              <Button onClick={setToday}>Today</Button>
              <Button onClick={setYesterday}>Yesterday</Button>
              <Button onClick={setLast7Days}>Last 7 Days</Button>
              <Button onClick={setMonthToDate}>Month to Date</Button>
            </div>

            <div className="erp-date-grid">
              <div>
                <label className="erp-pos-label">Processing Start Date</label>
                <input
                  className="erp-pos-input"
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setError("");
                  }}
                />
              </div>

              <div>
                <label className="erp-pos-label">Processing End Date</label>
                <input
                  className="erp-pos-input"
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setError("");
                  }}
                />
              </div>

              <div>
                <label className="erp-pos-label">Processing Window</label>
                <div className="erp-readonly-box">
                  {rangeDays > 0 ? `${rangeDays} day(s)` : "—"}
                </div>
              </div>
            </div>

            <div className="erp-warning-box">
              <strong>Pre-processing Checklist</strong>
              <span>
                Confirm that sales are finalized, menu recipes are configured,
                inventory consumption locations exist, and stock balances/FIFO layers
                are available before starting this operation.
              </span>
            </div>

            <Button
              variant="gold"
              loading={loading}
              disabled={Boolean(invalidRange)}
              onClick={runBulkCogs}
              style={{ width: "100%", marginTop: 16 }}
            >
              Start Bulk COGS Posting
            </Button>
          </Card>

          <Card>
            <div className="erp-card-title">
              <span>Operation Summary</span>
              <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
            </div>

            <div className="erp-summary-grid">
              <Field label="Successfully Posted" value={posted} accent />
              <Field label="Skipped Records" value={skipped} />
              <Field label="Failed Records" value={failed} />
              <Field
                label="COGS Amount"
                value={
                  typeof result?.totalCogsAmount === "number"
                    ? money(result.totalCogsAmount)
                    : "—"
                }
              />
            </div>

            <div className="erp-status-panel">
              <strong>Processing Status</strong>
              <span>
                {status === "IDLE" && "The system is ready to execute the selected POS operation."}
                {status === "RUNNING" &&
                  "Processing confirmed sales and generating inventory consumption records."}
                {status === "SUCCESS" && "Bulk COGS posting completed successfully."}
                {status === "WARNING" &&
                  "Processing completed with exceptions. Review the warning log before continuing."}
                {status === "FAILED" &&
                  "Processing was unsuccessful. Review the error log and correct any issues before retrying."}
              </span>
            </div>
          </Card>

          <Card>
            <div className="erp-card-title">
              <span>ERP Control Checks</span>
              <Pill>Required</Pill>
            </div>

            <div className="erp-check-list">
              <div>
                <strong>Menu recipe master data</strong>
                <span>Every sellable menu item must have an active recipe configuration.</span>
              </div>
              <div>
                <strong>Inventory consumption locations</strong>
                <span>Each branch/store must define the issue location used for POS consumption.</span>
              </div>
              <div>
                <strong>FIFO stock availability</strong>
                <span>Inventory layers should be available before sales are consumed.</span>
              </div>
              <div>
                <strong>Cashier session review</strong>
                <span>Run this after cashier/session review whenever possible.</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="erp-card-title">
              <span>Operational Recovery Actions</span>
              <Pill tone="gold">Pending Backend</Pill>
            </div>

            <div className="erp-action-list">
              <button disabled>Recover Failed Transactions</button>
              <button disabled>Reprint Customer Receipt</button>
              <button disabled>Rebuild Inventory FIFO Layers</button>
              <button disabled>Synchronize Menu Prices</button>
              <button disabled>Export POS Audit Report</button>
            </div>

            <p className="erp-muted">
              These controls are intentionally disabled until the matching backend
              endpoints and authorization policies are available.
            </p>
          </Card>

          <Card className="erp-log-card">
            <div className="erp-card-title">
              <span>Processing Log</span>
              <Pill tone={errors.length > 0 ? "red" : warnings.length > 0 ? "gold" : "green"}>
                {exceptionCount}
              </Pill>
            </div>

            {errors.length === 0 && warnings.length === 0 ? (
              <div className="erp-empty-state">No processing exceptions have been recorded.</div>
            ) : (
              <div className="erp-log-list">
                {errors.map((item, index) => (
                  <div key={`error-${index}`} className="erp-log-line error">
                    <strong>Error</strong>
                    <span>{item}</span>
                  </div>
                ))}

                {warnings.map((item, index) => (
                  <div key={`warning-${index}`} className="erp-log-line warning">
                    <strong>Warning</strong>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {result && (
            <Card className="erp-raw-card">
              <div className="erp-card-title">
                <span>Diagnostic Output</span>
                <Pill>System</Pill>
              </div>

              <pre>{JSON.stringify(result, null, 2)}</pre>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

const css = `
.erp-ops-page {
  background: #09090b;
  color: #fafaf9;
  min-height: 100%;
  padding: 16px;
}

.erp-ops-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.erp-ops-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.erp-ops-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 850;
}

.erp-ops-header p {
  margin: 5px 0 0;
  color: #a1a1aa;
  line-height: 1.45;
}

.erp-ops-header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.erp-ops-alert {
  border-color: rgba(248, 113, 113, 0.45) !important;
  color: #f87171;
}

.erp-ops-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 14px;
  align-items: start;
}

.erp-job-card {
  grid-row: span 2;
}

.erp-card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 14px;
}

.erp-muted {
  color: #a1a1aa;
  font-size: 13px;
  line-height: 1.55;
}

.erp-date-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
}

.erp-date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 150px;
  gap: 12px;
  align-items: end;
}

.erp-readonly-box {
  border: 1px solid #27272a;
  background: #111113;
  color: #fafaf9;
  border-radius: 10px;
  padding: 11px 12px;
  min-height: 42px;
  display: flex;
  align-items: center;
}

.erp-warning-box {
  margin-top: 14px;
  border: 1px solid rgba(212, 168, 83, 0.35);
  background: rgba(212, 168, 83, 0.09);
  border-radius: 14px;
  padding: 13px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.erp-warning-box span {
  color: #d4d4d8;
  font-size: 13px;
  line-height: 1.5;
}

.erp-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.erp-status-panel {
  margin-top: 14px;
  border: 1px solid #27272a;
  background: #111113;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.erp-status-panel span {
  color: #a1a1aa;
  font-size: 13px;
  line-height: 1.45;
}

.erp-check-list,
.erp-action-list,
.erp-log-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.erp-check-list div {
  border: 1px solid #27272a;
  background: #111113;
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.erp-check-list span {
  color: #a1a1aa;
  font-size: 13px;
}

.erp-action-list button {
  border: 1px solid #27272a;
  background: #111113;
  color: #71717a;
  border-radius: 12px;
  padding: 12px;
  text-align: left;
  cursor: not-allowed;
}

.erp-log-card,
.erp-raw-card {
  grid-column: 1 / -1;
}

.erp-empty-state {
  color: #71717a;
  border: 1px dashed #3f3f46;
  border-radius: 14px;
  padding: 24px;
  text-align: center;
}

.erp-log-line {
  border: 1px solid #27272a;
  background: #111113;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.erp-log-line.error strong {
  color: #f87171;
}

.erp-log-line.warning strong {
  color: #fbbf24;
}

.erp-log-line span {
  color: #d4d4d8;
  white-space: pre-wrap;
}

.erp-raw-card pre {
  margin: 0;
  background: #111113;
  border: 1px solid #27272a;
  color: #d4d4d8;
  border-radius: 14px;
  padding: 14px;
  overflow: auto;
  max-height: 360px;
}

@media (max-width: 980px) {
  .erp-ops-grid {
    grid-template-columns: 1fr;
  }

  .erp-job-card,
  .erp-log-card,
  .erp-raw-card {
    grid-column: auto;
    grid-row: auto;
  }
}

@media (max-width: 680px) {
  .erp-ops-page {
    padding: 10px;
  }

  .erp-ops-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .erp-date-grid,
  .erp-summary-grid {
    grid-template-columns: 1fr;
  }
}
`;
