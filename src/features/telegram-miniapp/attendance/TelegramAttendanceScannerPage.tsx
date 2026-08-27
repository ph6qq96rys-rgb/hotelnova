// src/features/telegram-miniapp/attendance/TelegramAttendanceScannerPage.tsx

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  getTelegramInitData,
  getTelegramRuntimeState,
  getTelegramTheme,
  getTelegramWebApp,
  notifyTelegram,
  waitForTelegramMiniApp,
} from "../telegramWebApp";

type ClockAction = "ClockIn" | "ClockOut";
type NoticeKind = "info" | "success" | "error";

type ClockResult = {
  success: boolean;
  message: string;
  action?: ClockAction;
  employeeName?: string;
  branchName?: string;
  attendanceTime?: string;
};

type MessageState = {
  type: NoticeKind;
  text: string;
};

type AttendanceQrPayload = {
  version?: string;
  purpose?: string;
  tenantKey?: string;
  tenantSlug?: string;
  action?: string;
  companyId?: string;
  branchId?: string;
  attendanceQrCodeId?: string;
  code?: string;
  validFromUtc?: string;
  validToUtc?: string | null;
};

const ATTENDANCE_SCAN_ENDPOINT = "/api/telegram/miniapp/attendance/scan";
const ATTENDANCE_TIME_ZONE = "Africa/Addis_Ababa";

const DEFAULT_MESSAGE: MessageState = {
  type: "info",
  text: "Ready when you are. Scan your branch QR to record attendance.",
};

export default function TelegramAttendanceScannerPage() {
  const [loading, setLoading] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [hasInitData, setHasInitData] = useState(false);
  const [message, setMessage] = useState<MessageState>(DEFAULT_MESSAGE);
  const [result, setResult] = useState<ClockResult | null>(null);

  const telegram = getTelegramWebApp();
  const initData = getTelegramInitData();
  const theme = getTelegramTheme();
  const userId = telegram?.initDataUnsafe?.user?.id;

  const styles = useMemo(() => createStyles(theme), [theme]);

  const headers = useMemo(
    () => ({
      "X-Telegram-InitData": initData,
    }),
    [initData],
  );

  useEffect(() => {
    telegram?.ready?.();
    telegram?.expand?.();

    return waitForTelegramMiniApp((state) => {
      setRuntimeReady(state.webAppLoaded);
      setHasInitData(state.hasInitData);
      setMessage(getRuntimeMessage(state.webAppLoaded, state.hasInitData));
    });
  }, [telegram]);

  const submitQr = useCallback(
    async (rawQrText: string) => {
      const runtime = getTelegramRuntimeState();
      const runtimeMessage = getRuntimeMessage(
        runtime.webAppLoaded,
        runtime.hasInitData,
      );

      if (runtimeMessage.type === "error") {
        setMessage(runtimeMessage);
        return;
      }

      const qrPayload = rawQrText?.trim();
      if (!qrPayload) {
        setMessage({ type: "error", text: "Invalid QR code." });
        return;
      }

      const parsed = parseAttendanceQrPayload(qrPayload);
      if (!parsed.ok) {
        setMessage({ type: "error", text: parsed.message });
        notifyTelegram("error");
        return;
      }

      const telegramUserId = Number(userId);
      if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
        setMessage({
          type: "error",
          text: "Telegram user identity is missing. Please reopen attendance from the bot.",
        });
        notifyTelegram("error");
        return;
      }

      try {
        setLoading(true);
        setResult(null);
        setMessage({ type: "info", text: "Processing attendance..." });

        const { data } = await axios.post<ClockResult>(
          ATTENDANCE_SCAN_ENDPOINT,
          {
            tenantKey: parsed.tenantKey,
            initData,
            telegramUserId,
            qrPayload,
          },
          { headers },
        );

        setResult(data);
        setMessage({
          type: data.success ? "success" : "info",
          text:
            data.message ||
            (data.success
              ? "Attendance recorded."
              : "Attendance was not recorded."),
        });
        notifyTelegram(data.success ? "success" : "warning");
      } catch (error) {
        setMessage({
          type: "error",
          text: getApiErrorMessage(error, "Unable to process attendance QR."),
        });
        notifyTelegram("error");
      } finally {
        setLoading(false);
      }
    },
    [headers, initData, userId],
  );

  const scan = useCallback(() => {
    const runtime = getTelegramRuntimeState();
    const runtimeMessage = getRuntimeMessage(
      runtime.webAppLoaded,
      runtime.hasInitData,
    );

    if (runtimeMessage.type === "error") {
      setMessage(runtimeMessage);
      return;
    }

    if (!telegram?.showScanQrPopup) {
      setMessage({
        type: "error",
        text: "QR scanner is available only inside the Telegram mobile app.",
      });
      return;
    }

    telegram.showScanQrPopup(
      { text: "Scan your branch attendance QR code" },
      (qrText: string) => {
        void submitQr(qrText);
        return true;
      },
    );
  }, [submitQr, telegram]);

  const canScan = runtimeReady && hasInitData && !loading;

  return (
    <section style={styles.page} aria-busy={loading}>
      <div style={styles.shell}>
        <header style={styles.heroCard}>
          <div style={styles.heroGlow} aria-hidden="true" />

          <div style={styles.heroContent}>
            <div style={styles.pill}>
              <span style={styles.pulseDot} aria-hidden="true" />
              HR Attendance
            </div>
            <h2 style={styles.title}>Branch QR Scanner</h2>
            <p style={styles.subtitle}>
              Fast, secure clock in and clock out through your Telegram mini
              app.
            </p>
          </div>

          <div style={styles.heroIconWrap} aria-hidden="true">
            <div style={styles.heroIcon}></div>
          </div>
        </header>

        <Notice message={message} styles={styles} />

        <section style={styles.card}>
          <div style={styles.scanVisual} aria-hidden="true">
            <span style={styles.cornerTopLeft} />
            <span style={styles.cornerTopRight} />
            <span style={styles.cornerBottomLeft} />
            <span style={styles.cornerBottomRight} />
            <span style={styles.qrGlyph}></span>
          </div>

          <button
            type="button"
            onClick={scan}
            disabled={!canScan}
            style={{
              ...styles.scanButton,
              ...(!canScan ? styles.buttonDisabled : null),
            }}
          >
            <span style={styles.buttonIcon} aria-hidden="true">
              {loading ? "" : ""}
            </span>
            {loading ? "Processing attendance..." : "Scan Branch QR"}
          </button>

          <p style={styles.helperText}>
            Use the live QR code displayed at your branch. Rotated, expired, or
            screenshot QR codes may be rejected.
          </p>
        </section>

        {result && <AttendanceResultCard result={result} styles={styles} />}
      </div>
    </section>
  );
}

