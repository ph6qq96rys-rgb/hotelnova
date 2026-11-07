// src/features/hr/pages/Employees/EmployeeCompensationPage.tsx
// Payroll view of one employee's pay: change salary and bank details with an effective date and a reason,
// and see every earlier change. Changed bank details stay on hold until a second person verifies them.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Textarea } from "../../../../components/ui/textarea";
import { useI18n } from "../../../../i18n";
import { useErpNavigate } from "../../../../routes/useErpNavigation";
import { employeeApi, type EmployeeCompensationView } from "../../api/hrApi";
import { fmtDate, fmtDateTime, fmtMoney, getApiError } from "../../utils/hrUtils";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function EmployeeCompensationPage() {
  const { tx } = useI18n();
  const nav = useErpNavigate();
  const { companyId } = useAppScope();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [view, setView] = useState<EmployeeCompensationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ basicSalary: "", bankName: "", bankBranch: "", bankAccountNo: "", effectiveDate: localToday(), reason: "" });

  const load = useCallback(async () => {
    if (!companyId || !employeeId) return;
    setLoading(true);
    try {
      const data = await employeeApi.getCompensation(companyId, employeeId);
      setView(data);
      setForm((f) => ({
        ...f,
        basicSalary: String(data.basicSalary),
        bankName: data.bankName ?? "",
        bankBranch: data.bankBranch ?? "",
        bankAccountNo: data.bankAccountNo ?? "",
        reason: "",
      }));
    } catch (e) {
      setError(getApiError(e, "Failed to load compensation."));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!companyId || !employeeId || !view) return;
    const salary = Number(form.basicSalary);
    if (!Number.isFinite(salary) || salary < 0) { setError(tx("Enter a valid salary.")); return; }
    if (!form.reason.trim()) { setError(tx("Give a reason for the pay change.")); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await employeeApi.updateCompensation(companyId, employeeId, {
        basicSalary: salary,
        payFrequency: "Monthly",
        bankName: form.bankName.trim() || null,
        bankBranch: form.bankBranch.trim() || null,
        bankAccountNo: form.bankAccountNo.trim() || null,
        effectiveDate: form.effectiveDate,
        reason: form.reason.trim(),
        version: view.version,
      });
      setNotice(tx("Pay updated. If bank details changed, a second person must verify them under Payroll Controls before the next payroll can be approved."));
      await load();
    } catch (e) {
      setError(getApiError(e, tx("Failed to save the pay change.")));
    } finally {
      setSaving(false);
    }
  }

  const terminated = view?.status === "Terminated";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">{tx("Human Resources")} | {tx("Employee Master")} | {tx("Compensation")}</div>
          <div className="page-title">{view ? `${view.fullName} (${view.employeeNo})` : tx("Compensation")}</div>
          <div className="page-sub">
            {tx("Pay changes need an effective date and a reason. The effective date cannot be in the future or inside a payroll period that is already approved.")}
          </div>
        </div>
        <Button variant="outline" onClick={() => employeeId && nav(`hr/employees/${employeeId}`)}>{tx("Back")}</Button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}
      {notice && <div style={{ marginBottom: 12 }}><StateMessage tone="success">{notice}</StateMessage></div>}
      {loading && <StateMessage tone="loading">{tx("Loading...")}</StateMessage>}

      {view && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 16 }}>
            <div className="kpi"><div className="kpi-label">{tx("Basic salary")}</div><div className="kpi-val">{fmtMoney(view.basicSalary)}</div></div>
            <div className="kpi"><div className="kpi-label">{tx("Pay frequency")}</div><div className="kpi-val">{tx(view.payFrequency)}</div></div>
            <div className="kpi">
              <div className="kpi-label">{tx("Bank details")}</div>
              <div className="kpi-val">
                {view.bankStatus === "PendingVerification"
                  ? <Badge variant="warning">{tx("Waiting for verification")}</Badge>
                  : <Badge variant="success">{tx("Verified")}</Badge>}
              </div>
            </div>
          </div>

          {!terminated && (
            <Card style={{ marginBottom: 16 }}>
              <CardHeader><CardTitle>{tx("Change pay")}</CardTitle></CardHeader>
              <CardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>{tx("Basic salary (ETB)")}
                    <Input type="number" min={0} step={0.01} value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>{tx("Effective date")}
                    <Input type="date" max={localToday()} value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>{tx("Bank name")}
                    <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>{tx("Bank branch")}
                    <Input value={form.bankBranch} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>{tx("Bank account no.")}
                    <Input value={form.bankAccountNo} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })} />
                  </label>
                </div>
                <label style={{ fontSize: 13, display: "grid", gap: 4, marginTop: 12 }}>{tx("Reason")}
                  <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </label>
                <div style={{ marginTop: 12 }}>
                  <Button onClick={() => void save()} disabled={saving}>{saving ? tx("Saving...") : tx("Save pay change")}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>{tx("History")}</CardTitle></CardHeader>
            <CardContent>
              {view.history.length === 0
                ? <EmptyState title={tx("No changes recorded")} detail={tx("Changes made from now on are listed here.")} />
                : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tx("Effective")}</TableHead>
                        <TableHead>{tx("Salary")}</TableHead>
                        <TableHead>{tx("Bank account")}</TableHead>
                        <TableHead>{tx("Reason")}</TableHead>
                        <TableHead>{tx("Changed by")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {view.history.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{h.effectiveFrom ? fmtDate(h.effectiveFrom) : "-"}</TableCell>
                          <TableCell>{fmtMoney(h.previousBasicSalary)} {"->"} {fmtMoney(h.newBasicSalary)}</TableCell>
                          <TableCell>{h.bankDetailsChanged ? `${h.previousAccountTail ? `...${h.previousAccountTail}` : "-"} -> ${h.newAccountTail ? `...${h.newAccountTail}` : "-"}` : tx("Unchanged")}</TableCell>
                          <TableCell>{h.reason ?? "-"}</TableCell>
                          <TableCell>{h.changedBy ?? "-"} | {fmtDateTime(h.changedAtUtc)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
