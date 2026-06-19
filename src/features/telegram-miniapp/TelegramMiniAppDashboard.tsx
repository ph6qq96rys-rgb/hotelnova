// src/features/telegram-miniapp/TelegramMiniAppDashboard.tsx

import { useEffect, useState } from "react";
import TelegramAttendanceScannerPage from "./attendance/TelegramAttendanceScannerPage";
import TelegramSivRequestPage from "./siv-request/TelegramSivRequestPage";
import TelegramMiniAppShell from "./shared/TelegramMiniAppShell";
import TelegramTabBar, { type TelegramTabKey } from "./shared/TelegramTabBar";
import { getTelegramInitData, initializeTelegramMiniApp } from "./telegramWebApp";

export default function TelegramMiniAppDashboard() {
  const [activeTab, setActiveTab] = useState<TelegramTabKey>("home");
  const initData = getTelegramInitData();
  const isTelegram = Boolean(initData);

  useEffect(() => {
    initializeTelegramMiniApp();
  }, []);

  return (
    <TelegramMiniAppShell
      title={getTitle(activeTab)}
      subtitle={getSubtitle(activeTab)}
      footer={<TelegramTabBar activeTab={activeTab} onChange={setActiveTab} />}
    >
      {!isTelegram && (
        <div style={{ padding: 12, marginBottom: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          Browser preview mode. Telegram-only features may not work until opened inside Telegram.
        </div>
      )}

      {activeTab === "home" && <HomeDashboard onOpenTab={setActiveTab} />}
      {activeTab === "attendance" && <TelegramAttendanceScannerPage />}
      {activeTab === "siv" && <TelegramSivRequestPage />}
      {activeTab === "inventory" && <ComingSoon title="Inventory lookup" />}
      {activeTab === "requests" && <ComingSoon title="My requests" />}
      {activeTab === "profile" && <ComingSoon title="My profile" />}
    </TelegramMiniAppShell>
  );
}

function HomeDashboard({ onOpenTab }: { onOpenTab: (tab: TelegramTabKey) => void }) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <button type="button" onClick={() => onOpenTab("attendance")}>📷 Attendance Scanner</button>
      <button type="button" onClick={() => onOpenTab("siv")}>📝 Store Request</button>
      <button type="button" onClick={() => onOpenTab("inventory")}>📦 Inventory</button>
      <button type="button" onClick={() => onOpenTab("profile")}>👤 My Profile</button>
    </section>
  );
}

function ComingSoon({ title }: { title: string }) {
  return <div>{title} will be available here.</div>;
}

function getTitle(tab: TelegramTabKey) {
  switch (tab) {
    case "attendance": return "Attendance";
    case "siv": return "Store Request";
    case "inventory": return "Inventory";
    case "requests": return "My Requests";
    case "profile": return "My Profile";
    default: return "RestaurantFNB Mini App";
  }
}

function getSubtitle(tab: TelegramTabKey) {
  switch (tab) {
    case "attendance": return "Scan your branch QR code.";
    case "siv": return "Request stock from your location.";
    case "inventory": return "View available stock.";
    case "requests": return "Track submitted requests.";
    case "profile": return "View your employee profile.";
    default: return "Select what you want to do.";
  }
}