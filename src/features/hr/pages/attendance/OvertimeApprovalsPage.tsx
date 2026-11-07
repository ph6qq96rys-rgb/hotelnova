// src/features/hr/pages/attendance/OvertimeApprovalsPage.tsx
// Approver queue: pre-approve overtime before the work, then verify hours and the KPI result after it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import {
  OVERTIME_CATEGORY_LABEL,
  OVERTIME_STATUS_LABEL,
  badgeVariantForOvertime,
  overtimeApi,
  resultError,
  type OvertimeRequestRow,
} from "../../api/hrWorkflowApi";
import { fmtDate, fmtNumber, getApiError } from "../../utils/hrUtils";

type Tab = "pre" | "verify" | "payroll" | "closed";

const TABS: { key: Tab; label: string; statuses: string }[] = [
  { key: "pre", label: "Waiting for pre-approval", statuses: "Pending,PendingPreApproval" },
  { key: "verify", label: "Waiting for verification", statuses: "PendingKpiVerification" },
  { key: "payroll", label: "Approved / paid", statuses: "PreApproved,Approved,PartiallyApproved,Processed" },
  { key: "closed", label: "Rejected / cancelled", statuses: "Rejected,Cancelled" },
];

type Decision = { id: string; kind: "pre" | "verify" | "reject"; hours: string; note: string };

function hoursLabel(value?: number | null) {
  return value == null ? "-" : `${fmtNumber(value)} h`;
}