const Notice = memo(function Notice({
  message,
  styles,
}: {
  message: MessageState;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...styles.notice,
        ...(message.type === "success" ? styles.noticeSuccess : null),
        ...(message.type === "error" ? styles.noticeError : null),
      }}
    >
      <span style={styles.noticeIcon} aria-hidden="true">
        {message.type === "success"
          ? ""
          : message.type === "error"
            ? "!"
            : "i"}
      </span>
      <span>{message.text}</span>
    </div>
  );
});

const AttendanceResultCard = memo(function AttendanceResultCard({
  result,
  styles,
}: {
  result: ClockResult;
  styles: ReturnType<typeof createStyles>;
}) {
  const isClockOut = result.action === "ClockOut";

  return (
    <section style={styles.resultCard}>
      <div style={styles.resultTop}>
        <div
          style={{
            ...styles.resultIcon,
            ...(isClockOut ? styles.resultIconMuted : null),
          }}
          aria-hidden="true"
        >
          {isClockOut ? "" : ""}
        </div>

        <div>
          <div style={styles.eyebrowDark}>Attendance Recorded</div>
          <h3 style={styles.resultTitle}>
            {isClockOut ? "Clocked Out" : "Clocked In"}
          </h3>
        </div>
      </div>

      <div style={styles.resultGrid}>
        <InfoRow
          label="Employee"
          value={result.employeeName ?? "-"}
          styles={styles}
        />
        <InfoRow
          label="Branch"
          value={result.branchName ?? "-"}
          styles={styles}
        />
        <InfoRow
          label="Time"
          value={formatAttendanceTime(result.attendanceTime)}
          styles={styles}
        />
      </div>
    </section>
  );
});

const InfoRow = memo(function InfoRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
});

function parseAttendanceQrPayload(
  raw: string,
):
  | { ok: true; tenantKey: string; payload: AttendanceQrPayload }
  | { ok: false; message: string } {
  let payload: AttendanceQrPayload;

  try {
    payload = JSON.parse(raw) as AttendanceQrPayload;
  } catch {
    return {
      ok: false,
      message: "The scanned QR code is not a valid attendance QR.",
    };
  }

  const tenantKey = normalizeString(payload.tenantKey ?? payload.tenantSlug);
  if (!tenantKey) {
    return {
      ok: false,
      message: "Attendance QR is missing tenant information.",
    };
  }

  if (!isEqual(payload.version, "v1")) {
    return { ok: false, message: "Unsupported attendance QR version." };
  }

  if (!isEqual(payload.purpose, "attendance")) {
    return { ok: false, message: "This QR code is not an attendance QR code." };
  }

  if (
    !normalizeString(payload.companyId) ||
    !normalizeString(payload.branchId)
  ) {
    return {
      ok: false,
      message: "Attendance QR is missing company or branch information.",
    };
  }

  if (
    !normalizeString(payload.attendanceQrCodeId) ||
    !normalizeString(payload.code)
  ) {
    return {
      ok: false,
      message: "Attendance QR is missing secure QR information.",
    };
  }

  return { ok: true, tenantKey, payload };
}

