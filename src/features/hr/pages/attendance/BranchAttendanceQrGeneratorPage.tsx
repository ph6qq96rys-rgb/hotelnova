// src/features/hr/attendance/BranchAttendanceQrGeneratorPage.tsx

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "react-router-dom";

import { http } from "../../../../api/http";
import { useAppScope } from "../../../../app/useAppScope";
import { useErpNavigate } from "../../../../routes/useErpNavigation";

type AttendanceQrCodeType = "ClockIn" | "ClockOut" | "Both";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  timestampUtc?: string;
};

type AttendanceQrCodeDto = {
  id: string;
  code: string;
  type?: AttendanceQrCodeType;
  validFromUtc: string;
  validToUtc: string;
  isActive?: boolean;
  message?: string;
};

type CommandResult = {
  success: boolean;
  message?: string;
  id?: string;
  code?: string;
  validFromUtc?: string;
  validToUtc?: string;
};

type Notice = {
  kind: "info" | "success" | "error";
  text: string;
};

type Props = {
  companyId?: string;
  branchId?: string;
  branchName?: string;
  currentUserId?: string;
};

type RouteParams = {
  companyId?: string;
  branchId?: string;
};

type BranchContext = {
  companyId?: string;
  branchId?: string;
  branchName?: string;
};

const VALID_MINUTES_OPTIONS = [5, 10, 15, 30, 60, 120, 240, 480];
const QR_TYPES: AttendanceQrCodeType[] = ["Both", "ClockIn", "ClockOut"];

