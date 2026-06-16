// src/features/telegram-miniapp/attendance/TelegramAttendanceScannerPage.tsx

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        closeScanQrPopup?: () => void;
        showScanQrPopup?: (
          params: { text?: string },
          callback?: (qrText: string) => boolean
        ) => void;
        HapticFeedback?: {
          notificationOccurred: (type: "success" | "error" | "warning") => void;
        };
      };
    };
  }
}

type ClockResult = {
  success: boolean;
  message: string;
  action?: "ClockIn" | "ClockOut";
  employeeName?: string;
  branchName?: string;
  attendanceTime?: string;
};

export default function TelegramAttendanceScannerPage() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData ?? "";

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Tap scan to clock in or clock out.");
  const [result, setResult] = useState<ClockResult | null>(null);

  const headers = useMemo(
    () => ({
      "X-Telegram-InitData": initData
    }),
    [initData]
  );

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, [tg]);

  async function submitQr(qrText: string) {
    if (!initData) {
      setMessage("This page must be opened from Telegram.");
      return;
    }

    if (!qrText?.trim()) {
      setMessage("Invalid QR code.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Processing attendance...");

      const res = await axios.post<ClockResult>(
        "/api/telegram/miniapp/attendance/scan",
        {
          initData,
          qrCode: qrText.trim()
        },
        { headers }
      );

      setResult(res.data);
      setMessage(res.data.message);

      tg?.HapticFeedback?.notificationOccurred("success");
    } catch (error) {
      console.error("Attendance scan failed:", error);

      const apiMessage = axios.isAxiosError(error)
        ? error.response?.data?.message ?? error.response?.data
        : null;

      setMessage(apiMessage ?? "Unable to process attendance QR.");
      tg?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setLoading(false);
    }
  }

  function scan() {
    if (!tg?.showScanQrPopup) {
      setMessage("QR scanner is available only inside Telegram mobile app.");
      return;
    }

    tg.showScanQrPopup(
      { text: "Scan your branch attendance QR code" },
      qrText => {
        void submitQr(qrText);
        return true;
      }
    );
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui", minHeight: "100vh" }}>
      <h2>Attendance Scanner</h2>

      <p>{message}</p>

      <button
        type="button"
        onClick={scan}
        disabled={loading}
        style={{
          width: "100%",
          padding: 16,
          borderRadius: 12,
          border: "none",
          fontWeight: 700,
          fontSize: 16
        }}
      >
        {loading ? "Processing..." : "📷 Scan Branch QR"}
      </button>

      {result && (
        <section style={{ marginTop: 20, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          <h3>{result.action === "ClockOut" ? "Clocked Out" : "Clocked In"}</h3>
          <p>{result.employeeName}</p>
          <p>{result.branchName}</p>
          <p>{result.attendanceTime}</p>
        </section>
      )}
    </main>
  );
}