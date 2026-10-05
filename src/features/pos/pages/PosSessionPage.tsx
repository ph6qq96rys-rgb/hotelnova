import { useEffect, useMemo, useState } from "react";
import { SessionGate } from "../components/SessionGate";
import {
  Button,
  Card,
  ensurePosStyles,
  Field,
  money,
  Pill,
} from "../components/posUi";
import { usePosSession } from "../hooks/usePosSession";
import { useAppScope } from "../../../app/useAppScope";
import { extractApiError } from "../utils/posUtils";
import {
  posApi,
  setActiveStore,
  tryGetStoreId,
  type PosStoreDto,
} from "../api/posApi";

ensurePosStyles();

type CashCount = {
  label: string;
  value: number;
  qty: string;
};

type MessageTone = "success" | "error" | "warning" | "info";

type PageMessage = {
  tone: MessageTone;
  text: string;
};

const MIN_OPENING_FLOAT_ETB = 1;
const MAX_OPENING_FLOAT_ETB = 1_000_000;
const VARIANCE_NOTE_REQUIRED_THRESHOLD_ETB = 0.01;

const DEFAULT_TERMINAL = "POS-1";

const CASH_DENOMS: CashCount[] = [
  { label: "100", value: 100, qty: "" },
  { label: "50", value: 50, qty: "" },
  { label: "20", value: 20, qty: "" },
  { label: "10", value: 10, qty: "" },
  { label: "5", value: 5, qty: "" },
  { label: "1", value: 1, qty: "" },
  { label: "0.25", value: 0.25, qty: "" },
  { label: "0.10", value: 0.1, qty: "" },
  { label: "0.05", value: 0.05, qty: "" },
  { label: "0.01", value: 0.01, qty: "" },
];

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function durationText(openedAtUtc?: string): string {
  if (!openedAtUtc) return "-";

  const opened = new Date(openedAtUtc).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - opened) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${h}h ${m}m`;
}

function storeLabel(store: PosStoreDto): string {
  return store.code ? `${store.name} (${store.code})` : store.name;
}

function parseAmount(value: string, fallback = 0): number {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  const amount = Number.parseFloat(normalized || String(fallback));
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function isValidCashQuantity(value: string): boolean {
  if (!value.trim()) return true;

  const qty = Number(value);
  return Number.isInteger(qty) && qty >= 0;
}

function messageClass(tone: MessageTone): string {
  if (tone === "success") return "ok";
  if (tone === "warning") return "warn";
  if (tone === "info") return "info";
  return "bad";
}

function validateOpeningFloat(openingFloat: string | number): string | null {
  const amount = Number.parseFloat(String(openingFloat ?? ""));

  if (!Number.isFinite(amount)) {
    return "Opening cash float is required before a cashier session can be started.";
  }

  if (amount < MIN_OPENING_FLOAT_ETB) {
    return `Opening cash float must be at least ${MIN_OPENING_FLOAT_ETB.toFixed(2)} ETB.`;
  }

  if (amount > MAX_OPENING_FLOAT_ETB) {
    return "Opening cash float exceeds the authorized limit. Please contact a supervisor.";
  }

  return null;
}

export function PosSessionPage() {
  const { companyId, branchId } = useAppScope();
  const scope = { companyId, branchId };
  const sessionState = usePosSession(scope);

  const [stores, setStores] = useState<PosStoreDto[]>([]);
  const [storeId, setStoreId] = useState<string>(tryGetStoreId() ?? "");
  const [loadingStores, setLoadingStores] = useState(false);

  const [closingFloat, setClosingFloat] = useState("0");
  const [cashCounts, setCashCounts] = useState<CashCount[]>(CASH_DENOMS);
  const [managerPin, setManagerPin] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [message, setMessage] = useState<PageMessage | null>(null);

  const report = sessionState.xReport;

  useEffect(() => {
    let cancelled = false;

    async function loadStores() {
      setLoadingStores(true);

      try {
        const rows = await posApi.stores(scope);

        if (cancelled) return;

        const activeStores = rows
          .filter((x) => x.isActive !== false)
          .sort((a, b) => storeLabel(a).localeCompare(storeLabel(b)));

        setStores(activeStores);

        const current = tryGetStoreId();
        const currentStillExists = current && activeStores.some((x) => x.id === current);

        if (currentStillExists) {
          setStoreId(current);
          return;
        }

        if (activeStores.length === 1) {
          const onlyStore = activeStores[0];
          setStoreId(onlyStore.id);
          setActiveStore(onlyStore.id, onlyStore.name);
        }
      } catch (err) {
        if (!cancelled) {
          setMessage({ tone: "error", text: extractApiError(err, "The operation could not be completed. Please try again.") });
        }
      } finally {
        if (!cancelled) setLoadingStores(false);
      }
    }

    void loadStores();

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  const selectedStore = useMemo(
    () => stores.find((x) => x.id === storeId) ?? null,
    [stores, storeId],
  );

  const hasInvalidCashQuantity = useMemo(
    () => cashCounts.some((row) => !isValidCashQuantity(row.qty)),
    [cashCounts],
  );

  const countedCash = useMemo(() => {
    return round2(
      cashCounts.reduce((sum, row) => {
        const qty = isValidCashQuantity(row.qty) ? Number(row.qty || 0) : 0;
        return sum + row.value * qty;
      }, 0),
    );
  }, [cashCounts]);

  const expectedCash = Number(report?.expectedCash ?? 0);
  const closingCash = parseAmount(closingFloat, 0);
  const cashVariance = report && !Number.isNaN(closingCash) ? round2(closingCash - expectedCash) : null;
  const hasVariance = cashVariance !== null && Math.abs(cashVariance) >= VARIANCE_NOTE_REQUIRED_THRESHOLD_ETB;

  const reconciliationStatus = useMemo(() => {
    if (!report) return "Run an X Report to calculate the expected drawer balance.";
    if (Number.isNaN(closingCash)) return "Enter the counted drawer cash to begin reconciliation.";
    if (!hasVariance) return "Cash drawer successfully reconciled.";
    return "A cash discrepancy has been detected. Add a closing remark before final close.";
  }, [closingCash, hasVariance, report]);

  function onStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId);

    const store = stores.find((x) => x.id === nextStoreId);

    if (store) {
      setActiveStore(store.id, store.name);
      setMessage({ tone: "info", text: `Operating location set to ${storeLabel(store)}.` });
    }
  }

  function updateCashQty(index: number, qty: string) {
    setCashCounts((prev) => prev.map((row, i) => (i === index ? { ...row, qty } : row)));
  }

  function useCountedCash() {
    if (hasInvalidCashQuantity) {
      setMessage({ tone: "error", text: "Cash count quantities must be whole numbers greater than or equal to zero." });
      return;
    }

    setClosingFloat(String(countedCash));
    setMessage({ tone: "info", text: "Physical cash count copied to counted drawer balance." });
  }

  async function openSession(
    gateStoreId: string,
    cashierName: string,
    terminal: string,
    openingFloat: string | number,
  ): Promise<void> {
    const resolvedStoreId = gateStoreId || storeId;

    if (!resolvedStoreId) {
      setMessage({ tone: "error", text: "Select a POS location before starting a cashier session." });
      return;
    }

    if (!cashierName.trim()) {
      setMessage({ tone: "error", text: "Cashier name is required before starting a session." });
      return;
    }

    const openingFloatError = validateOpeningFloat(openingFloat);

    if (openingFloatError) {
      setMessage({ tone: "error", text: openingFloatError });
      return;
    }

    const amount = Number.parseFloat(String(openingFloat));

    setMessage(null);

    try {
      await sessionState.open({
        storeId: resolvedStoreId,
        cashierName: cashierName.trim(),
        terminal: terminal.trim() || DEFAULT_TERMINAL,
        openingFloat: amount,
      });

      setMessage({ tone: "success", text: "Cashier session started successfully." });
    } catch (err) {
      setMessage({ tone: "error", text: extractApiError(err, "The operation could not be completed. Please try again.") });
    }
  }

  async function closeSession() {
    setMessage(null);

    if (!sessionState.session) {
      setMessage({ tone: "error", text: "No active cashier session was found." });
      return;
    }

    if (Number.isNaN(closingCash) || closingCash < 0) {
      setMessage({ tone: "error", text: "Enter the physical cash counted in the drawer." });
      return;
    }

    if (hasInvalidCashQuantity) {
      setMessage({ tone: "error", text: "Cash count quantities must be whole numbers greater than or equal to zero." });
      return;
    }

    if (hasVariance && !closeNote.trim()) {
      setMessage({ tone: "warning", text: "A cash discrepancy requires a closing remark before the session can be closed." });
      return;
    }

    try {
      await sessionState.close(closingCash);
      setMessage({ tone: "success", text: "Cashier session closed and reconciled successfully." });
    } catch (err) {
      setMessage({ tone: "error", text: extractApiError(err, "The operation could not be completed. Please try again.") });
    }
  }

  return (
    <div className="erp-session-page">
      <style>{css}</style>

      <SessionGate
        loading={sessionState.loading || loadingStores}
        session={sessionState.session}
        busy={sessionState.busy}
        error={sessionState.error || message?.text || null}
        stores={stores}
        storesLoading={loadingStores}
        selectedStoreId={storeId}
        onStoreChange={onStoreChange}
        onOpen={openSession}
        onClose={sessionState.close}
      >
        <div className="erp-session-shell">
          <header className="erp-session-header">
            <div>
              <h1>POS Session Control</h1>
              <p>Cashier accountability, X/Z reporting, drawer counting, and cash reconciliation.</p>
            </div>

            <div className="erp-session-header-actions">
              <select
                className="erp-session-store-select"
                value={storeId}
                onChange={(e) => onStoreChange(e.target.value)}
                disabled={Boolean(sessionState.session)}
              >
                <option value="">{loadingStores ? "Loading POS locations..." : "Select POS location"}</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {storeLabel(store)}
                  </option>
                ))}
              </select>

              <Pill tone="green">SESSION OPEN</Pill>
              <Pill tone="gold">{sessionState.session?.terminal || DEFAULT_TERMINAL}</Pill>
              <Pill>{durationText(sessionState.session?.openedAtUtc)}</Pill>
            </div>
          </header>

          {selectedStore && (
            <Card className="erp-session-message">
              <span className="info">Operating Location: {storeLabel(selectedStore)}</span>
            </Card>
          )}

          {message && (
            <Card className="erp-session-message">
              <span className={messageClass(message.tone)}>{message.text}</span>
            </Card>
          )}

          <main className="erp-session-grid">
            <Card>
              <div className="erp-card-title">
                <span>Active Cashier Session</span>
                <Pill tone="green">Active</Pill>
              </div>

              {sessionState.session && (
                <div className="erp-field-grid">
                  <Field label="Cashier" value={sessionState.session.cashierName || "-"} />
                  <Field label="Terminal" value={sessionState.session.terminal || DEFAULT_TERMINAL} />
                  <Field label="Opened At" value={new Date(sessionState.session.openedAtUtc).toLocaleString()} />
                  <Field label="Session Duration" value={durationText(sessionState.session.openedAtUtc)} />
                  <Field label="Opening Cash Float" value={money(sessionState.session.openingFloat)} accent />
                </div>
              )}

              <div className="erp-action-row">
                <Button loading={sessionState.busy} onClick={() => sessionState.loadXReport()}>
                  Generate X Report
                </Button>

                <Button loading={sessionState.busy} variant="gold" onClick={() => sessionState.runZReport()}>
                  Generate Z Report
                </Button>
              </div>
            </Card>

            <Card>
              <div className="erp-card-title">
                <span>Physical Cash Count</span>
                <Pill tone={hasInvalidCashQuantity ? "red" : "gold"}>{money(countedCash)}</Pill>
              </div>

              <div className="erp-cash-table">
                {cashCounts.map((row, index) => {
                  const rowQtyValid = isValidCashQuantity(row.qty);
                  const rowTotal = rowQtyValid ? round2(Number(row.qty || 0) * row.value) : 0;

                  return (
                    <div key={row.label} className={rowQtyValid ? "erp-cash-row" : "erp-cash-row invalid"}>
                      <span>{row.label} ETB</span>
                      <input
                        className="erp-pos-input"
                        type="number"
                        min="0"
                        step="1"
                        value={row.qty}
                        onChange={(e) => updateCashQty(index, e.target.value)}
                        placeholder="Qty"
                      />
                      <strong>{money(rowTotal)}</strong>
                    </div>
                  );
                })}
              </div>

              {hasInvalidCashQuantity && (
                <div className="erp-inline-warning">Cash count quantities must be whole numbers only.</div>
              )}

              <Button style={{ width: "100%", marginTop: 12 }} onClick={useCountedCash}>
                Use Physical Count as Counted Drawer Balance
              </Button>
            </Card>

            <Card>
              <div className="erp-card-title">
                <span>Close & Reconcile Session</span>
                <Pill tone="red">Controlled</Pill>
              </div>

              <label className="erp-pos-label">Counted Cash in Drawer</label>
              <input
                className="erp-pos-input"
                type="number"
                min="0"
                value={closingFloat}
                onChange={(e) => setClosingFloat(e.target.value)}
              />

              <label className="erp-pos-label">Supervisor Authorization</label>
              <input
                className="erp-pos-input"
                type="password"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                placeholder="Approval code when supervisor control is enabled"
              />

              <label className="erp-pos-label">Closing Remarks</label>
              <textarea
                className="erp-pos-input"
                rows={4}
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder="Variance explanation, drawer issue, safe drop note, or supervisor instruction..."
              />

              <div className="erp-close-summary">
                <div>
                  <span>Expected Drawer Balance</span>
                  <strong>{money(expectedCash)}</strong>
                </div>
                <div>
                  <span>Counted Drawer Balance</span>
                  <strong>{money(Number.isNaN(closingCash) ? 0 : closingCash)}</strong>
                </div>
                <div className={hasVariance ? "warning" : ""}>
                  <span>Cash Difference</span>
                  <strong>{cashVariance == null ? "-" : money(cashVariance)}</strong>
                </div>
              </div>

              <Button
                variant="danger"
                loading={sessionState.busy}
                style={{ width: "100%", marginTop: 14 }}
                onClick={closeSession}
              >
                Close & Reconcile Session
              </Button>
            </Card>

            <Card className="erp-report-card">
              <div className="erp-card-title">
                <span>Session Reconciliation Report</span>
                <div className="erp-report-actions">
                  <Button onClick={() => window.print()}>Print</Button>
                  <Button onClick={() => sessionState.loadXReport()}>Refresh</Button>
                </div>
              </div>

              {!report ? (
                <div className="erp-empty-state">Generate an X Report or Z Report to view cashier totals.</div>
              ) : (
                <>
                  <div className="erp-kpi-grid">
                    <Field label="Sales Count" value={report.saleCount} />
                    <Field label="Gross Sales" value={money(report.grossSales)} />
                    <Field label="Total COGS" value={money(report.totalCogs)} />
                    <Field label="Gross Profit" value={money(report.grossProfit)} accent />
                    <Field label="Cash Sales" value={money(report.cashSales)} />
                    <Field label="Card / Other Payments" value={money(report.cardSales)} />
                    <Field label="Tips Recorded (not sales)" value={money(report.totalTips ?? 0)} />
                    <Field label="Cash Tips in Drawer" value={money(report.cashTips ?? 0)} />
                    <Field label="Cash Tips Paid Out" value={money(report.cashTipPayouts ?? 0)} />
                    <Field label="Expected Drawer Balance" value={money(report.expectedCash)} />
                    <Field label="System Cash Difference" value={report.cashVariance == null ? "-" : money(report.cashVariance)} />
                  </div>

                  <div className="erp-reconciliation-banner">
                    <div>
                      <strong>Reconciliation Status</strong>
                      <span>{reconciliationStatus}</span>
                    </div>

                    <Pill tone={cashVariance === 0 ? "green" : hasVariance ? "gold" : undefined}>
                      {cashVariance == null ? "Pending" : money(cashVariance)}
                    </Pill>
                  </div>
                </>
              )}
            </Card>
          </main>
        </div>
      </SessionGate>
    </div>
  );
}

const css = `
.erp-session-page {
  background: #09090b;
  color: #fafaf9;
  min-height: 100%;
  padding: 16px;
}

