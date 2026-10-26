// src/features/telegram-miniapp/attendance/TelegramAttendanceScannerPage.tsx

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LogOut, MapPin, MapPinOff, QrCode } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StateMessage } from "../../../components/ui/Feedback";
import { useI18n } from "../../../i18n";
import { describeError, miniAppRequest } from "../telegramMiniAppClient";
import { getDeviceLocation, openTelegramLocationSettings, type DeviceLocation, type LocationOutcome } from "../telegramLocation";
import { getTelegramUserId, getTelegramWebApp, notifyTelegram } from "../telegramWebApp";

type ClockAction = "ClockIn" | "ClockOut";

type ClockResult = {
  success: boolean;
  message: string;
  action?: ClockAction;
  employeeName?: string;
  branchName?: string;
  attendanceTime?: string;
};

type AttendanceQrPayload = {
  version?: string;
  purpose?: string;
  tenantKey?: string;
  tenantSlug?: string;
  companyId?: string;
  branchId?: string;
  attendanceQrCodeId?: string;
  code?: string;
};

type Notice = { tone: "info" | "success" | "warning" | "error" | "loading"; text: string };

type LocationState =
  | { status: "checking" }
  | { status: "ready"; location: DeviceLocation }
  | { status: "missing"; outcome: Extract<LocationOutcome, { ok: false }> };

const ATTENDANCE_TIME_ZONE = "Africa/Addis_Ababa";

export default function TelegramAttendanceScannerPage() {
  const { tx } = useI18n();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>({ tone: "info", text: tx("Scan the live QR code shown at your branch.") });
  const [result, setResult] = useState<ClockResult | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: "checking" });

  const telegram = getTelegramWebApp();
  const canScanQr = Boolean(telegram?.showScanQrPopup);

  const refreshLocation = useCallback(async (): Promise<DeviceLocation | null> => {
    setLocation({ status: "checking" });
    const outcome = await getDeviceLocation();
    if (outcome.ok) {
      setLocation({ status: "ready", location: outcome.location });
      return outcome.location;
    }
    setLocation({ status: "missing", outcome });
    return null;
  }, []);

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  const submitQr = useCallback(
    async (rawQrText: string, current: DeviceLocation | null) => {
      const parsed = parseAttendanceQrPayload(rawQrText?.trim() ?? "");
      if (!parsed.ok) {
        setNotice({ tone: "error", text: tx(parsed.message) });
        notifyTelegram("error");
        return;
      }

      setBusy(true);
      setResult(null);
      setNotice({ tone: "loading", text: tx("Recording attendance...") });
      try {
        const data = await miniAppRequest<ClockResult>("/telegram/miniapp/attendance/scan", {
          body: {
            tenantKey: parsed.tenantKey,
            telegramUserId: getTelegramUserId() ?? null,
            qrPayload: rawQrText.trim(),
            latitude: current?.latitude ?? null,
            longitude: current?.longitude ?? null,
            accuracyMeters: current?.accuracyMeters ?? null,
          },
        });
        setResult(data);
        setNotice({ tone: "success", text: data.message || tx("Attendance recorded.") });
        notifyTelegram("success");
      } catch (error) {
        setNotice({ tone: "error", text: describeError(error, tx("Unable to process attendance QR.")) });
        notifyTelegram("error");
      } finally {
        setBusy(false);
      }
    },
    [tx],
  );

  const scan = useCallback(async () => {
    if (!telegram?.showScanQrPopup) {
      setNotice({ tone: "error", text: tx("The QR scanner works only in the Telegram mobile app.") });
      return;
    }

    // A fresh fix right before scanning; the server decides whether the branch requires one.
    setBusy(true);
    setNotice({ tone: "loading", text: tx("Checking your location...") });
    const current = await refreshLocation();
    setBusy(false);
    setNotice({ tone: "info", text: tx("Point the camera at the branch QR code.") });

    telegram.showScanQrPopup({ text: tx("Scan your branch attendance QR code") }, (qrText: string) => {
      void submitQr(qrText, current);
      return true;
    });
  }, [refreshLocation, submitQr, telegram, tx]);

  return (
    <section className="tg-mini-page" aria-busy={busy}>
      <StateMessage tone={notice.tone}>{notice.text}</StateMessage>

      <section className="tg-card tg-scan">
        <div className="tg-scan__visual" aria-hidden="true">
          <QrCode size={64} />
        </div>

        <LocationLine state={location} onRetry={() => void refreshLocation()} />

        <Button type="button" size="lg" className="tg-block" onClick={() => void scan()} disabled={busy || !canScanQr}>
          {busy ? tx("Please wait...") : tx("Scan Branch QR")}
        </Button>

        <p className="tg-muted">
          {tx("Use the live QR code displayed at your branch. Expired codes, screenshots and scans away from the branch are rejected.")}
        </p>
      </section>

      {result ? <AttendanceResultCard result={result} /> : null}
    </section>
  );
}

