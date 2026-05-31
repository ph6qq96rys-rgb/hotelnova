// src/features/hr/pages/leave/LeaveBalancePage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { leaveApi } from '../../api/hrApi';
import type { LeaveBalanceDto } from '../../types/index';
import { getApiError } from '../../utils/hrUtils';

export default function LeaveBalancePage() {
  const nav              = useNavigate();
  const { employeeId }   = useParams<{ employeeId: string }>();
  const { companyId }    = useAppScope();

  const currentYear      = new Date().getFullYear();
  const [year,     setYear]     = useState(currentYear);
  const [balances, setBalances] = useState<LeaveBalanceDto[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !employeeId) return;
    setLoading(true); setError(null);
    try {
      setBalances(await leaveApi.getBalances(companyId, employeeId, year));
    } catch (e) {
      setError(getApiError(e, 'Failed to load leave balances.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId, year]);

  useEffect(() => { load(); }, [load]);

  // Totals across all leave types
  const totalEntitled = balances.reduce((s, b) => s + b.entitled,  0);
  const totalTaken    = balances.reduce((s, b) => s + b.taken,     0);
  const totalPending  = balances.reduce((s, b) => s + (b.pending ?? 0), 0);
  const totalBalance  = balances.reduce((s, b) => s + b.balance,   0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Leave</div>
          <div className="page-title">Leave Balances</div>
          <div className="page-sub">
            Entitlements and remaining balances for employee {employeeId}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="select"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ height: 36, padding: '0 10px', fontSize: 13 }}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn btn-primary"
            onClick={() => nav(`/hr/leave/new`)}>
            + New Request
          </button>
          <button className="btn" onClick={() => nav(-1)}>← Back</button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Total Entitled</div>
          <div className="kpi-val">{totalEntitled}</div>
          <div className="kpi-sub">days this year</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Taken</div>
          <div className="kpi-val" style={{ color: 'var(--accent)' }}>{totalTaken}</div>
          <div className="kpi-sub">days used</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Pending</div>
          <div className="kpi-val" style={{ color: totalPending > 0 ? 'var(--warn)' : 'var(--text-muted)' }}>
            {totalPending}
          </div>
          <div className="kpi-sub">awaiting approval</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Remaining</div>
          <div className="kpi-val" style={{ color: totalBalance > 0 ? 'var(--success)' : 'var(--danger)' }}>
            {totalBalance}
          </div>
          <div className="kpi-sub">days available</div>
        </div>
      </div>

      {/* Balance cards */}
      {!loading && balances.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}>
          {balances.map(b => {
            const usedPct     = b.entitled > 0 ? (b.taken / b.entitled) * 100 : 0;
            const pendingPct  = b.entitled > 0 ? ((b.pending ?? 0) / b.entitled) * 100 : 0;
            const remaining   = b.balance;
            const isLow       = remaining <= 2 && b.entitled > 0;

            return (
              <div key={b.leaveTypeId} className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {b.leaveTypeName}
                    </div>
                    {b.carryForward != null && b.carryForward > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        +{b.carryForward} carried forward
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)',
                    color: isLow ? 'var(--danger)' : remaining > 0 ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    {remaining}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                      left
                    </span>
                  </div>
                </div>

                {/* Stacked progress bar: taken + pending */}
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ display: 'flex', height: '100%' }}>
                    <div style={{
                      width: `${Math.min(usedPct, 100)}%`,
                      background: 'var(--accent)',
                      transition: 'width 0.3s',
                    }} />
                    <div style={{
                      width: `${Math.min(pendingPct, 100 - usedPct)}%`,
                      background: 'var(--warn)',
                      opacity: 0.6,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{b.taken}</span> taken
                  </span>
                  {(b.pending ?? 0) > 0 && (
                    <span>
                      <span style={{ color: 'var(--warn)', fontWeight: 500 }}>{b.pending}</span> pending
                    </span>
                  )}
                  <span>of {b.entitled} entitled</span>
                </div>

                {isLow && (
                  <div style={{
                    marginTop: 10, fontSize: 11, color: 'var(--danger)',
                    padding: '4px 8px', borderRadius: 4,
                    background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                  }}>
                    Low balance
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed table */}
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Leave Type</th>
              <th style={{ textAlign: 'right' }}>Entitled</th>
              <th style={{ textAlign: 'right' }}>Carry Fwd</th>
              <th style={{ textAlign: 'right' }}>Taken</th>
              <th style={{ textAlign: 'right' }}>Pending</th>
              <th style={{ textAlign: 'right' }}>Remaining</th>
              <th style={{ minWidth: 120 }}>Usage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : balances.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 56, textAlign: 'center', color: 'var(--text-soft)' }}>
                No leave balance data for {year}.
              </td></tr>
            ) : balances.map(b => {
              const pct = b.entitled > 0 ? Math.min((b.taken / b.entitled) * 100, 100) : 0;
              return (
                <tr key={b.leaveTypeId}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{b.leaveTypeName}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{b.entitled}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {b.carryForward ?? '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>
                    {b.taken}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: b.pending ? 'var(--warn)' : 'var(--text-muted)' }}>
                    {b.pending ?? 0}
                  </td>
                  <td style={{
                    textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                    color: b.balance <= 0 ? 'var(--danger)' : b.balance <= 2 ? 'var(--warn)' : 'var(--success)',
                  }}>
                    {b.balance}
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', borderRadius: 2, background: 'var(--accent)',
                          width: `${pct}%`,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', minWidth: 32 }}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            {balances.length > 0 && (
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td style={{ fontSize: 12 }}>Total</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{totalEntitled}</td>
                <td />
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{totalTaken}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--warn)' }}>{totalPending}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: totalBalance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {totalBalance}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}