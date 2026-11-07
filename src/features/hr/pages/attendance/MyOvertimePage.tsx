// src/features/hr/pages/attendance/MyOvertimePage.tsx
// Employee self-service: request overtime with a measurable KPI, record the completed work, cancel open requests.

import { useCallback, useEffect, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import {
  OVERTIME_CATEGORY_LABEL,
  OVERTIME_STATUS_LABEL,
  badgeVariantForOvertime,
  overtimeApi,
  resultError,
  type OvertimeRequestRow,
} from "../../api/hrWorkflowApi";
import { fmtDate, fmtNumber, getApiError, todayLocalIsoDate } from "../../utils/hrUtils";

const emptyRequest = {
  date: todayLocalIsoDate(),
  hours: "2",
  reason: "",
  workAssignment: "",
  kpiDescription: "",
  kpiTarget: "",
  kpiMeasurementMethod: "",
  requiredEvidence: "",
};

type Completion = { id: string; start: string; end: string; kpiResult: string; kpiAchieved: boolean; evidence: string };

function toUtcIso(local: string): string {
  return new Date(local).toISOString();
}

export default function MyOvertimePage() {
  const { companyId } = useAppScope();
  const [rows, setRows] = useState<OvertimeRequestRow[]>([]);
  const [form, setForm] = useState(emptyRequest);
  const [showForm, setShowForm] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setRows(await overtimeApi.mine(companyId));
    } catch (e) {
      setError(getApiError(e, "Failed to load your overtime."));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: () => Promise<{ success: boolean; error?: string | null } | undefined>, done: string) => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const failed = resultError(await action(), "Action failed.");
      if (failed) { setError(failed); return false; }
      setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError(getApiError(e, "Action failed."));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const submitRequest = async () => {
    if (!companyId) return;
    const hours = Number(form.hours);
    if (!form.reason.trim() || !form.workAssignment.trim() || !form.kpiDescription.trim() || !form.kpiTarget.trim() || !form.kpiMeasurementMethod.trim()) {
      setError("Reason, work, KPI, target and how it is measured are all required.");
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) { setError("Enter the overtime hours."); return; }
    const ok = await run(() => overtimeApi.submit(companyId, {
      date: form.date,
      hours,
      reason: form.reason.trim(),
      workAssignment: form.workAssignment.trim(),
      kpiDescription: form.kpiDescription.trim(),
      kpiTarget: form.kpiTarget.trim(),
      kpiMeasurementMethod: form.kpiMeasurementMethod.trim(),
      requiredEvidence: form.requiredEvidence.trim() || undefined,
    }), "Overtime requested. Your approver will review it.");
    if (ok) { setForm(emptyRequest); setShowForm(false); }
  };

  const submitCompletion = async () => {
    if (!companyId || !completion) return;
    if (!completion.start || !completion.end || !completion.kpiResult.trim()) {
      setError("Enter the actual start, end and the KPI result.");
      return;
    }
    const ok = await run(() => overtimeApi.complete(companyId, completion.id, {
      actualStartUtc: toUtcIso(completion.start),
      actualEndUtc: toUtcIso(completion.end),
      kpiResult: completion.kpiResult.trim(),
      kpiAchieved: completion.kpiAchieved,
      evidenceNote: completion.evidence.trim() || undefined,
    }), "Work recorded. Your approver will verify the hours.");
    if (ok) setCompletion(null);
  };

  const submitCancel = async () => {
    if (!companyId || !cancelling) return;
    if (!cancelling.reason.trim()) { setError("A cancellation reason is required."); return; }
    const ok = await run(() => overtimeApi.cancel(companyId, cancelling.id, cancelling.reason.trim()), "Overtime request cancelled.");
    if (ok) setCancelling(null);
  };

  const field = (key: keyof typeof emptyRequest, label: string, multiline = false) => (
    <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
      {label}
      {multiline
        ? <Textarea rows={2} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        : <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
    </label>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">My Workplace | Overtime</div>
          <div className="page-title">My Overtime</div>
          <div className="page-sub">
            Request overtime before you work it, with a measurable result. Afterwards, record the hours you worked and what
            you achieved. Overtime is limited to 4 hours a day and 12 hours a week unless your company sets lower limits.
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Close form" : "Request overtime"}</Button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}
      {notice && <div style={{ marginBottom: 12 }}><StateMessage tone="success">{notice}</StateMessage></div>}

      {showForm && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader><CardTitle>New overtime request</CardTitle></CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Date
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Hours
                <Input type="number" min="0.25" max="12" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </label>
              {field("reason", "Business reason", true)}
              {field("workAssignment", "Work to be done", true)}
              {field("kpiDescription", "KPI (what will be delivered)")}
              {field("kpiTarget", "Target")}
              {field("kpiMeasurementMethod", "How it is measured")}
              {field("requiredEvidence", "Evidence required (optional)")}
            </div>
            <div style={{ marginTop: 12 }}>
              <Button onClick={submitRequest} disabled={working}>{working ? "Submitting..." : "Submit request"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && rows.length === 0 && <EmptyState title="No overtime yet" detail="Your overtime requests will appear here." />}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => (
          <Card key={row.id}>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <CardTitle>{fmtDate(row.date)} | {OVERTIME_CATEGORY_LABEL[row.category] ?? row.category} | {fmtNumber(row.requestedHours)} h requested</CardTitle>
                <Badge variant={badgeVariantForOvertime(row.status)}>{OVERTIME_STATUS_LABEL[row.status] ?? row.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div><strong>KPI:</strong> {row.kpiDescription ?? "-"} | target {row.kpiTarget ?? "-"}</div>
                {row.actualHours != null && <div><strong>Worked:</strong> {fmtNumber(row.actualHours)} h | <strong>Result:</strong> {row.kpiResult}</div>}
                {row.approvedHours != null && <div><strong>Approved:</strong> {fmtNumber(row.approvedHours)} h {row.approverNote ? `| ${row.approverNote}` : ""}</div>}
                {row.paidAmount != null && <div><strong>Paid:</strong> {fmtNumber(row.paidHours ?? 0)} h | {fmtNumber(row.paidAmount)}</div>}
                {row.rejectionReason && <div><strong>Rejected:</strong> {row.rejectionReason}</div>}
              </div>

              {row.canComplete && completion?.id !== row.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Button size="sm" onClick={() => setCompletion({ id: row.id, start: "", end: "", kpiResult: "", kpiAchieved: true, evidence: "" })}>
                    Record completed work
                  </Button>
                </div>
              )}
              {(row.status === "Pending" || row.status === "PendingPreApproval" || row.status === "PreApproved") && cancelling?.id !== row.id && (
                <div style={{ marginTop: 8 }}>
                  <Button size="sm" variant="outline" onClick={() => setCancelling({ id: row.id, reason: "" })}>Cancel request</Button>
                </div>
              )}

              {completion?.id === row.id && (
                <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 560 }}>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    Actual start
                    <Input type="datetime-local" value={completion.start} onChange={(e) => setCompletion({ ...completion, start: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    Actual end
                    <Input type="datetime-local" value={completion.end} onChange={(e) => setCompletion({ ...completion, end: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    KPI result achieved
                    <Textarea rows={2} value={completion.kpiResult} onChange={(e) => setCompletion({ ...completion, kpiResult: e.target.value })} />
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    Was the KPI target achieved?
                    <Select value={completion.kpiAchieved ? "yes" : "no"} onChange={(e) => setCompletion({ ...completion, kpiAchieved: e.target.value === "yes" })}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </Select>
                  </label>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    Evidence {row.requiredEvidence ? `(required: ${row.requiredEvidence})` : "(optional)"}
                    <Input value={completion.evidence} onChange={(e) => setCompletion({ ...completion, evidence: e.target.value })} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button size="sm" onClick={submitCompletion} disabled={working}>{working ? "Saving..." : "Submit for verification"}</Button>
                    <Button size="sm" variant="outline" onClick={() => setCompletion(null)} disabled={working}>Close</Button>
                  </div>
                </div>
              )}

              {cancelling?.id === row.id && (
                <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 520 }}>
                  <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    Reason for cancelling
                    <Textarea rows={2} value={cancelling.reason} onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })} />
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button size="sm" variant="destructive" onClick={submitCancel} disabled={working}>Cancel overtime</Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelling(null)} disabled={working}>Keep it</Button>
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
