import React, { memo, useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "../../../i18n";
import {
  getTelegramInitData,
  getTelegramRuntimeState,
  getTelegramTheme,
  notifyTelegram,
} from "../telegramWebApp";
import type { TelegramMiniAppAuthResult } from "../telegramMiniApp.types";
import {
  getTelegramLeaveBalances,
  getTelegramLeaveRequests,
  getTelegramLeaveTypes,
  submitTelegramLeaveRequest,
  submitTelegramOvertimeRequest,
  type TelegramLeaveBalanceDto,
  type TelegramLeaveRequestDto,
  type TelegramLeaveTypeDto,
  type TelegramMiniAppScope,
} from "../telegramMiniAppApi";

type Mode = "leave" | "overtime";
type Notice = { type: "info" | "success" | "error"; text: string };

type Props = {
  auth: TelegramMiniAppAuthResult;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function toUtcIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function yearOf(value: string): number {
  const year = Number((value || todayIso()).slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value.slice(0, 10)
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function TelegramHrRequestsPage({ auth }: Props) {
  const { tx } = useI18n();
  const initData = getTelegramInitData();
  const runtime = getTelegramRuntimeState();
  const theme = getTelegramTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const scope = useMemo<TelegramMiniAppScope>(() => ({
    initData,
    tenantKey: auth.tenantSlug ?? runtime.startParam,
    companyId: auth.companyId,
  }), [auth.companyId, auth.tenantSlug, initData, runtime.startParam]);

  const [mode, setMode] = useState<Mode>("leave");
  const [notice, setNotice] = useState<Notice>({ type: "info", text: "Submit requests from your linked employee profile." });
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<TelegramLeaveTypeDto[]>([]);
  const [balances, setBalances] = useState<TelegramLeaveBalanceDto[]>([]);
  const [requests, setRequests] = useState<TelegramLeaveRequestDto[]>([]);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"Morning" | "Afternoon">("Morning");
  const [leaveReason, setLeaveReason] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  const [otDate, setOtDate] = useState(todayIso());
  const [otStart, setOtStart] = useState("");
  const [otEnd, setOtEnd] = useState("");
  const [otHours, setOtHours] = useState("1");
  const [businessReason, setBusinessReason] = useState("");
  const [workAssignment, setWorkAssignment] = useState("");
  const [kpiDescription, setKpiDescription] = useState("");
  const [kpiTarget, setKpiTarget] = useState("");
  const [kpiMeasurement, setKpiMeasurement] = useState("");
  const [requiredEvidence, setRequiredEvidence] = useState("");
  const [relatedActivity, setRelatedActivity] = useState("");

  const load = useCallback(async () => {
    if (!scope.initData || !scope.tenantKey) {
      setNotice({ type: "error", text: "Telegram session is missing. Reopen the Mini App from the bot." });
      return;
    }

    setLoading(true);
    try {
      const year = yearOf(startDate);
      const [types, balanceRows, requestRows] = await Promise.all([
        getTelegramLeaveTypes(scope),
        getTelegramLeaveBalances(scope, year),
        getTelegramLeaveRequests(scope, year),
      ]);

      setLeaveTypes(types);
      setBalances(balanceRows);
      setRequests(requestRows);
      setLeaveTypeId((current) => current || types[0]?.id || "");
      setNotice({ type: "info", text: "Ready for leave and overtime self-service." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to load HR requests." });
    } finally {
      setLoading(false);
    }
  }, [scope, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedBalance = balances.find((row) => row.leaveTypeId === leaveTypeId);
  const selectedType = leaveTypes.find((row) => row.id === leaveTypeId);

  async function submitLeave() {
    if (!leaveTypeId) {
      setNotice({ type: "error", text: "Select a leave type." });
      return;
    }

    if (!leaveReason.trim()) {
      setNotice({ type: "error", text: "Enter the leave reason." });
      return;
    }

    if (selectedType?.requiresDocument && !documentUrl.trim()) {
      setNotice({ type: "error", text: `${selectedType.name} requires a supporting document reference.` });
      return;
    }

    setLoading(true);
    try {
      await submitTelegramLeaveRequest(scope, {
        leaveTypeId,
        startDate,
        endDate,
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod : null,
        reason: leaveReason.trim(),
        documentUrl: documentUrl.trim() || null,
      });

      notifyTelegram("success");
      setLeaveReason("");
      setDocumentUrl("");
      setNotice({ type: "success", text: "Leave request submitted for approval." });
      await load();
    } catch (error) {
      notifyTelegram("error");
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to submit leave request." });
    } finally {
      setLoading(false);
    }
  }

  async function submitOvertime() {
    const hours = Number(otHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setNotice({ type: "error", text: "Enter valid overtime hours." });
      return;
    }

    setLoading(true);
    try {
      await submitTelegramOvertimeRequest(scope, {
        date: otDate,
        plannedStartUtc: toUtcIso(otDate, otStart),
        plannedEndUtc: toUtcIso(otDate, otEnd),
        hours,
        businessReason: businessReason.trim(),
        workAssignment: workAssignment.trim(),
        kpiDescription: kpiDescription.trim(),
        kpiTarget: kpiTarget.trim(),
        kpiMeasurementMethod: kpiMeasurement.trim(),
        requiredEvidence: requiredEvidence.trim() || null,
        relatedActivity: relatedActivity.trim() || null,
      });

      notifyTelegram("success");
      setBusinessReason("");
      setWorkAssignment("");
      setKpiDescription("");
      setKpiTarget("");
      setKpiMeasurement("");
      setRequiredEvidence("");
      setRelatedActivity("");
      setNotice({ type: "success", text: "Overtime request submitted for manager pre-approval." });
    } catch (error) {
      notifyTelegram("error");
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to submit overtime request." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={styles.page}>
      <div style={styles.segment}>
        <button type="button" style={{ ...styles.segmentButton, ...(mode === "leave" ? styles.segmentButtonActive : null) }} onClick={() => setMode("leave")}>
          {tx("Leave")}
        </button>
        <button type="button" style={{ ...styles.segmentButton, ...(mode === "overtime" ? styles.segmentButtonActive : null) }} onClick={() => setMode("overtime")}>
          {tx("Overtime")}
        </button>
      </div>

      <div style={{ ...styles.notice, ...(notice.type === "error" ? styles.noticeError : notice.type === "success" ? styles.noticeSuccess : null) }}>
        {tx(notice.text)}
      </div>

      {mode === "leave" ? (
        <section style={styles.card}>
          <h3 style={styles.title}>{tx("Leave Request")}</h3>
          <label style={styles.field}>
            <span>{tx("Leave type")}</span>
            <select style={styles.input} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </label>
          {selectedBalance && (
            <div style={styles.balance}>
              {tx("Available {available} days. Pending {pending} days.", { available: selectedBalance.available, pending: selectedBalance.pending })}
            </div>
          )}
          <div style={styles.grid2}>
            <label style={styles.field}>
              <span>{tx("Start")}</span>
              <input style={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label style={styles.field}>
              <span>{tx("End")}</span>
              <input style={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          <label style={styles.toggle}>
            <span>{tx("Half day")}</span>
            <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} />
          </label>
          {isHalfDay && (
            <select style={styles.input} value={halfDayPeriod} onChange={(e) => setHalfDayPeriod(e.target.value as "Morning" | "Afternoon")}>
              <option value="Morning">{tx("Morning")}</option>
              <option value="Afternoon">{tx("Afternoon")}</option>
            </select>
          )}
          <label style={styles.field}>
            <span>{tx("Reason")}</span>
            <textarea style={styles.textarea} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder={tx("Brief reason for leave")} />
          </label>
          <label style={styles.field}>
            <span>{tx("Document reference")}</span>
            <input style={styles.input} value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder={tx("Required for configured leave types")} />
          </label>
          <button type="button" style={styles.primary} disabled={loading} onClick={() => void submitLeave()}>
            {loading ? tx("Submitting...") : tx("Submit Leave")}
          </button>
        </section>
      ) : (
        <section style={styles.card}>
          <h3 style={styles.title}>{tx("Overtime Pre-Approval")}</h3>
          <label style={styles.field}>
            <span>{tx("Date")}</span>
            <input style={styles.input} type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} />
          </label>
          <div style={styles.grid3}>
            <label style={styles.field}>
              <span>{tx("Start")}</span>
              <input style={styles.input} type="time" value={otStart} onChange={(e) => setOtStart(e.target.value)} />
            </label>
            <label style={styles.field}>
              <span>{tx("End")}</span>
              <input style={styles.input} type="time" value={otEnd} onChange={(e) => setOtEnd(e.target.value)} />
            </label>
            <label style={styles.field}>
              <span>{tx("Hours")}</span>
              <input style={styles.input} type="number" min="0.25" step="0.25" value={otHours} onChange={(e) => setOtHours(e.target.value)} />
            </label>
          </div>
          <label style={styles.field}>
            <span>{tx("Business reason")}</span>
            <textarea style={styles.textarea} value={businessReason} onChange={(e) => setBusinessReason(e.target.value)} placeholder={tx("Why this cannot wait for regular hours")} />
          </label>
          <label style={styles.field}>
            <span>{tx("Work assignment")}</span>
            <textarea style={styles.textarea} value={workAssignment} onChange={(e) => setWorkAssignment(e.target.value)} placeholder={tx("Specific task or assignment")} />
          </label>
          <label style={styles.field}>
            <span>{tx("KPI / deliverable")}</span>
            <textarea style={styles.textarea} value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} placeholder={tx("Measurable output expected")} />
          </label>
          <label style={styles.field}>
            <span>{tx("Target")}</span>
            <input style={styles.input} value={kpiTarget} onChange={(e) => setKpiTarget(e.target.value)} placeholder={tx("Target value or completion condition")} />
          </label>
          <label style={styles.field}>
            <span>{tx("Measurement method")}</span>
            <input style={styles.input} value={kpiMeasurement} onChange={(e) => setKpiMeasurement(e.target.value)} placeholder={tx("How the manager verifies the KPI")} />
          </label>
          <label style={styles.field}>
            <span>{tx("Evidence expected")}</span>
            <input style={styles.input} value={requiredEvidence} onChange={(e) => setRequiredEvidence(e.target.value)} placeholder={tx("Report, checklist, photo, or document")} />
          </label>
          <label style={styles.field}>
            <span>{tx("Related activity")}</span>
            <input style={styles.input} value={relatedActivity} onChange={(e) => setRelatedActivity(e.target.value)} placeholder={tx("Project, department, or operation")} />
          </label>
          <button type="button" style={styles.primary} disabled={loading} onClick={() => void submitOvertime()}>
            {loading ? tx("Submitting...") : tx("Submit Overtime")}
          </button>
        </section>
      )}

      <section style={styles.card}>
        <h3 style={styles.title}>{tx("Recent Leave Requests")}</h3>
        {requests.length === 0 ? (
          <div style={styles.empty}>{tx("No leave requests yet.")}</div>
        ) : (
          <div style={styles.list}>
            {requests.slice(0, 5).map((request) => (
              <div key={request.id} style={styles.row}>
                <div>
                  <strong>{request.leaveTypeName}</strong>
                  <small>{formatDate(request.startDate)} - {formatDate(request.endDate)} | {request.numberOfDays} day(s)</small>
                </div>
                <span style={styles.badge}>{request.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default memo(TelegramHrRequestsPage);

function createStyles(theme: Record<string, string>) {
  const button = theme.button_color ?? "#2481cc";
  const text = theme.text_color ?? "#111827";
  const hint = theme.hint_color ?? "#6b7280";

  return {
    page: { display: "grid", gap: 14 },
    segment: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 4, borderRadius: 18, background: "#eef2ff" },
    segmentButton: { border: "none", borderRadius: 14, padding: "11px 8px", background: "transparent", color: hint, fontWeight: 900 },
    segmentButtonActive: { background: "#ffffff", color: button, boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)" },
    notice: { padding: 12, borderRadius: 16, background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, fontSize: 13, lineHeight: 1.35 },
    noticeError: { background: "#fef2f2", color: "#991b1b" },
    noticeSuccess: { background: "#ecfdf5", color: "#047857" },
    card: { display: "grid", gap: 12, padding: 14, borderRadius: 20, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)" },
    title: { margin: 0, fontSize: 18, fontWeight: 900, color: text },
    field: { display: "grid", gap: 6, fontSize: 12, color: hint, fontWeight: 800 },
    input: { width: "100%", minWidth: 0, border: "1px solid #d1d5db", borderRadius: 12, padding: "11px 12px", fontSize: 15, boxSizing: "border-box" },
    textarea: { width: "100%", minWidth: 0, minHeight: 78, border: "1px solid #d1d5db", borderRadius: 12, padding: "11px 12px", fontSize: 15, boxSizing: "border-box", resize: "vertical" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 8 },
    toggle: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, border: "1px solid #e5e7eb", borderRadius: 14, fontWeight: 900, color: text },
    balance: { padding: 10, borderRadius: 14, background: "#f8fafc", color: hint, fontSize: 13, fontWeight: 800 },
    primary: { border: "none", borderRadius: 14, padding: "13px 14px", background: button, color: "#fff", fontWeight: 900, fontSize: 15 },
    empty: { padding: 16, textAlign: "center", color: hint, fontWeight: 800 },
    list: { display: "grid", gap: 8 },
    row: { display: "flex", justifyContent: "space-between", gap: 10, padding: 12, border: "1px solid #e5e7eb", borderRadius: 14 },
    badge: { alignSelf: "flex-start", borderRadius: 999, padding: "4px 8px", background: "#eef2ff", color: "#3730a3", fontSize: 11, fontWeight: 900 },
  } satisfies Record<string, React.CSSProperties>;
}
