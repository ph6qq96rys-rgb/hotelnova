// src/features/hr/pages/payroll/PaySlipDetailPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { payrollApi } from '../../api/hrApi';
import type { PaySlipDetailDto } from '../../types/index';
import { fmtMoney, getApiError } from '../../utils/hrUtils';

// =============================================================================
// Sub-components
// =============================================================================

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '—'}</div>
    </div>
  );
}

function LineRow({
  label, amount, type, highlight,
}: {
  label: string;
  amount: number;
  type?: 'earning' | 'deduction' | 'net';
  highlight?: boolean;
}) {
  const color = type === 'deduction' ? 'var(--danger)'
    : type === 'net'       ? 'var(--success)'
    : undefined;

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderTop: highlight ? '2px solid var(--border)' : '1px solid var(--border)',
      marginTop: highlight ? 4 : 0,
    }}>
      <span style={{
        fontSize: 13,
        fontWeight: highlight ? 600 : 400,
        color: 'var(--text)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 13,
        fontWeight: highlight ? 700 : 500,
        color: color ?? 'var(--text)',
      }}>
        {type === 'deduction' ? `(${fmtMoney(amount)})` : fmtMoney(amount)}
      </span>
    </div>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function PaySlipDetailPage() {
  const nav             = useNavigate();
  const { paySlipId }   = useParams<{ paySlipId: string }>();
  const { companyId }   = useAppScope();

  const [slip,    setSlip]    = useState<PaySlipDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !paySlipId) return;
    setLoading(true); setError(null);
    try {
      setSlip(await payrollApi.getPaySlip(companyId, paySlipId));
    } catch (e) {
      setError(getApiError(e, 'Failed to load pay slip.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, paySlipId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="page"><div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div></div>;
  }
  if (error || !slip) {
    return (
      <div className="page">
        {error && <div className="alert alert-danger">{error}</div>}
        <button className="btn" onClick={() => nav(-1)}>← Back</button>
      </div>
    );
  }

  // Group line items by type
  const earnings   = slip.lines.filter(l => l.type === 'Earning'   || l.type === 'Allowance' || l.type === 'Bonus' || l.type === 'Overtime');
  const deductions = slip.lines.filter(l => l.type === 'Deduction' || l.type === 'Tax'       || l.type === 'Pension');
  const otherLines = slip.lines.filter(l => !earnings.includes(l) && !deductions.includes(l));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources · Payroll</div>
          <div className="page-title">Pay Slip</div>
          <div className="page-sub">
            {slip.employeeName} · {slip.employeeNo} · {slip.periodName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => window.print()}>
            <i className="ti ti-printer" /> Print
          </button>
          <button className="btn" onClick={() => nav(-1)}>← Back</button>
        </div>
      </div>

      {/* Employee & period info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Pay Slip Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          <Field label="Employee"    value={slip.employeeName} />
          <Field label="Employee No" value={slip.employeeNo} />
          <Field label="Pay Period"  value={slip.periodName} />
          <Field label="Status"      value={slip.status} />
          <Field label="Days Worked" value={`${slip.daysWorked} / ${slip.workingDays}`} />
          <Field label="Basic Salary" value={fmtMoney(slip.basicSalary)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Earnings */}
        <div className="card">
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Earnings
          </div>
          <LineRow label="Basic Salary"    amount={slip.basicSalary} />
          {slip.totalAllowances > 0 && (
            <LineRow label="Allowances"    amount={slip.totalAllowances} />
          )}
          {slip.overtimePay > 0 && (
            <LineRow label="Overtime Pay"  amount={slip.overtimePay} />
          )}
          {slip.bonusPay > 0 && (
            <LineRow label="Bonus"         amount={slip.bonusPay} />
          )}
          {earnings.map(l => (
            <LineRow key={l.description} label={l.description} amount={l.amount} />
          ))}
          <LineRow label="Gross Pay" amount={slip.grossPay} type="earning" highlight />
        </div>

        {/* Deductions */}
        <div className="card">
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Deductions
          </div>
          {slip.incomeTax > 0 && (
            <LineRow label="Income Tax"          amount={slip.incomeTax}       type="deduction" />
          )}
          {slip.employeePension > 0 && (
            <LineRow label="Employee Pension"    amount={slip.employeePension} type="deduction" />
          )}
          {slip.otherDeductions > 0 && (
            <LineRow label="Other Deductions"    amount={slip.otherDeductions} type="deduction" />
          )}
          {deductions.map(l => (
            <LineRow key={l.description} label={l.description} amount={l.amount} type="deduction" />
          ))}
          <LineRow label="Total Deductions" amount={slip.totalDeductions} type="deduction" highlight />
        </div>
      </div>

      {/* Net pay summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Net Pay</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Gross {fmtMoney(slip.grossPay)} − Deductions {fmtMoney(slip.totalDeductions)}
            </div>
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, color: 'var(--success)',
            fontFamily: 'var(--mono)',
          }}>
            {fmtMoney(slip.netPay)}
          </div>
        </div>
      </div>

      {/* Employer pension info */}
      {slip.employerPension > 0 && (
        <div style={{
          padding: '10px 14px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          Employer pension contribution: <strong style={{ color: 'var(--text)' }}>
            {fmtMoney(slip.employerPension)}
          </strong> (not deducted from employee pay)
        </div>
      )}

      {/* Other line items */}
      {otherLines.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Other Items
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {otherLines.map(l => (
                <tr key={l.description}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.type}</td>
                  <td style={{ fontSize: 13 }}>{l.description}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {fmtMoney(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}