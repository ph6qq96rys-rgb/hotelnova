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
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value ?? '-'}</div>
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
        <button className="btn" onClick={() => nav(-1)}>Back</button>
      </div>
    );
  }

  // Group line items by type. The summary amounts (allowances, overtime, bonus, other deductions) are the totals
  // of these lines, so each is shown once: as its lines when there are any, otherwise as the total.
  const allowances = slip.lines.filter(l => l.type === 'Allowance');
  const earnedLines = slip.lines.filter(l => l.type === 'Earning' || l.type === 'Bonus' || l.type === 'Overtime');
  const deductions = slip.lines.filter(l => l.type === 'Deduction' || l.type === 'Tax'       || l.type === 'Pension');
  const otherLines = slip.lines.filter(l => !allowances.includes(l) && !earnedLines.includes(l) && !deductions.includes(l));

  // Basic salary and allowances are monthly amounts paid for the days worked out of the month's working days.
  // The unpaid share is what the gross pay leaves out of them; it is derived from the payslip's own totals.
  const earnedSeparately = earnedLines.length > 0
    ? earnedLines.reduce((sum, l) => sum + l.amount, 0)
    : slip.overtimePay + slip.bonusPay;
  const unpaid = Math.round((slip.basicSalary + slip.totalAllowances + earnedSeparately - slip.grossPay) * 100) / 100;
  const unpaidDays = Math.max(0, slip.workingDays - slip.daysWorked);
  const taxBase = slip.taxableIncome ?? 0;
  const partialPeriod = (() => {
    if (!slip.periodStart || !slip.periodEnd) return false;
    const [y, m, d] = slip.periodStart.slice(0, 10).split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d !== 1 || slip.periodEnd.slice(0, 10) !== `${slip.periodStart.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
  })();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Human Resources - Payroll</div>
          <div className="page-title">Pay Slip</div>
          <div className="page-sub">
            {slip.employeeName} - {slip.employeeNo} - {slip.periodName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => window.print()}>
            <i className="ti ti-printer" /> Print
          </button>
          <button className="btn" onClick={() => nav(-1)}>Back</button>
        </div>
      </div>

      {partialPeriod && (
        <div role="alert" style={{
          padding: '10px 14px', marginBottom: 16, border: '1px solid var(--danger)', borderRadius: 8,
          background: 'var(--surface-2)', fontSize: 13,
        }}>
          This payroll run covers {slip.periodStart?.slice(0, 10)} to {slip.periodEnd?.slice(0, 10)}, not a whole month, so the monthly
          salary is pro-rated on only {slip.workingDays} working days. Cancel the run and create one for the whole month.
        </div>
      )}

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
          <Field label="TIN number"  value={slip.tinNumber} />
          <Field label="Pay Period"  value={slip.periodStart && slip.periodEnd
            ? `${slip.periodName} (${slip.periodStart.slice(0, 10)} to ${slip.periodEnd.slice(0, 10)})` : slip.periodName} />
          <Field label="Status"      value={slip.status} />
          <Field label="Days Paid" value={`${slip.daysWorked} of ${slip.workingDays} working days`} />
          <Field label="Basic Salary" value={fmtMoney(slip.basicSalary)} />
          <Field label="Bank" value={slip.bankName} />
          <Field label="Bank Account" value={slip.bankAccountNo} />
          <Field label="Bank Branch" value={slip.bankBranch} />
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
          <LineRow label="Basic Salary (monthly)" amount={slip.basicSalary} />
          {allowances.length > 0
            ? allowances.map(l => <LineRow key={'a' + l.description} label={`${l.description} (monthly)`} amount={l.amount} />)
            : slip.totalAllowances > 0 && <LineRow label="Allowances (monthly)" amount={slip.totalAllowances} />}
          {unpaid > 0.004 && (
            <LineRow
              label={`Days not paid: ${unpaidDays} of ${slip.workingDays} working days`}
              amount={unpaid}
              type="deduction"
            />
          )}
          {earnedLines.length > 0
            ? earnedLines.map(l => <LineRow key={'e' + l.description} label={l.description} amount={l.amount} />)
            : <>
                {slip.overtimePay > 0 && <LineRow label="Overtime Pay" amount={slip.overtimePay} />}
                {slip.bonusPay > 0 && <LineRow label="Bonus" amount={slip.bonusPay} />}
              </>}
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
            <LineRow
              label={taxBase > 0 ? `Income Tax (on taxable ${fmtMoney(taxBase)})` : 'Income Tax'}
              amount={slip.incomeTax}
              type="deduction"
            />
          )}
          {slip.employeePension > 0 && (
            <LineRow label="Employee Pension"    amount={slip.employeePension} type="deduction" />
          )}
          {slip.otherDeductions > 0 && !deductions.some(l => l.type === 'Deduction') && (
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
              Gross {fmtMoney(slip.grossPay)} - Deductions {fmtMoney(slip.totalDeductions)}
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
