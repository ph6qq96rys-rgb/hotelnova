import { useCallback, useMemo, useState } from "react";

import TelegramMiniAppShell from "./TelegramMiniAppShell";
import TelegramTabBar, { type TelegramTabKey } from "./TelegramTabBar";
import TelegramMiniAppContent from "./TelegramMiniAppContent";
import TelegramBrowserPreviewNotice from "./TelegramBrowserPreviewNotice";
import TelegramEmployeeLinkPage from "./TelegramEmployeeLinkPage";

import { useTelegramMiniAppSession } from "./useTelegramMiniAppSession";
import { getTelegramPageMeta } from "./telegramMiniAppMenu";

import "./telegram-miniapp-dashboard.css";

const DEFAULT_TAB: TelegramTabKey = "workspace";
const STORAGE_KEY = "hotelnova.telegram.activeTab";
const DIAGNOSTIC_BUILD = "diag-20260806-telegram-auth";

function readSavedTab(): TelegramTabKey {
  if (typeof window === "undefined") return DEFAULT_TAB;

  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (
    saved === "workspace" ||
    saved === "attendance" ||
    saved === "inventory" ||
    saved === "requests" ||
    saved === "approvals" ||
    saved === "profile"
  ) {
    return saved;
  }

  return DEFAULT_TAB;
}

export default function TelegramMiniAppDashboard() {
  const [activeTab, setActiveTab] = useState<TelegramTabKey>(readSavedTab);
  const { runtime, session, refresh, linkEmployee } = useTelegramMiniAppSession();

  const handleTabChange = useCallback((tab: TelegramTabKey) => {
    window.localStorage.setItem(STORAGE_KEY, tab);
    setActiveTab(tab);
  }, []);

  const pageMeta = useMemo(() => {
    if (session.state === "needs-link") {
      return {
        title: "Link Employee",
        subtitle: "Connect Telegram to your ERP profile.",
      };
    }

    if (session.state !== "ready") {
      return {
        title: "Telegram Mini App",
        subtitle: "Hotel Nova mobile workspace",
      };
    }

    return getTelegramPageMeta(activeTab);
  }, [activeTab, session.state]);

  return (
    <TelegramMiniAppShell
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      footer={
        session.state === "ready" ? (
          <TelegramTabBar activeTab={activeTab} onChange={handleTabChange} />
        ) : undefined
      }
    >
      <main className="tg-mini-page">
        {session.state === "browser-preview" && <TelegramBrowserPreviewNotice />}

        {session.state === "missing-init-data" && (
          <StateCard
            icon="Warning:"
            title="Telegram authentication data is missing"
            message={
              session.message ??
              "Please open this Mini App from the bot menu or Telegram WebApp button."
            }
            actionLabel="Try again"
            onAction={refresh}
            diagnostic={DIAGNOSTIC_BUILD}
          />
        )}

        {session.state === "loading" && (
          <StateCard
            icon=""
            title="Preparing workspace"
            message={session.message ?? "Please wait..."}
          />
        )}

        {session.state === "error" && (
          <StateCard
            icon=""
            title="Unable to open workspace"
            message={session.message}
            actionLabel="Try again"
            onAction={refresh}
            diagnostic={DIAGNOSTIC_BUILD}
          />
        )}

        {session.state === "needs-link" && (
          <TelegramEmployeeLinkPage auth={session.auth} onLink={linkEmployee} />
        )}

        {session.state === "ready" && (
          <TelegramMiniAppContent
            activeTab={activeTab}
            onOpenTab={handleTabChange}
            auth={session.auth}
            runtime={runtime}
          />
        )}
      </main>
    </TelegramMiniAppShell>
  );
}

function StateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  diagnostic,
}: {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  diagnostic?: string;
}) {
  return (
    <section className="tg-mini-empty">
      <div className="tg-mini-empty__icon">{icon}</div>
      <h2>{title}</h2>
      <p>{message}</p>

      {actionLabel && onAction ? (
        <button type="button" className="tg-mini-primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}

      {diagnostic ? (
        <small className="tg-mini-empty__diagnostic">{diagnostic}</small>
      ) : null}
    </section>
  );
}