export default function OvertimeApprovalsPage() {
  const { companyId } = useAppScope();
  const [tab, setTab] = useState<Tab>("pre");
  const [rows, setRows] = useState<OvertimeRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [working, setWorking] = useState(false);

  const statuses = useMemo(() => TABS.find((t) => t.key === tab)!.statuses, [tab]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await overtimeApi.list(companyId, { status: statuses }));
    } catch (e) {
      setError(getApiError(e, "Failed to load overtime requests."));
    } finally {
      setLoading(false);
    }
  }, [companyId, statuses]);

  useEffect(() => { load(); }, [load]);

  const open = (row: OvertimeRequestRow, kind: Decision["kind"]) => {
    setNotice(null);
    setError(null);
    const worked = row.actualHours ?? row.requestedHours;
    const suggested = row.clockedOvertimeHours != null ? Math.min(worked, row.clockedOvertimeHours) : worked;
    setDecision({ id: row.id, kind, hours: String(suggested), note: "" });
  };

  const submit = async () => {
    if (!companyId || !decision) return;
    setWorking(true);
    setError(null);
    try {
      let result;
      if (decision.kind === "pre") result = await overtimeApi.preApprove(companyId, decision.id, decision.note || undefined);
      else if (decision.kind === "verify") {
        const hours = Number(decision.hours);
        if (!Number.isFinite(hours) || hours < 0) { setError("Enter the hours to approve."); setWorking(false); return; }
        result = await overtimeApi.verify(companyId, decision.id, hours, decision.note || undefined);
      } else {
        if (!decision.note.trim()) { setError("A rejection reason is required."); setWorking(false); return; }
        result = await overtimeApi.reject(companyId, decision.id, decision.note.trim());
      }
      const failed = resultError(result, "Action failed.");
      if (failed) { setError(failed); return; }
      setNotice(decision.kind === "reject" ? "Overtime rejected." : decision.kind === "pre" ? "Overtime pre-approved." : "Overtime verified for payroll.");
      setDecision(null);
      await load();
    } catch (e) {
      setError(getApiError(e, "Action failed."));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Workforce Management | Overtime</div>
          <div className="page-title">Overtime Approvals</div>
          <div className="page-sub">
            Pre-approve overtime before the work. After the employee records the hours worked and the KPI result, verify
            the hours to pay. Payroll pays the lower of the approved hours and the overtime clocked that day.
          </div>
        </div>
        <Button variant="outline" onClick={load} disabled={loading || !companyId}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "default" : "outline"} size="sm" onClick={() => { setTab(t.key); setDecision(null); }}>
            {t.label}
          </Button>
        ))}
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}
      {notice && <div style={{ marginBottom: 12 }}><StateMessage tone="success">{notice}</StateMessage></div>}

      {!loading && rows.length === 0 && (
        <EmptyState title="Nothing here" detail="No overtime requests match this view." />
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <Card key={row.id}>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <CardTitle>
                  {row.employeeName} | {fmtDate(row.date)} | {OVERTIME_CATEGORY_LABEL[row.category] ?? row.category}
                </CardTitle>
                <Badge variant={badgeVariantForOvertime(row.status)}>{OVERTIME_STATUS_LABEL[row.status] ?? row.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, fontSize: 13 }}>
                <div><div className="kpi-label">Requested</div>{hoursLabel(row.requestedHours)}</div>
                <div><div className="kpi-label">Worked</div>{hoursLabel(row.actualHours)}{row.nightHours ? ` (${fmtNumber(row.nightHours)} h night)` : ""}</div>
                <div><div className="kpi-label">Clocked overtime</div>{hoursLabel(row.clockedOvertimeHours)}</div>
                <div><div className="kpi-label">Approved</div>{hoursLabel(row.approvedHours)}</div>
                <div><div className="kpi-label">Paid</div>{row.paidAmount != null ? `${hoursLabel(row.paidHours)} | ${fmtNumber(row.paidAmount)}` : "-"}</div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
                <div><strong>Reason:</strong> {row.reason}</div>
                {row.workAssignment && <div><strong>Work:</strong> {row.workAssignment}</div>}
                {row.kpiDescription && <div><strong>KPI:</strong> {row.kpiDescription} | target {row.kpiTarget ?? "-"} | measured by {row.kpiMeasurementMethod ?? "-"}</div>}
                {row.kpiResult && (
                  <div>
                    <strong>Result:</strong> {row.kpiResult}{" "}
                    <Badge variant={row.kpiAchieved ? "success" : "destructive"}>{row.kpiAchieved ? "KPI achieved" : "KPI not achieved"}</Badge>
                  </div>
                )}
                {row.evidenceNote && <div><strong>Evidence:</strong> {row.evidenceNote}</div>}
                {row.preApprovalNote && <div><strong>Pre-approval note:</strong> {row.preApprovalNote}</div>}
                {row.approverNote && <div><strong>Approver note:</strong> {row.approverNote}</div>}
                {row.rejectionReason && <div><strong>Rejected:</strong> {row.rejectionReason}</div>}
                {row.status === "PendingKpiVerification" && row.clockedOvertimeHours != null && row.actualHours != null &&
                  row.clockedOvertimeHours < row.actualHours && (
                  <div style={{ marginTop: 6 }}>
                    <StateMessage tone="warning">
                      Attendance shows {fmtNumber(row.clockedOvertimeHours)} h of overtime that day; payroll will pay at most that.
                    </StateMessage>
                  </div>
                )}
              </div>

              {row.canDecide && decision?.id !== row.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {(row.status === "Pending" || row.status === "PendingPreApproval") && (
                    <Button size="sm" onClick={() => open(row, "pre")}>Pre-approve</Button>
                  )}
                  {row.status === "PendingKpiVerification" && (
                    <Button size="sm" onClick={() => open(row, "verify")}>Verify hours</Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => open(row, "reject")}>Reject</Button>
                </div>
              )}

              {decision?.id === row.id && (
                <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 520 }}>
                  {decision.kind === "verify" && (
                    <label style={{ fontSize: 13 }}>
                      Hours to approve (worked {hoursLabel(row.actualHours ?? row.requestedHours)})
                      <Input type="number" min="0" step="0.25" value={decision.hours}
                        onChange={(e) => setDecision({ ...decision, hours: e.target.value })} />
                    </label>
                  )}
                  <label style={{ fontSize: 13 }}>
                    {decision.kind === "reject" ? "Reason (required)" : decision.kind === "verify" ? "Note (required when approving fewer hours or the KPI was missed)" : "Note (optional)"}
                    <Textarea rows={2} value={decision.note} onChange={(e) => setDecision({ ...decision, note: e.target.value })} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button size="sm" variant={decision.kind === "reject" ? "destructive" : "default"} onClick={submit} disabled={working}>
                      {working ? "Saving..." : decision.kind === "reject" ? "Reject overtime" : decision.kind === "pre" ? "Pre-approve" : "Approve hours"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDecision(null)} disabled={working}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