.erp-session-store-select {
  border: 1px solid #3f3f46;
  background: #111113;
  color: #fafaf9;
  border-radius: 999px;
  padding: 8px 12px;
  min-width: 190px;
}

.erp-session-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.erp-session-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.erp-session-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
}

.erp-session-header p {
  margin: 5px 0 0;
  color: #a1a1aa;
  line-height: 1.45;
}

.erp-session-header-actions,
.erp-action-row,
.erp-report-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.erp-session-message .ok { color: #86efac; }
.erp-session-message .bad { color: #fca5a5; }
.erp-session-message .warn { color: #fbbf24; }
.erp-session-message .info { color: #93c5fd; }

.erp-session-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.erp-report-card {
  grid-column: 1 / -1;
}

.erp-card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 850;
  margin-bottom: 14px;
}

.erp-field-grid,
.erp-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.erp-action-row {
  margin-top: 14px;
}

.erp-cash-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.erp-cash-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr) 96px;
  gap: 8px;
  align-items: center;
}

.erp-cash-row span {
  color: #d4d4d8;
  font-size: 13px;
  font-weight: 700;
}

.erp-cash-row strong {
  text-align: right;
}

.erp-cash-row.invalid input {
  border-color: rgba(248, 113, 113, 0.75);
}

.erp-inline-warning {
  margin-top: 10px;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.08);
  color: #fbbf24;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
}

