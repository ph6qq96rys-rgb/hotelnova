import { useEffect, useMemo, useState } from "react";
import { operationsApi } from "../api/operationsApi";
import type { CashierShiftDto, EndOfDayReportDto, SafeDropDto, SalesSummaryDto } from "../api/operationsTypes";
import "../styles/operations.css";

function useAppScope() {
  return {
    companyId: localStorage.getItem("companyId") || "",
    branchId: localStorage.getItem("branchId") || "",
  };
}

export default function OperationsDashboardPage() {
  const { companyId, branchId } = useAppScope();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<CashierShiftDto | null>(null);
  const [drops, setDrops] = useState<SafeDropDto[]>([]);
  const [summary, setSummary] = useState<SalesSummaryDto | null>(null);
  const [eod, setEod] = useState<EndOfDayReportDto | null>(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    const from = new Date(`${businessDate}T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
    return { fromUtc: from.toISOString(), toUtc: to.toISOString() };
  }, [businessDate]);

  async function refresh() {
    if (!companyId || !branchId) return;
    const [open, sum] = await Promise.all([
      operationsApi.currentOpenShift(companyId, branchId),
      operationsApi.salesSummary(companyId, branchId, range.fromUtc, range.toUtc),
    ]);
    setShift(open.data ?? null);
    setSummary(sum.data);
    if (open.data?.id) {
      const d = await operationsApi.safeDrops(companyId, branchId, open.data.id);
      setDrops(d.data ?? []);
    } else {
      setDrops([]);
    }
  }

  useEffect(() => { refresh(); }, [companyId, branchId, businessDate]);

  async function openShift() {
    const cashierName = prompt("Cashier name?") || "";
    if (!cashierName.trim()) return;
    const terminal = prompt("Terminal?", "POS-1") || "POS-1";
    const openingFloat = Number(prompt("Opening float?", "0") || "0");
    setBusy(true);
    try {
      await operationsApi.openShift(companyId, branchId, { cashierName, terminal, openingFloat });
      await refresh();
    } finally { setBusy(false); }
  }

  async function closeShift() {
    if (!shift) return;
    const closingCash = Number(prompt("Closing cash?", "0") || "0");
    const notes = prompt("Notes?", "") || "";
    setBusy(true);
    try {
      await operationsApi.closeShift(companyId, branchId, shift.id, { closingCash, notes });
      await refresh();
    } finally { setBusy(false); }
  }

  async function safeDrop() {
    if (!shift) return;
    const amount = Number(prompt("Safe drop amount?", "0") || "0");
    if (amount <= 0) return;
    const referenceNo = prompt("Reference no?", "") || "";
    setBusy(true);
    try {
      await operationsApi.createSafeDrop(companyId, branchId, { cashierShiftId: shift.id, amount, method: "CASH", referenceNo });
      await refresh();
    } finally { setBusy(false); }
  }

  async function generateEod() {
    setBusy(true);
    try {
      const r = await operationsApi.generateEndOfDay(companyId, branchId, businessDate);
      setEod(r.data);
    } finally { setBusy(false); }
  }

  return (
    <main className="ops-page">
      <header className="ops-title">
        <div>
          <span>HotelNova Operations</span>
          <h1>Cashier & End-of-Day Control Center</h1>
          <p>Cashier shifts, safe drops, sales summary, and end-of-day report.</p>
        </div>
        <input className="ops-input" type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
      </header>

      <section className="ops-grid">
        <div className="ops-card">
          <div className="ops-card-head">
            <div><span>Cashier Shift</span><h2>{shift ? "Open" : "No open shift"}</h2></div>
            <b className={shift ? "ops-pill good" : "ops-pill warn"}>{shift ? "ACTIVE" : "CLOSED"}</b>
          </div>
          {shift ? (
            <div className="ops-detail">
              <p><b>Cashier:</b> {shift.cashierName}</p>
              <p><b>Terminal:</b> {shift.terminal}</p>
              <p><b>Opening Float:</b> {money(shift.openingFloat)}</p>
              <p><b>Opened:</b> {new Date(shift.openedAtUtc).toLocaleString()}</p>
            </div>
          ) : <div className="ops-empty">Open a shift before receiving cash or safe drops.</div>}
          <div className="ops-actions">
            {!shift && <button disabled={busy} onClick={openShift}>Open Shift</button>}
            {shift && <button disabled={busy} onClick={safeDrop}>Safe Drop</button>}
            {shift && <button disabled={busy} onClick={closeShift}>Close Shift</button>}
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>Sales Summary</span><h2>{money(summary?.netSales ?? 0)}</h2></div></div>
          <div className="ops-kpis">
            <Kpi label="Sales Count" value={summary?.salesCount ?? 0} />
            <Kpi label="Gross Sales" value={money(summary?.grossSales ?? 0)} />
            <Kpi label="Discount" value={money(summary?.discount ?? 0)} />
            <Kpi label="Tax" value={money(summary?.tax ?? 0)} />
            <Kpi label="COGS" value={money(summary?.totalCogs ?? 0)} />
            <Kpi label="Gross Profit" value={money(summary?.grossProfit ?? 0)} />
          </div>
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>Safe Drops</span><h2>{money(drops.reduce((s, x) => s + x.amount, 0))}</h2></div></div>
          {drops.length === 0 && <div className="ops-empty">No safe drops recorded.</div>}
          {drops.map(x => (
            <div className="ops-list-row" key={x.id}>
              <div><b>{money(x.amount)}</b><small>{x.droppedByName} • {new Date(x.droppedAtUtc).toLocaleString()}</small></div>
              <span>{x.method}</span>
            </div>
          ))}
        </div>

        <div className="ops-card">
          <div className="ops-card-head"><div><span>End of Day</span><h2>{eod ? "Generated" : "Pending"}</h2></div></div>
          {eod ? (
            <div className="ops-kpis">
              <Kpi label="Net Sales" value={money(eod.netSales)} />
              <Kpi label="Payments" value={money(eod.totalPayments)} />
              <Kpi label="Safe Drops" value={money(eod.totalSafeDrops)} />
              <Kpi label="Cash Variance" value={money(eod.cashVariance)} />
            </div>
          ) : <div className="ops-empty">Generate end-of-day report after all shifts are closed.</div>}
          <button className="ops-primary" disabled={busy} onClick={generateEod}>Generate End-of-Day</button>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="ops-kpi"><span>{label}</span><b>{value}</b></div>;
}

function money(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v || 0);
}
