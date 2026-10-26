import { memo, useCallback, useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { EmptyState, StateMessage } from "../../../components/ui/Feedback";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import { notifyTelegram } from "../telegramWebApp";
import {
  getTelegramLeaveBalances,
  getTelegramLeaveRequests,
  getTelegramLeaveTypes,
  submitTelegramLeaveRequest,
  submitTelegramOvertimeRequest,
  type TelegramLeaveBalanceDto,
  type TelegramLeaveRequestDto,
  type TelegramLeaveTypeDto,
} from "../telegramMiniAppApi";
import { describeError } from "../telegramMiniAppClient";
import { TgCardHeader, TgField, TgStatus, fmtDate } from "../TelegramUi";

type Mode = "leave" | "overtime";
type Notice = { tone: "info" | "success" | "error"; text: string } | null;

type Props = {
  mode: Mode;
};

function localIsoDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toUtcIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function yearOf(value: string): number {
  const year = Number((value || localIsoDate()).slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Leave and overtime self-service for the linked employee. */
function TelegramHrRequestsPage({ mode }: Props) {
  const { tx } = useI18n();

  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<TelegramLeaveTypeDto[]>([]);
  const [balances, setBalances] = useState<TelegramLeaveBalanceDto[]>([]);
  const [requests, setRequests] = useState<TelegramLeaveRequestDto[]>([]);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(localIsoDate());
  const [endDate, setEndDate] = useState(localIsoDate());
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"Morning" | "Afternoon">("Morning");
  const [leaveReason, setLeaveReason] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  const [otDate, setOtDate] = useState(localIsoDate());
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

  const year = yearOf(startDate);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [types, balanceRows, requestRows] = await Promise.all([
        getTelegramLeaveTypes(),
        getTelegramLeaveBalances(year),
        getTelegramLeaveRequests(year),
      ]);
      setLeaveTypes(types);
      setBalances(balanceRows);
      setRequests(requestRows);
      setLeaveTypeId((current) => current || types[0]?.id || "");
    } catch (error) {
      setNotice({ tone: "error", text: describeError(error, tx("Unable to load leave details.")) });
    } finally {
      setLoading(false);
    }
  }, [tx, year]);

  useEffect(() => {
    if (mode === "leave") void load();
  }, [load, mode]);

  useEffect(() => setNotice(null), [mode]);

  const selectedBalance = balances.find((row) => row.leaveTypeId === leaveTypeId);
  const selectedType = leaveTypes.find((row) => row.id === leaveTypeId);

  async function submitLeave() {
    if (!leaveTypeId) return setNotice({ tone: "error", text: tx("Select a leave type.") });
    if (endDate < startDate) return setNotice({ tone: "error", text: tx("The end date cannot be before the start date.") });
    if (!leaveReason.trim()) return setNotice({ tone: "error", text: tx("Enter the leave reason.") });

    const doc = documentUrl.trim();
    if (selectedType?.requiresDocument && !doc) {
      return setNotice({ tone: "error", text: tx("{type} needs a link to the supporting document.", { type: selectedType.name }) });
    }
    if (doc && !isHttpUrl(doc)) {
      return setNotice({ tone: "error", text: tx("The document must be a web link starting with https://") });
    }

    setSubmitting(true);
    try {
      await submitTelegramLeaveRequest({
        leaveTypeId,
        startDate,
        endDate,
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod : null,
        reason: leaveReason.trim(),
        documentUrl: doc || null,
      });
      notifyTelegram("success");
      setLeaveReason("");
      setDocumentUrl("");
      setNotice({ tone: "success", text: tx("Leave request submitted for approval.") });
      await load();
    } catch (error) {
      notifyTelegram("error");
      setNotice({ tone: "error", text: describeError(error, tx("Unable to submit leave request.")) });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOvertime() {
    const hours = Number(otHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 16) {
      return setNotice({ tone: "error", text: tx("Enter overtime hours between 0.25 and 16.") });
    }
    if (!businessReason.trim() || !workAssignment.trim() || !kpiDescription.trim() || !kpiTarget.trim() || !kpiMeasurement.trim()) {
      return setNotice({ tone: "error", text: tx("Fill in the reason, assignment, deliverable, target and measurement.") });
    }

    setSubmitting(true);
    try {
      await submitTelegramOvertimeRequest({
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
      setNotice({ tone: "success", text: tx("Overtime request submitted for manager pre-approval.") });
    } catch (error) {
      notifyTelegram("error");
      setNotice({ tone: "error", text: describeError(error, tx("Unable to submit overtime request.")) });
    } finally {
      setSubmitting(false);
    }
  }

  const noticeBlock = notice ? <StateMessage tone={notice.tone}>{notice.text}</StateMessage> : null;

  if (mode === "overtime") {
    return (
      <>
        {noticeBlock}
        <section className="tg-card">
          <TgCardHeader title={tx("Overtime Pre-Approval")} hint={tx("Ask your manager before working the extra hours.")} />
          <TgField label={tx("Date")} required>
            <Input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} />
          </TgField>
          <div className="tg-grid-3">
            <TgField label={tx("Start")}>
              <Input type="time" value={otStart} onChange={(e) => setOtStart(e.target.value)} />
            </TgField>
            <TgField label={tx("End")}>
              <Input type="time" value={otEnd} onChange={(e) => setOtEnd(e.target.value)} />
            </TgField>
            <TgField label={tx("Hours")} required>
              <Input type="number" inputMode="decimal" min="0.25" max="16" step="0.25" value={otHours} onChange={(e) => setOtHours(e.target.value)} />
            </TgField>
          </div>
          <TgField label={tx("Business reason")} required>
            <Textarea value={businessReason} onChange={(e) => setBusinessReason(e.target.value)} placeholder={tx("Why this cannot wait for regular hours")} maxLength={1000} />
          </TgField>
          <TgField label={tx("Work assignment")} required>
            <Textarea value={workAssignment} onChange={(e) => setWorkAssignment(e.target.value)} placeholder={tx("Specific task or assignment")} maxLength={1000} />
          </TgField>
          <TgField label={tx("KPI / deliverable")} required>
            <Textarea value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} placeholder={tx("Measurable output expected")} maxLength={1000} />
          </TgField>
          <TgField label={tx("Target")} required>
            <Input value={kpiTarget} onChange={(e) => setKpiTarget(e.target.value)} placeholder={tx("Target value or completion condition")} maxLength={300} />
          </TgField>
          <TgField label={tx("Measurement method")} required>
            <Input value={kpiMeasurement} onChange={(e) => setKpiMeasurement(e.target.value)} placeholder={tx("How the manager verifies the KPI")} maxLength={300} />
          </TgField>
          <TgField label={tx("Evidence expected")}>
            <Input value={requiredEvidence} onChange={(e) => setRequiredEvidence(e.target.value)} placeholder={tx("Report, checklist, photo, or document")} maxLength={300} />
          </TgField>
          <TgField label={tx("Related activity")}>
            <Input value={relatedActivity} onChange={(e) => setRelatedActivity(e.target.value)} placeholder={tx("Project, department, or operation")} maxLength={300} />
          </TgField>
          <Button type="button" className="tg-block" disabled={submitting} onClick={() => void submitOvertime()}>
            {submitting ? tx("Submitting...") : tx("Submit Overtime")}
          </Button>
        </section>
      </>
    );
  }

  return (
    <>
      {noticeBlock}
      <section className="tg-card">
        <TgCardHeader title={tx("Leave Request")} />
        <TgField label={tx("Leave type")} required>
          <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} disabled={loading}>
            {leaveTypes.length === 0 ? <option value="">{loading ? tx("Loading...") : tx("No leave types")}</option> : null}
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </TgField>
        {selectedBalance ? (
          <div className="tg-meta">
            <div>
              <span>{tx("Available")}</span>
              <strong>{tx("{n} days", { n: selectedBalance.available })}</strong>
            </div>
            <div>
              <span>{tx("Pending")}</span>
              <strong>{tx("{n} days", { n: selectedBalance.pending })}</strong>
            </div>
          </div>
        ) : null}
        <div className="tg-grid-2">
          <TgField label={tx("Start")} required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </TgField>
          <TgField label={tx("End")} required>
            <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </TgField>
        </div>
        <label className="tg-toggle">
          <span>{tx("Half day")}</span>
          <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} />
        </label>
        {isHalfDay ? (
          <TgField label={tx("Half")}>
            <Select value={halfDayPeriod} onChange={(e) => setHalfDayPeriod(e.target.value as "Morning" | "Afternoon")}>
              <option value="Morning">{tx("Morning")}</option>
              <option value="Afternoon">{tx("Afternoon")}</option>
            </Select>
          </TgField>
        ) : null}
        <TgField label={tx("Reason")} required>
          <Textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder={tx("Brief reason for leave")} maxLength={1000} />
        </TgField>
        <TgField
          label={tx("Supporting document link")}
          required={selectedType?.requiresDocument}
          help={tx("A web link (https://...) to the document, for example a medical certificate in shared storage.")}
        >
          <Input type="url" inputMode="url" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="https://" maxLength={1000} />
        </TgField>
        <Button type="button" className="tg-block" disabled={submitting || loading} onClick={() => void submitLeave()}>
          {submitting ? tx("Submitting...") : tx("Submit Leave")}
        </Button>
      </section>

      <section className="tg-card">
        <TgCardHeader title={tx("Recent Leave Requests")} hint={String(year)} />
        {requests.length === 0 ? (
          <EmptyState title={tx("No leave requests yet.")} detail={tx("Requests you submit appear here with their status.")} />
        ) : (
          <div className="tg-list">
            {requests.slice(0, 10).map((request) => (
              <div key={request.id} className="tg-row">
                <div className="tg-row__body">
                  <strong>{request.leaveTypeName}</strong>
                  <small>
                    {fmtDate(request.startDate)} - {fmtDate(request.endDate)} | {tx("{n} days", { n: request.numberOfDays })}
                  </small>
                </div>
                <TgStatus status={request.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default memo(TelegramHrRequestsPage);
