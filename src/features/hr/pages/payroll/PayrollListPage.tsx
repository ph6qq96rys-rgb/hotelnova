import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { payrollApi } from '../../api/hrApi';
import type { PayrollRunDto } from '../../types/index';
import { PAYROLL_STATUS_CLASS, fmtDate, fmtMoney, getApiError } from '../../utils/hrUtils';

export default function PayrollListPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const [items,   setItems]   = useState<PayrollRunDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [year,    setYear]    = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try { setItems(await payrollApi.listRuns(companyId, year)); }
    catch (e) { setError(getApiError(e, 'Failed to load payroll runs.')); }
    finally { setLoading(false); }
  }, [companyId, year]);

  useEffect(() => { load(); }, [load]);

  async function run(id: string, action: string) {
    if (!companyId) return;
    setWorking(id); setError(null);
    try {
      if (action === 'process') await payrollApi.processRun(companyId, id, 'HR');
      if (action === 'approve') await payrollApi.approveRun(companyId, id, 'HR');
      if (action === 'pay')     await payrollApi.markPaid(companyId, id, 'HR');
      await load();
    } catch (e) { setError(getApiError(e, 'Action failed.')); }
    finally { setWorking(null); }
  }

  const totals = {
    gross: items.reduce((s, r) => s + r.totalGross, 0),
    net:   items.reduce((s, r) => s + r.totalNet,   0),
    emps:  items.reduce((s, r) => s + r.employeeCount, 0),
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources</div>
          <div className="page-title">Payroll</div>
          <div className="page-sub">Process and approve salary runs</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="select" value={year} onChange={e => setYear(+e.target.value)}
            style={{ height: 36, padding: '0 10px', fontSize: 13 }}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => nav('/hr/payroll/new')}>
            + New Run
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Runs This Year</div>
          <div className="kpi-val">{items.length}</div>
          <div className="kpi-sub">payroll runs</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Gross</div>
          <div className="kpi-val" style={{ fontSize: 15 }}>{fmtMoney(totals.gross)}</div>
          <div className="kpi-sub">year to date</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total Net</div>
          <div className="kpi-val" style={{ fontSize: 15 }}>{fmtMoney(totals.net)}</div>
          <div className="kpi-sub">after deductions</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending</div>
          <div className="kpi-val">{items.filter(r => r.status === 'Pending' || r.status === 'Draft').length}</div>
          <div className="kpi-sub">awaiting action</div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Date Range</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Employees</th>
              <th style={{ textAlign: 'right' }}>Gross Pay</th>
              <th style={{ textAlign: 'right' }}>Deductions</th>
              <th style={{ textAlign: 'right' }}>Net Pay</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : items.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{r.periodName}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                  {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                </td>
                <td><span className={PAYROLL_STATUS_CLASS[r.status]}>{r.status}</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {r.employeeCount}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {fmtMoney(r.totalGross)}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)' }}>
                  ({fmtMoney(r.totalDeductions)})
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
                  {fmtMoney(r.totalNet)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {r.status === 'Draft' && (
                      <button className="btn btn-sm" disabled={working === r.id}
                        onClick={() => run(r.id, 'process')}>
                        Process
                      </button>
                    )}
                    {r.status === 'Pending' && (
                      <button className="btn btn-sm" disabled={working === r.id}
                        onClick={() => run(r.id, 'approve')}>
                        Approve
                      </button>
                    )}
                    {r.status === 'Approved' && (
                      <button className="btn btn-sm" disabled={working === r.id}
                        onClick={() => run(r.id, 'pay')}>
                        Mark Paid
                      </button>
                    )}
                    <button className="btn btn-sm"
                      onClick={() => nav(`/hr/payroll/runs/${r.id}`)}>
                      View →
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