export default function BranchAttendanceQrGeneratorPage({
  companyId: propCompanyId,
  branchId: propBranchId,
  branchName,
  currentUserId,
}: Props = {}) {
  const params = useParams<RouteParams>();
  const scope = useAppScope();
  const erpNavigate = useErpNavigate();
  const storedContext = useMemo(() => readStoredBranchContext(), []);

  const companyId = useMemo(
    () =>
      normalizeId(propCompanyId) ||
      normalizeId(scope.companyId) ||
      normalizeId(params.companyId) ||
      normalizeId(storedContext.companyId),
    [params.companyId, propCompanyId, scope.companyId, storedContext.companyId]
  );

  const branchId = useMemo(
    () =>
      normalizeId(propBranchId) ||
      normalizeId(scope.branchId) ||
      normalizeId(params.branchId) ||
      normalizeId(storedContext.branchId),
    [params.branchId, propBranchId, scope.branchId, storedContext.branchId]
  );

  const resolvedBranchName = branchName ?? storedContext.branchName;

  const [type, setType] = useState<AttendanceQrCodeType>("Both");
  const [validMinutes, setValidMinutes] = useState(5);
  const [qr, setQr] = useState<AttendanceQrCodeDto | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>({
    kind: "info",
    text: "Generate a secure attendance QR code for this branch.",
  });

  const baseUrl = useMemo(() => {
    if (!companyId || !branchId) return "";
    return `/companies/${companyId}/branches/${branchId}/attendance/qr-codes`;
  }, [branchId, companyId]);

  const clearQrImage = useCallback(() => {
    setQrImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }, []);

  useEffect(() => clearQrImage, [clearQrImage]);

  const loadQrImage = useCallback(async () => {
    if (!baseUrl || !qr?.id) {
      clearQrImage();
      return;
    }

    const response = await http.get<Blob>(`${baseUrl}/current/image`, {
      params: { type, v: qr.id },
      responseType: "blob",
    });

    const objectUrl = URL.createObjectURL(response.data);

    setQrImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });
  }, [baseUrl, clearQrImage, qr?.id, type]);

  const loadCurrent = useCallback(async () => {
    if (!baseUrl) return;

    try {
      setLoading(true);

      const { data } = await http.get<ApiEnvelope<AttendanceQrCodeDto>>(
        `${baseUrl}/current`,
        { params: { type } }
      );

      if (data.success && data.data) {
        setQr(data.data);
        setNotice({ kind: "success", text: "Active branch QR code loaded." });
        return;
      }

      setQr(null);
      clearQrImage();
      setNotice({
        kind: "info",
        text: data.message ?? "No active QR code found.",
      });
    } catch (error) {
      setQr(null);
      clearQrImage();
      setNotice({
        kind: "info",
        text: getApiErrorMessage(error, "No active QR code found."),
      });
    } finally {
      setLoading(false);
    }
  }, [baseUrl, clearQrImage, type]);

  useEffect(() => {
    void loadCurrent();
  }, [loadCurrent]);

  useEffect(() => {
    void loadQrImage();
  }, [loadQrImage]);

  const generate = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!baseUrl) return;

      try {
        setLoading(true);
        setNotice({
          kind: "info",
          text: "Generating branch attendance QR code...",
        });

        const { data } = await http.post<ApiEnvelope<CommandResult>>(
          `${baseUrl}/generate`,
          {
            type,
            validMinutes,
            createdByUserId: currentUserId ?? null,
          }
        );

        if (!data.success || data.data?.success === false) {
          throw new Error(
            data.message ?? data.data?.message ?? "Failed to generate QR code."
          );
        }

        setNotice({
          kind: "success",
          text: data.data?.message ?? "Branch QR code generated.",
        });
        await loadCurrent();
      } catch (error) {
        setNotice({
          kind: "error",
          text: getApiErrorMessage(error, "Failed to generate QR code."),
        });
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, currentUserId, loadCurrent, type, validMinutes]
  );

  const rotate = useCallback(async () => {
    if (!baseUrl) return;

    try {
      setLoading(true);
      setNotice({
        kind: "info",
        text: "Rotating branch attendance QR code...",
      });

      const { data } = await http.post<ApiEnvelope<CommandResult>>(
        `${baseUrl}/rotate`,
        {
          type,
          validMinutes,
          rotatedByUserId: currentUserId ?? null,
        }
      );

      if (!data.success || data.data?.success === false) {
        throw new Error(
          data.message ?? data.data?.message ?? "Failed to rotate QR code."
        );
      }

      setNotice({
        kind: "success",
        text: data.data?.message ?? "Branch QR code rotated.",
      });
      await loadCurrent();
    } catch (error) {
      setNotice({
        kind: "error",
        text: getApiErrorMessage(error, "Failed to rotate QR code."),
      });
    } finally {
      setLoading(false);
    }
  }, [baseUrl, currentUserId, loadCurrent, type, validMinutes]);

  const deactivate = useCallback(async () => {
    if (!baseUrl || !qr?.id) return;

    const reason = window
      .prompt("Reason for deactivating this QR code?")
      ?.trim();

    if (!reason) return;

    try {
      setLoading(true);
      setNotice({
        kind: "info",
        text: "Deactivating branch attendance QR code...",
      });

      const { data } = await http.post<ApiEnvelope<CommandResult>>(
        `${baseUrl}/${qr.id}/deactivate`,
        {
          deactivatedByUserId: currentUserId ?? null,
          reason,
        }
      );

      if (!data.success || data.data?.success === false) {
        throw new Error(
          data.message ?? data.data?.message ?? "Failed to deactivate QR code."
        );
      }

      setQr(null);
      clearQrImage();
      setNotice({
        kind: "success",
        text: data.data?.message ?? "Branch QR code deactivated.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: getApiErrorMessage(error, "Failed to deactivate QR code."),
      });
    } finally {
      setLoading(false);
    }
  }, [baseUrl, clearQrImage, currentUserId, qr?.id]);

  const expiresIn = useMemo(
    () => getRelativeExpiry(qr?.validToUtc),
    [qr?.validToUtc]
  );

  if (!companyId || !branchId) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.cardTitle}>Branch QR Code Generator</h1>
          <div style={{ ...styles.notice, ...styles.noticeError }}>
            Missing company or branch scope. Select a company and branch before
            generating attendance QR codes.
          </div>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => erpNavigate("dashboard", { replace: true })}
          >
            Go to company dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>ERP Attendance</p>
          <h1 style={styles.title}>Branch QR Code Generator</h1>
          <p style={styles.subtitle}>
            {resolvedBranchName ? `${resolvedBranchName} · ` : ""}Generate,
            rotate, display, and deactivate secure attendance QR codes per
            branch.
          </p>
        </div>
      </header>

      <NoticeBox notice={notice} />

      <section style={styles.layout}>
        <form style={styles.card} onSubmit={generate}>
          <h2 style={styles.cardTitle}>QR settings</h2>

          <label style={styles.label}>
            QR action
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as AttendanceQrCodeType)
              }
              style={styles.input}
              disabled={loading}
            >
              {QR_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Valid for
            <select
              value={validMinutes}
              onChange={(event) => setValidMinutes(Number(event.target.value))}
              style={styles.input}
              disabled={loading}
            >
              {VALID_MINUTES_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? "Working..." : "Generate QR"}
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={rotate}
              disabled={loading}
            >
              Rotate
            </button>
            <button
              type="button"
              style={styles.dangerButton}
              onClick={deactivate}
              disabled={loading || !qr?.id}
            >
              Deactivate
            </button>
          </div>
        </form>

        <section style={styles.previewCard}>
          <div style={styles.previewHeader}>
            <div>
              <h2 style={styles.cardTitle}>Live branch QR</h2>
              <p style={styles.muted}>
                {qr ? expiresIn : "No active QR code selected."}
              </p>
            </div>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadCurrent}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {qr && qrImageUrl ? (
            <>
              <div style={styles.qrFrame}>
                <img
                  src={qrImageUrl}
                  alt="Current branch attendance QR code"
                  style={styles.qrImage}
                />
              </div>

              <dl style={styles.metaGrid}>
                <MetaItem label="QR Id" value={qr.id} />
                <MetaItem label="Code" value={qr.code} />
                <MetaItem label="Valid from" value={formatDateTime(qr.validFromUtc)} />
                <MetaItem label="Expires" value={formatDateTime(qr.validToUtc)} />
              </dl>
            </>
          ) : (
            <div style={styles.emptyState}>
              <strong>No active QR code</strong>
              <span>
                Generate a QR code to display it for employees at this branch.
              </span>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function normalizeId(value?: string | null): string {
  return value?.trim() ?? "";
}

function readStoredBranchContext(): BranchContext {
  if (typeof window === "undefined") return {};

  const candidates = [
    "attendanceBranchContext",
    "currentBranch",
    "selectedBranch",
    "branch",
  ];

  for (const key of candidates) {
    const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        companyId: stringFromUnknown(
          parsed.companyId ?? parsed.companyID ?? parsed.company_id ?? parsed.tenantCompanyId
        ),
        branchId: stringFromUnknown(parsed.branchId ?? parsed.branchID ?? parsed.branch_id ?? parsed.id),
        branchName: stringFromUnknown(parsed.branchName ?? parsed.name),
      };
    } catch {
      // Ignore malformed storage entries and keep checking other known keys.
    }
  }

  return {
    companyId: readQueryParam("companyId"),
    branchId: readQueryParam("branchId"),
  };
}