function LocationLine({ state, onRetry }: { state: LocationState; onRetry: () => void }) {
  const { tx } = useI18n();

  if (state.status === "checking") {
    return (
      <span className="tg-location">
        <MapPin size={16} aria-hidden="true" />
        {tx("Checking your location...")}
      </span>
    );
  }

  if (state.status === "ready") {
    const accuracy = state.location.accuracyMeters;
    return (
      <span className="tg-location tg-location--ok">
        <MapPin size={16} aria-hidden="true" />
        {accuracy != null
          ? tx("Location found (within {m} m)", { m: Math.round(accuracy) })
          : tx("Location found")}
      </span>
    );
  }

  const reason =
    state.outcome.reason === "denied"
      ? tx("Location access is off. Your branch may require it to record attendance.")
      : state.outcome.reason === "timeout"
        ? tx("Your location could not be found in time.")
        : tx("This device cannot share its location.");

  return (
    <div className="tg-scan">
      <span className="tg-location tg-location--warn">
        <MapPinOff size={16} aria-hidden="true" />
        {reason}
      </span>
      <div className="tg-actions tg-actions--row">
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {tx("Try again")}
        </Button>
        {state.outcome.canOpenSettings ? (
          <Button type="button" variant="outline" size="sm" onClick={openTelegramLocationSettings}>
            {tx("Open settings")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AttendanceResultCard({ result }: { result: ClockResult }) {
  const { tx } = useI18n();
  const isClockOut = result.action === "ClockOut";

  return (
    <section className="tg-card tg-result">
      <div className="tg-result__head">
        <div className="tg-result__icon" aria-hidden="true">
          {isClockOut ? <LogOut size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <div>
          <p className="tg-card__hint">{tx("Attendance Recorded")}</p>
          <h3 className="tg-card__title">{isClockOut ? tx("Clocked Out") : tx("Clocked In")}</h3>
        </div>
      </div>

      <dl className="tg-details">
        <div>
          <dt>{tx("Employee")}</dt>
          <dd>{result.employeeName ?? "-"}</dd>
        </div>
        <div>
          <dt>{tx("Branch")}</dt>
          <dd>{result.branchName ?? "-"}</dd>
        </div>
        <div>
          <dt>{tx("Time")}</dt>
          <dd>{formatAttendanceTime(result.attendanceTime)}</dd>
        </div>
      </dl>
    </section>
  );
}

function parseAttendanceQrPayload(
  raw: string,
): { ok: true; tenantKey: string } | { ok: false; message: string } {
  if (!raw) return { ok: false, message: "Invalid QR code." };

  let payload: AttendanceQrPayload;
  try {
    payload = JSON.parse(raw) as AttendanceQrPayload;
  } catch {
    return { ok: false, message: "The scanned QR code is not a valid attendance QR." };
  }

  const tenantKey = normalizeString(payload.tenantKey ?? payload.tenantSlug);
  if (!tenantKey) return { ok: false, message: "Attendance QR is missing tenant information." };
  if (!isEqual(payload.version, "v1")) return { ok: false, message: "Unsupported attendance QR version." };
  if (!isEqual(payload.purpose, "attendance")) return { ok: false, message: "This QR code is not an attendance QR code." };
  if (!normalizeString(payload.companyId) || !normalizeString(payload.branchId)) {
    return { ok: false, message: "Attendance QR is missing company or branch information." };
  }
  if (!normalizeString(payload.attendanceQrCodeId) || !normalizeString(payload.code)) {
    return { ok: false, message: "Attendance QR is missing secure QR information." };
  }
  return { ok: true, tenantKey };
}

function formatAttendanceTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: ATTENDANCE_TIME_ZONE });
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isEqual(value: unknown, expected: string): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === expected.toLowerCase();
}