function getRuntimeMessage(
  webAppLoaded: boolean,
  hasInitData: boolean,
): MessageState {
  if (!webAppLoaded) {
    return {
      type: "error",
      text: "Please open attendance from the Telegram bot.",
    };
  }

  if (!hasInitData) {
    return {
      type: "error",
      text: "Telegram auth data is missing. Please reopen from the bot menu button or WebApp button.",
    };
  }

  return DEFAULT_MESSAGE;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const data = error.response?.data;

  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    return (
      stringFromUnknown(payload.message) ??
      stringFromUnknown(payload.Message) ??
      stringFromUnknown(payload.error) ??
      stringFromUnknown(payload.Error) ??
      stringFromUnknown(payload.title) ??
      stringFromUnknown(
        (payload.data as Record<string, unknown> | undefined)?.message,
      ) ??
      fallback
    );
  }

  return fallback;
}

function formatAttendanceTime(value?: string): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ATTENDANCE_TIME_ZONE,
  });
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isEqual(value: unknown, expected: string): boolean {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase() === expected.toLowerCase()
  );
}

function createStyles(theme: Record<string, string>) {
  const bg = theme.bg_color ?? "#f6f7fb";
  const cardBg = theme.secondary_bg_color ?? "#ffffff";
  const text = theme.text_color ?? "#111827";
  const hint = theme.hint_color ?? "#6b7280";
  const button = theme.button_color ?? "#2481cc";
  const buttonText = theme.button_text_color ?? "#ffffff";
  const border = theme.hint_color ? `${theme.hint_color}2f` : "#e5e7eb";
  const softBorder = theme.hint_color ? `${theme.hint_color}1f` : "#eef2f7";
  const surface = cardBg;
  const mutedSurface = theme.secondary_bg_color
    ? `${theme.secondary_bg_color}`
    : "#f9fafb";

  return {
    page: {
      minHeight: "100%",
      padding: "16px 14px 96px",
      background: `radial-gradient(circle at top left, ${button}24 0, transparent 34%), ${bg}`,
      color: text,
      boxSizing: "border-box",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    },
    shell: {
      width: "100%",
      maxWidth: 460,
      margin: "0 auto",
      display: "grid",
      gap: 14,
    },
    heroCard: {
      position: "relative",
      overflow: "hidden",
      padding: 20,
      minHeight: 148,
      borderRadius: 28,
      background: `linear-gradient(135deg, #0f172a 0%, #1d4ed8 58%, ${button} 100%)`,
      color: "#ffffff",
      boxShadow: "0 22px 50px rgba(15, 23, 42, 0.28)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      isolation: "isolate",
    },
    heroGlow: {
      position: "absolute",
      right: -54,
      top: -68,
      width: 172,
      height: 172,
      borderRadius: "999px",
      background: "rgba(255,255,255,0.18)",
      filter: "blur(2px)",
      zIndex: -1,
    },
    heroContent: {
      maxWidth: 292,
    },
    pill: {
      width: "fit-content",
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "7px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.14)",
      border: "1px solid rgba(255,255,255,0.18)",
      color: "rgba(255,255,255,0.88)",
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: 0.7,
      textTransform: "uppercase",
      backdropFilter: "blur(10px)",
    },
    pulseDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      background: "#22c55e",
      boxShadow: "0 0 0 4px rgba(34, 197, 94, 0.18)",
    },
    heroIconWrap: {
      width: 64,
      height: 64,
      padding: 8,
      borderRadius: 24,
      background: "rgba(255,255,255,0.13)",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
      flexShrink: 0,
    },
    heroIcon: {
      width: "100%",
      height: "100%",
      borderRadius: 18,
      display: "grid",
      placeItems: "center",
      background: "rgba(255,255,255,0.16)",
      fontSize: 36,
      fontWeight: 900,
      lineHeight: 1,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.72)",
    },
    eyebrowDark: {
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: hint,
    },
    title: {
      margin: "14px 0 0",
      fontSize: 27,
      lineHeight: 1.04,
      fontWeight: 950,
      letterSpacing: -0.6,
    },
    subtitle: {
      margin: "10px 0 0",
      fontSize: 14,
      lineHeight: 1.45,
      color: "rgba(255,255,255,0.82)",
      fontWeight: 650,
    },
    card: {
      padding: 16,
      borderRadius: 28,
      border: `1px solid ${border}`,
      background: surface,
      boxShadow: "0 16px 38px rgba(15, 23, 42, 0.08)",
    },
    scanVisual: {
      position: "relative",
      height: 142,
      marginBottom: 14,
      borderRadius: 24,
      background: `linear-gradient(180deg, ${button}10 0%, transparent 100%), ${mutedSurface}`,
      border: `1px solid ${softBorder}`,
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
    },
    qrGlyph: {
      width: 72,
      height: 72,
      borderRadius: 22,
      display: "grid",
      placeItems: "center",
      background: cardBg,
      color: button,
      fontSize: 48,
      fontWeight: 900,
      boxShadow: "0 16px 30px rgba(15, 23, 42, 0.09)",
    },
    cornerTopLeft: cornerStyle("top", "left", button),
    cornerTopRight: cornerStyle("top", "right", button),
    cornerBottomLeft: cornerStyle("bottom", "left", button),
    cornerBottomRight: cornerStyle("bottom", "right", button),
    scanButton: {
      width: "100%",
      minHeight: 58,
      padding: "15px 18px",
      borderRadius: 20,
      border: "none",
      background: `linear-gradient(135deg, ${button} 0%, #2563eb 100%)`,
      color: buttonText,
      fontWeight: 900,
      fontSize: 16,
      cursor: "pointer",
      WebkitTapHighlightColor: "transparent",
      boxShadow: `0 14px 28px ${button}38`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      letterSpacing: -0.1,
    },
    buttonIcon: {
      width: 24,
      height: 24,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      background: "rgba(255,255,255,0.18)",
      fontSize: 14,
    },
    buttonDisabled: {
      opacity: 0.56,
      cursor: "not-allowed",
      boxShadow: "none",
      filter: "grayscale(0.2)",
    },
    helperText: {
      margin: "12px auto 0",
      maxWidth: 340,
      fontSize: 12.5,
      lineHeight: 1.5,
      color: hint,
      textAlign: "center",
      fontWeight: 650,
    },
    notice: {
      padding: "13px 14px",
      borderRadius: 20,
      border: "1px solid #bfdbfe",
      background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
      color: "#1d4ed8",
      fontSize: 13,
      fontWeight: 800,
      lineHeight: 1.4,
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      boxShadow: "0 10px 22px rgba(37, 99, 235, 0.08)",
    },
    noticeIcon: {
      width: 22,
      height: 22,
      minWidth: 22,
      borderRadius: 999,
      display: "grid",
      placeItems: "center",
      background: "rgba(255,255,255,0.7)",
      fontSize: 12,
      fontWeight: 950,
      lineHeight: 1,
    },
    noticeSuccess: {
      border: "1px solid #bbf7d0",
      background: "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)",
      color: "#166534",
      boxShadow: "0 10px 22px rgba(22, 101, 52, 0.08)",
    },
    noticeError: {
      border: "1px solid #fecaca",
      background: "linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)",
      color: "#991b1b",
      boxShadow: "0 10px 22px rgba(153, 27, 27, 0.08)",
    },
    resultCard: {
      padding: 16,
      borderRadius: 28,
      border: `1px solid ${border}`,
      background: surface,
      boxShadow: "0 16px 38px rgba(15, 23, 42, 0.08)",
    },
    resultTop: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 15,
    },
    resultIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      display: "grid",
      placeItems: "center",
      background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
      color: "#166534",
      fontSize: 28,
      fontWeight: 950,
      flexShrink: 0,
      boxShadow: "0 12px 24px rgba(22, 101, 52, 0.12)",
    },
    resultIconMuted: {
      background: "linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)",
      color: "#1d4ed8",
      boxShadow: "0 12px 24px rgba(29, 78, 216, 0.12)",
    },
    resultTitle: {
      margin: "4px 0 0",
      fontSize: 20,
      fontWeight: 950,
      color: text,
      letterSpacing: -0.3,
    },
    resultGrid: {
      display: "grid",
      gap: 10,
    },
    infoRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "13px 14px",
      borderRadius: 18,
      background: mutedSurface,
      border: `1px solid ${softBorder}`,
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: 850,
      color: hint,
    },
    infoValue: {
      fontSize: 14.5,
      fontWeight: 900,
      color: text,
      textAlign: "right",
      wordBreak: "break-word",
    },
  } satisfies Record<string, React.CSSProperties>;
}

function cornerStyle(
  vertical: "top" | "bottom",
  horizontal: "left" | "right",
  color: string,
): React.CSSProperties {
  return {
    position: "absolute",
    [vertical]: 18,
    [horizontal]: 18,
    width: 26,
    height: 26,
    borderColor: color,
    borderStyle: "solid",
    borderWidth: `${vertical === "top" ? 3 : 0}px ${horizontal === "right" ? 3 : 0}px ${vertical === "bottom" ? 3 : 0}px ${horizontal === "left" ? 3 : 0}px`,
    borderRadius: 6,
    opacity: 0.9,
  };
}
