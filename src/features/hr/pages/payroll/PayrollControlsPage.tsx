// src/features/hr/pages/payroll/PayrollControlsPage.tsx
// Payroll controls: employee bank-detail verification (blocks payroll approval) and the PAYE correction report.

import { useCallback, useEffect, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import {
  payrollControlApi,
  resultError,
  type PayrollTaxCorrectionReport,
  type PendingBankVerification,
} from "../../api/hrWorkflowApi";
import { fmtDate, fmtMoney, getApiError } from "../../utils/hrUtils";

export default function PayrollControlsPage() {
  const { companyId } = useAppScope();
  const [bank, setBank] = useState<PendingBankVerification[]>([]);
  const [report, setReport] = useState<PayrollTaxCorrectionReport | null>(null);
  const [from, setFrom] = useState("2025-07-01");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const loadBank = useCallback(async () => {
    if (!companyId) return;
    try {
      setBank(await payrollControlApi.pendingBankVerifications(companyId));
    } catch (e) {
      setError(getApiError(e, "Failed to load bank verifications."));
    }
  }, [companyId]);

  const loadReport = useCallback(async () => {
    if (!companyId) return;
    setWorking(true);
    try {
      setReport(await payrollControlApi.taxCorrections(companyId, from || undefined, to || undefined));
    } catch (e) {
      setError(getApiError(e, "Failed to load the PAYE report."));
    } finally {
      setWorking(false);
    }
  }, [companyId, from, to]);

  useEffect(() => { loadBank(); }, [loadBank]);
  useEffect(() => { loadReport(); }, [loadReport]);

  const verify = async (employeeId: string) => {
    if (!companyId) return;
    setError(null);
    setNotice(null);
    try {
      const failed = resultError(await payrollControlApi.verifyBank(companyId, employeeId), "Verification failed.");
      if (failed) { setError(failed); return; }
      setNotice("Bank details verified.");
      await loadBank();
    } catch (e) {
      setError(getApiError(e, "Verification failed."));
    }
  };

  const downloadCsv = async () => {
    if (!companyId) return;
    try {
      const blob = await payrollControlApi.taxCorrectionsCsv(companyId, from || undefined, to || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paye-corrections-${from || "start"}-${to || "today"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiError(e, "Download failed."));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">HR | Payroll</div>
          <div className="page-title">Payroll Controls</div>
          <div className="page-sub">
            Changed bank details must be verified by a second person before payroll can be approved. The PAYE report compares
            the tax withheld on each payslip with the tax due under the table in force for its period.
          </div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}
      {notice && <div style={{ marginBottom: 12 }}><StateMessage tone="success">{notice}</StateMessage></div>}

      <Card style={{ marginBottom: 16 }}>
        <CardHeader><CardTitle>Bank details waiting for verification</CardTitle></CardHeader>
        <CardContent>
          {bank.length === 0
            ? <EmptyState title="All verified" detail="No employee bank details are waiting for verification." />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Changed</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bank.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.employeeNo} | {b.name}</TableCell>
                      <TableCell>{b.bankName ?? "-"} {b.bankBranch ? `(${b.bankBranch})` : ""}</TableCell>
                      <TableCell>{b.bankAccountNo ?? "-"}</TableCell>
                      <TableCell>{b.bankChangedAtUtc ? fmtDate(b.bankChangedAtUtc) : "-"}</TableCell>
                      <TableCell>
                        {b.canVerify
                          ? <Button size="sm" onClick={() => verify(b.id)}>Verify</Button>
                          : <Badge variant="outline">You made this change</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>PAYE correction report</CardTitle></CardHeader>
        <CardContent>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Periods ending from
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              to
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <Button variant="outline" onClick={loadReport} disabled={working}>{working ? "Loading..." : "Refresh"}</Button>
            <Button variant="outline" onClick={downloadCsv}>Download CSV</Button>
          </div>
          {report && (
            <>
              <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 12 }}>
                <div className="kpi"><div className="kpi-label">Payslips checked</div><div className="kpi-val">{report.paySlips}</div></div>
                <div className="kpi"><div className="kpi-label">PAYE withheld</div><div className="kpi-val">{fmtMoney(report.totalWithheld)}</div></div>
                <div className="kpi"><div className="kpi-label">PAYE due</div><div className="kpi-val">{fmtMoney(report.totalDue)}</div></div>
                <div className="kpi"><div className="kpi-label">Over-withheld</div><div className="kpi-val">{fmtMoney(report.totalOverWithheld)}</div></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <StateMessage tone="info">
                  Payslips calculated before this report existed have no stored taxable income, so it is estimated as gross pay
                  less employee pension. Decide how to refund or recover differences with your tax adviser.
                </StateMessage>
              </div>
              {report.rows.length === 0
                ? <EmptyState title="No differences" detail="Every payslip in the range used the correct tax table." />
                : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Taxable</TableHead>
                        <TableHead>Withheld</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Over-withheld</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rows.map((r) => (
                        <TableRow key={r.paySlipId}>
                          <TableCell>{r.periodName}</TableCell>
                          <TableCell>{r.employeeNo} | {r.employeeName}</TableCell>
                          <TableCell>{fmtMoney(r.taxableIncome)}{r.taxableIncomeEstimated ? " *" : ""}</TableCell>
                          <TableCell>{fmtMoney(r.taxWithheld)}</TableCell>
                          <TableCell>{fmtMoney(r.taxDue)}</TableCell>
                          <TableCell>{fmtMoney(r.overWithheld)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