.erp-close-summary {
  margin-top: 14px;
  border: 1px solid #27272a;
  background: #111113;
  border-radius: 14px;
  overflow: hidden;
}

.erp-close-summary div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid #27272a;
}

.erp-close-summary div:last-child {
  border-bottom: 0;
}

.erp-close-summary span {
  color: #a1a1aa;
  font-size: 13px;
}

.erp-close-summary .warning strong {
  color: #fbbf24;
}

.erp-reconciliation-banner {
  margin-top: 14px;
  border: 1px solid rgba(212, 168, 83, 0.35);
  background: rgba(212, 168, 83, 0.09);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.erp-reconciliation-banner div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.erp-reconciliation-banner span {
  color: #d4d4d8;
  font-size: 13px;
  line-height: 1.45;
}

.erp-empty-state {
  color: #71717a;
  border: 1px dashed #3f3f46;
  border-radius: 14px;
  padding: 24px;
  text-align: center;
}

@media (max-width: 1100px) {
  .erp-session-grid {
    grid-template-columns: 1fr;
  }

  .erp-report-card {
    grid-column: auto;
  }
}

@media (max-width: 680px) {
  .erp-session-page {
    padding: 10px;
  }

  .erp-session-header {
    flex-direction: column;
  }

  .erp-field-grid,
  .erp-kpi-grid {
    grid-template-columns: 1fr;
  }

  .erp-cash-row {
    grid-template-columns: 74px minmax(0, 1fr) 88px;
  }
}
`;