function readQueryParam(name: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(name)?.trim() || undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div
      role="status"
      style={{
        ...styles.notice,
        ...(notice.kind === "success" ? styles.noticeSuccess : null),
        ...(notice.kind === "error" ? styles.noticeError : null),
      }}
    >
      {notice.text}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metaItem}>
      <dt style={styles.metaLabel}>{label}</dt>
      <dd style={styles.metaValue}>{value || "-"}</dd>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !isAxiosErrorLike(error)) {
    return error.message || fallback;
  }

  if (!isAxiosErrorLike(error)) return fallback;

  const data = error.response?.data;

  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;

    const message = body.message ?? body.Message ?? body.error ?? body.Error;
    if (typeof message === "string" && message.trim()) return message;

    const errors = body.errors;
    if (errors && typeof errors === "object") {
      const firstError = Object.values(errors as Record<string, unknown>).flat()[0];
      if (typeof firstError === "string" && firstError.trim()) return firstError;
    }
  }

  return fallback;
}

function isAxiosErrorLike(
  error: unknown
): error is { response?: { data?: unknown } } {
  return Boolean(error && typeof error === "object" && "response" in error);
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function getRelativeExpiry(value?: string): string {
  if (!value) return "-";

  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return `Expires ${value}`;

  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return "Expired. Rotate or generate a new QR code.";

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) return `Expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`;

  const hours = Math.ceil(minutes / 60);
  return `Expires in ${hours} hour${hours === 1 ? "" : "s"}.`;
}

const styles = {
  page: {
    display: "grid",
    gap: 18,
    padding: 24,
    color: "#111827",
    background: "#f8fafc",
    minHeight: "100%",
    boxSizing: "border-box",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  header: {
    padding: 24,
    borderRadius: 24,
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#ffffff",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.18)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.68)",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 28,
    lineHeight: 1.1,
    fontWeight: 900,
  },
  subtitle: {
    margin: "10px 0 0",
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.78)",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 420px) 1fr",
    gap: 18,
    alignItems: "start",
  },
  card: {
    display: "grid",
    gap: 16,
    padding: 20,
    borderRadius: 22,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.07)",
  },
  previewCard: {
    display: "grid",
    gap: 18,
    padding: 20,
    borderRadius: 22,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.07)",
  },
  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
  },
  muted: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  label: {
    display: "grid",
    gap: 8,
    fontSize: 13,
    fontWeight: 900,
    color: "#334155",
  },
  input: {
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  primaryButton: {
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    minHeight: 44,
    gridColumn: "1 / -1",
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 900,
    cursor: "pointer",
  },
  qrFrame: {
    display: "grid",
    placeItems: "center",
    padding: 18,
    borderRadius: 24,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
  },
  qrImage: {
    width: "min(100%, 420px)",
    height: "auto",
    background: "#ffffff",
    borderRadius: 16,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    margin: 0,
  },
  metaItem: {
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    minWidth: 0,
  },
  metaLabel: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
  },
  metaValue: {
    margin: "5px 0 0",
    fontSize: 13,
    color: "#111827",
    fontWeight: 900,
    overflowWrap: "anywhere",
  },
  notice: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: 800,
  },
  noticeSuccess: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
  },
  noticeError: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
  },
  emptyState: {
    display: "grid",
    placeItems: "center",
    gap: 8,
    minHeight: 280,
    padding: 24,
    borderRadius: 22,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    textAlign: "center",
  },
} satisfies Record<string, React.CSSProperties>;
