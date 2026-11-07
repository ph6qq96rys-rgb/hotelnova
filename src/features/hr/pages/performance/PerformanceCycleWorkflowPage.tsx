// src/features/hr/pages/performance/PerformanceCycleWorkflowPage.tsx
// HR view of one cycle: launch reviews, track progress, calibrate and sign off, close the cycle.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Textarea } from "../../../../components/ui/textarea";
import { performanceApi } from "../../api/hrApi";
import { performanceWorkflowApi, resultError, type PerformanceReviewRow } from "../../api/hrWorkflowApi";
import type { PerformanceCycleDto } from "../../types/index";
import { fmtDate, getApiError } from "../../utils/hrUtils";

const STATUS_LABEL: Record<string, string> = {
  NotStarted: "Not started",
  SelfReview: "Self review",
  ManagerReview: "Manager review",
  Calibration: "Calibration",
  Completed: "Completed",
};

function rating(value?: number | null) {
  return value == null ? "-" : value.toFixed(2);
}

export default function PerformanceCycleWorkflowPage() {
  const nav = useNavigate();
  const { cycleId } = useParams<{ cycleId: string }>();
  const { companyId } = useAppScope();
  const [cycle, setCycle] = useState<PerformanceCycleDto | null>(null);
  const [rows, setRows] = useState<PerformanceReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [calibrating, setCalibrating] = useState<{ id: string; rating: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !cycleId) return;
    try {
      const cycles = await performanceApi.listCycles(companyId);
      setCycle(cycles.find((c) => c.id === cycleId) ?? null);
      setRows(await performanceWorkflowApi.cycleReviews(companyId, cycleId));
    } catch (e) {
      setError(getApiError(e, "Failed to load the cycle."));
    }
  }, [companyId, cycleId]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return { total: rows.length, calibration: by("Calibration"), completed: by("Completed"), acknowledged: rows.filter((r) => r.acknowledged).length };
  }, [rows]);

  const act = async (fn: () => Promise<{ success: boolean; error?: string | null; data?: unknown }>, done: string) => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      const failed = resultError(result, "Action failed.");
      if (failed) { setError(failed); return false; }
      const message = (result.data as { message?: string } | undefined)?.message;
      setNotice(message ?? done);
      await load();
      return true;
    } catch (e) {
      setError(getApiError(e, "Action failed."));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const calibrate = async () => {
    if (!companyId || !calibrating) return;
    const value = calibrating.rating.trim() === "" ? null : Number(calibrating.rating);
    if (value != null && (!Number.isFinite(value) || value < 1 || value > 5)) { setError("Rating must be between 1 and 5."); return; }
    const ok = await act(() => performanceWorkflowApi.calibrate(companyId, calibrating.id, value, calibrating.reason.trim() || undefined), "Review signed off.");
    if (ok) setCalibrating(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">HR | Performance</div>
          <div className="page-title">{cycle?.name ?? "Performance cycle"}</div>
          <div className="page-sub">
            {cycle ? `${fmtDate(cycle.startDate)} to ${fmtDate(cycle.endDate)} | ${cycle.status}` : ""}
            {" "}Final score = weighted goals/KPIs and competencies (the split set on the cycle), then HR calibration.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {companyId && cycleId && (cycle?.status === "Draft" || cycle?.status === "Active") && (
            <Button onClick={() => act(() => performanceWorkflowApi.launchCycle(companyId, cycleId), "Reviews created.")} disabled={working}>
              {cycle?.status === "Draft" ? "Launch cycle" : "Add new joiners"}
            </Button>
          )}
          {companyId && cycleId && cycle?.status === "Active" && (
            <Button variant="outline" onClick={() => act(() => performanceWorkflowApi.closeCycle(companyId, cycleId), "Cycle closed.")} disabled={working}>
              Close cycle
            </Button>
          )}
          <Button variant="outline" onClick={() => nav("/hr/performance")}>Back</Button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}
      {notice && <div style={{ marginBottom: 12 }}><StateMessage tone="success">{notice}</StateMessage></div>}

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Reviews</div><div className="kpi-val">{counts.total}</div></div>
        <div className="kpi"><div className="kpi-label">Waiting for calibration</div><div className="kpi-val">{counts.calibration}</div></div>
        <div className="kpi"><div className="kpi-label">Completed</div><div className="kpi-val">{counts.completed}</div></div>
        <div className="kpi"><div className="kpi-label">Acknowledged</div><div className="kpi-val">{counts.acknowledged}</div></div>
      </div>

      <Card>
        <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0
            ? <EmptyState title="No reviews yet" detail="Launch the cycle to create a review for every active employee with a line manager." />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Goals</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Goals score</TableHead>
                    <TableHead>Competencies</TableHead>
                    <TableHead>Calculated</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.employeeNo} | {r.employeeName}</TableCell>
                      <TableCell>{r.reviewerName ?? "-"}</TableCell>
                      <TableCell>
                        {r.goalCount} ({r.goalWeightTotal}%) {r.goalsApproved ? <Badge variant="success">approved</Badge> : <Badge variant="warning">not approved</Badge>}
                      </TableCell>
                      <TableCell>{STATUS_LABEL[r.status] ?? r.status}{r.acknowledged ? " | acknowledged" : ""}</TableCell>
                      <TableCell>{rating(r.goalScore)}</TableCell>
                      <TableCell>{rating(r.competencyScore)}</TableCell>
                      <TableCell>{rating(r.calculatedRating)}</TableCell>
                      <TableCell>{rating(r.finalRating)} {r.ratingLabel ? `(${r.ratingLabel})` : ""}</TableCell>
                      <TableCell>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button size="sm" variant="outline" onClick={() => nav(`/hr/performance/reviews/${r.id}`)}>Open</Button>
                          {r.status === "Calibration" && calibrating?.id !== r.id && (
                            <Button size="sm" onClick={() => setCalibrating({ id: r.id, rating: r.calculatedRating?.toFixed(2) ?? "", reason: "" })}>Calibrate</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

          {calibrating && (
            <div style={{ display: "grid", gap: 8, marginTop: 16, maxWidth: 520 }}>
              <div style={{ fontWeight: 600 }}>Calibrate and sign off</div>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Final rating (1 to 5)
                <Input type="number" min="1" max="5" step="0.01" value={calibrating.rating}
                  onChange={(e) => setCalibrating({ ...calibrating, rating: e.target.value })} />
              </label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Reason (required if you change the calculated rating)
                <Textarea rows={2} value={calibrating.reason} onChange={(e) => setCalibrating({ ...calibrating, reason: e.target.value })} />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={calibrate} disabled={working}>{working ? "Saving..." : "Sign off"}</Button>
                <Button variant="outline" onClick={() => setCalibrating(null)} disabled={working}>Close</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
