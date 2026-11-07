// src/features/hr/pages/performance/MyPerformancePage.tsx
// Self-service performance: my reviews and goals (KPI check-ins, acknowledgement) and, for managers, my team.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Textarea } from "../../../../components/ui/textarea";
import {
  performanceWorkflowApi,
  resultError,
  type GoalRow,
  type KpiDefinition,
  type PerformanceReviewRow,
} from "../../api/hrWorkflowApi";
import { fmtDate, getApiError, todayLocalIsoDate } from "../../utils/hrUtils";

const STATUS_LABEL: Record<string, string> = {
  NotStarted: "Not started",
  SelfReview: "Self review",
  ManagerReview: "Waiting for manager review",
  Calibration: "Waiting for HR sign-off",
  Completed: "Completed",
};

type GoalDraft = {
  reviewId: string;
  employeeId: string;
  cycleId: string;
  kpiDefinitionId: string;
  title: string;
  weight: string;
  targetValue: string;
  unit: string;
  direction: "HigherIsBetter" | "LowerIsBetter";
  dueDate: string;
};

function pct(value?: number | null) {
  return value == null ? "-" : `${value.toFixed(0)}%`;
}

export default function MyPerformancePage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const [mine, setMine] = useState<PerformanceReviewRow[]>([]);
  const [team, setTeam] = useState<PerformanceReviewRow[]>([]);
  const [goals, setGoals] = useState<Record<string, GoalRow[]>>({});
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [checkIn, setCheckIn] = useState<{ goalId: string; value: string; comment: string } | null>(null);
  const [ack, setAck] = useState<{ reviewId: string; comment: string } | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const loadGoals = useCallback(async (rows: PerformanceReviewRow[]) => {
    if (!companyId) return;
    const entries = await Promise.all(rows.map(async (r) =>
      [r.id, await performanceWorkflowApi.goals(companyId, { employeeId: r.employeeId, cycleId: r.cycleId })] as const));
    setGoals(Object.fromEntries(entries));
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const [my, mineTeam] = await Promise.all([
        performanceWorkflowApi.myReviews(companyId),
        performanceWorkflowApi.teamReviews(companyId),
      ]);
      setMine(my);
      setTeam(mineTeam);
      await loadGoals([...my, ...mineTeam]);
      try { setKpis(await performanceWorkflowApi.kpis(companyId)); } catch { setKpis([]); }
    } catch (e) {
      setError(getApiError(e, "Failed to load performance."));
    }
  }, [companyId, loadGoals]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<{ success: boolean; error?: string | null }>, done: string) => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const failed = resultError(await fn(), "Action failed.");
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

  const saveCheckIn = async () => {
    if (!companyId || !checkIn) return;
    const value = Number(checkIn.value);
    if (!Number.isFinite(value)) { setError("Enter the actual value."); return; }
    if (await act(() => performanceWorkflowApi.checkIn(companyId, checkIn.goalId, value, checkIn.comment || undefined, todayLocalIsoDate()), "Progress saved.")) setCheckIn(null);
  };

  const saveGoal = async () => {
    if (!companyId || !goalDraft) return;
    const weight = Number(goalDraft.weight), target = Number(goalDraft.targetValue);
    if (!goalDraft.kpiDefinitionId && !goalDraft.title.trim()) { setError("Pick a KPI or enter a goal title."); return; }
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(target)) { setError("Enter a weight and a target."); return; }
    const ok = await act(() => performanceWorkflowApi.createGoal(companyId, {
      employeeId: goalDraft.employeeId,
      cycleId: goalDraft.cycleId,
      kpiDefinitionId: goalDraft.kpiDefinitionId || undefined,
      title: goalDraft.title.trim(),
      category: "Individual",
      direction: goalDraft.direction,
      weight,
      targetValue: target,
      unit: goalDraft.unit.trim() || undefined,
      dueDate: goalDraft.dueDate,
    }), "Goal added.");
    if (ok) setGoalDraft(null);
  };

  const pickKpi = (id: string) => {
    if (!goalDraft) return;
    const kpi = kpis.find((k) => k.id === id);
    setGoalDraft({
      ...goalDraft,
      kpiDefinitionId: id,
      title: kpi?.name ?? goalDraft.title,
      unit: kpi?.unit ?? goalDraft.unit,
      direction: kpi?.direction ?? goalDraft.direction,
      targetValue: kpi?.defaultTarget != null ? String(kpi.defaultTarget) : goalDraft.targetValue,
    });
  };

  const renderGoals = (review: PerformanceReviewRow, canEdit: boolean) => {
    const list = goals[review.id] ?? [];
    const locked = review.status === "Calibration" || review.status === "Completed";
    return (
      <>
        {list.length === 0
          ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No goals yet.</div>
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Goal / KPI</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Achievement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.title}{g.direction === "LowerIsBetter" ? " (lower is better)" : ""}</TableCell>
                    <TableCell>{g.weight}%</TableCell>
                    <TableCell>{g.targetValue} {g.unit ?? ""}</TableCell>
                    <TableCell>{g.actualValue ?? "-"} {g.actualValue != null ? g.unit ?? "" : ""}</TableCell>
                    <TableCell>{pct(g.achievementPercent)}</TableCell>
                    <TableCell>{g.status}</TableCell>
                    <TableCell>
                      {!locked && g.status !== "Draft" && g.status !== "Cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => setCheckIn({ goalId: g.id, value: String(g.actualValue ?? ""), comment: "" })}>Update progress</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        {canEdit && !locked && goalDraft?.reviewId !== review.id && (
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="outline" onClick={() => setGoalDraft({
              reviewId: review.id, employeeId: review.employeeId, cycleId: review.cycleId, kpiDefinitionId: "", title: "",
              weight: String(Math.max(0, 100 - review.goalWeightTotal)), targetValue: "", unit: "", direction: "HigherIsBetter",
              dueDate: todayLocalIsoDate(),
            })}>Add goal</Button>
          </div>
        )}
        {goalDraft?.reviewId === review.id && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 12 }}>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              KPI from library
              <Select value={goalDraft.kpiDefinitionId} onChange={(e) => pickKpi(e.target.value)}>
                <option value="">Custom goal</option>
                {kpis.map((k) => <option key={k.id} value={k.id}>{k.code} | {k.name}</option>)}
              </Select>
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Title
              <Input value={goalDraft.title} onChange={(e) => setGoalDraft({ ...goalDraft, title: e.target.value })} />
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Weight (%)
              <Input type="number" min="1" max="100" value={goalDraft.weight} onChange={(e) => setGoalDraft({ ...goalDraft, weight: e.target.value })} />
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Target
              <Input type="number" value={goalDraft.targetValue} onChange={(e) => setGoalDraft({ ...goalDraft, targetValue: e.target.value })} />
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Unit
              <Input value={goalDraft.unit} onChange={(e) => setGoalDraft({ ...goalDraft, unit: e.target.value })} />
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Direction
              <Select value={goalDraft.direction} onChange={(e) => setGoalDraft({ ...goalDraft, direction: e.target.value as GoalDraft["direction"] })}>
                <option value="HigherIsBetter">Higher is better</option>
                <option value="LowerIsBetter">Lower is better</option>
              </Select>
            </label>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Due date
              <Input type="date" value={goalDraft.dueDate} onChange={(e) => setGoalDraft({ ...goalDraft, dueDate: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <Button size="sm" onClick={saveGoal} disabled={working}>Save goal</Button>
              <Button size="sm" variant="outline" onClick={() => setGoalDraft(null)}>Close</Button>
            </div>
          </div>
        )}
      </>
    );
  };

  const reviewCard = (review: PerformanceReviewRow, asManager: boolean) => (
    <Card key={review.id}>
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <CardTitle>{asManager ? `${review.employeeName} | ` : ""}{review.cycleName}</CardTitle>
          <div style={{ display: "flex", gap: 6 }}>
            <Badge variant={review.status === "Completed" ? "success" : "warning"}>{STATUS_LABEL[review.status] ?? review.status}</Badge>
            {review.goalsApproved ? <Badge variant="success">Goals approved</Badge> : <Badge variant="outline">Goals {review.goalWeightTotal}% of 100%</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {review.status === "Completed" && (
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Final rating <strong>{review.finalRating?.toFixed(2) ?? "-"}</strong> {review.ratingLabel ? `(${review.ratingLabel})` : ""}
            {" "}| goals {review.goalScore?.toFixed(2) ?? "-"} | competencies {review.competencyScore?.toFixed(2) ?? "-"}
          </div>
        )}
        {renderGoals(review, true)}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {asManager && !review.goalsApproved && review.status !== "Calibration" && review.status !== "Completed" && companyId && (
            <Button size="sm" onClick={() => act(() => performanceWorkflowApi.approveGoals(companyId, review.id), "Goals approved.")} disabled={working}>
              Approve goals
            </Button>
          )}
          {!asManager && (review.status === "NotStarted" || review.status === "SelfReview") && (
            <Button size="sm" onClick={() => nav(`/hr/performance/reviews/${review.id}`)}>Write self review</Button>
          )}
          {asManager && review.status !== "Calibration" && review.status !== "Completed" && (
            <Button size="sm" onClick={() => nav(`/hr/performance/reviews/${review.id}`)}>Write manager review</Button>
          )}
          {!asManager && review.status === "Completed" && !review.acknowledged && ack?.reviewId !== review.id && (
            <Button size="sm" onClick={() => setAck({ reviewId: review.id, comment: "" })}>Acknowledge</Button>
          )}
          {review.acknowledged && <Badge variant="secondary">Acknowledged</Badge>}
        </div>
        {ack?.reviewId === review.id && companyId && (
          <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 520 }}>
            <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
              Your comment (optional)
              <Textarea rows={2} value={ack.comment} onChange={(e) => setAck({ ...ack, comment: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={async () => { if (await act(() => performanceWorkflowApi.acknowledge(companyId, review.id, ack.comment || undefined), "Review acknowledged.")) setAck(null); }} disabled={working}>
                Acknowledge review
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAck(null)}>Close</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">My Workplace | Performance</div>
          <div className="page-title">My Performance</div>
          <div className="page-sub">
            Goal weights must total 100% before your manager approves them. Update progress during the cycle; achievement is
            calculated from the target and the actual value (100% scores 4 out of 5, 125% or more scores 5).
          </div>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}
      {notice && <div style={{ marginBottom: 12 }}><StateMessage tone="success">{notice}</StateMessage></div>}

      {checkIn && companyId && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader><CardTitle>Update progress</CardTitle></CardHeader>
          <CardContent>
            <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Actual value as of {fmtDate(todayLocalIsoDate())}
                <Input type="number" value={checkIn.value} onChange={(e) => setCheckIn({ ...checkIn, value: e.target.value })} />
              </label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Comment
                <Textarea rows={2} value={checkIn.comment} onChange={(e) => setCheckIn({ ...checkIn, comment: e.target.value })} />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" onClick={saveCheckIn} disabled={working}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setCheckIn(null)}>Close</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <h3 style={{ margin: "8px 0" }}>My reviews</h3>
      {mine.length === 0
        ? <EmptyState title="No reviews" detail="You will see your review here once HR launches a performance cycle." />
        : <div style={{ display: "grid", gap: 12 }}>{mine.map((r) => reviewCard(r, false))}</div>}

      {team.length > 0 && (
        <>
          <h3 style={{ margin: "20px 0 8px" }}>My team</h3>
          <div style={{ display: "grid", gap: 12 }}>{team.map((r) => reviewCard(r, true))}</div>
        </>
      )}
    </div>
  );
}
