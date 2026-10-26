import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2, Smartphone } from "lucide-react";

import { Button } from "../../components/ui/button";
import { useI18n, type LanguageCode } from "../../i18n";
import TelegramMiniAppShell from "./TelegramMiniAppShell";
import TelegramTabBar, { type TelegramTabKey } from "./TelegramTabBar";
import TelegramMiniAppContent from "./TelegramMiniAppContent";
import TelegramBrowserPreviewNotice from "./TelegramBrowserPreviewNotice";
import TelegramEmployeeLinkPage from "./TelegramEmployeeLinkPage";

import { useTelegramMiniAppSession } from "./useTelegramMiniAppSession";
import { getTelegramPageMeta } from "./telegramMiniAppMenu";
import { getTelegramSivApprovals } from "./telegramMiniAppApi";

import "./telegram-miniapp-dashboard.css";

const DEFAULT_TAB: TelegramTabKey = "workspace";
const STORAGE_KEY = "hotelnova.telegram.activeTab";
const LANGUAGE_STORAGE_KEY = "hotelnova.language";
const TABS: TelegramTabKey[] = ["workspace", "attendance", "inventory", "requests", "approvals", "profile"];

function normalizeTelegramLanguage(languageCode?: string): LanguageCode | null {
  const clean = languageCode?.trim().toLowerCase();
  if (!clean) return null;
  return clean === "am" || clean === "am-et" ? "am" : "en";
}

function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable inside some Telegram clients; the tab simply is not remembered.
  }
}

function readSavedTab(): TelegramTabKey {
  const saved = readStorage(STORAGE_KEY);
  return TABS.includes(saved as TelegramTabKey) ? (saved as TelegramTabKey) : DEFAULT_TAB;
}

export default function TelegramMiniAppDashboard() {
  const [activeTab, setActiveTab] = useState<TelegramTabKey>(readSavedTab);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const { runtime, session, refresh, linkEmployee } = useTelegramMiniAppSession();
  const { setLanguage } = useI18n();

  useEffect(() => {
    if (readStorage(LANGUAGE_STORAGE_KEY)) return;
    const telegramLanguage = normalizeTelegramLanguage(runtime.user?.language_code);
    if (telegramLanguage) void setLanguage(telegramLanguage);
  }, [runtime.user?.language_code, setLanguage]);

  const ready = session.state === "ready";
  const hasErpUser = ready && Boolean(session.auth.userId);

  // Approvals waiting for this employee; employees who are not approvers simply see no badge.
  useEffect(() => {
    if (!hasErpUser) return;
    const abort = new AbortController();
    getTelegramSivApprovals(abort.signal)
      .then((rows) => setPendingApprovals(rows.length))
      .catch(() => setPendingApprovals(0));
    return () => abort.abort();
  }, [hasErpUser]);

  const handleTabChange = useCallback((tab: TelegramTabKey) => {
    writeStorage(STORAGE_KEY, tab);
    setActiveTab(tab);
  }, []);

  const pageMeta = useMemo(() => {
    if (session.state === "needs-link") {
      return { title: "Link Employee", subtitle: "Connect Telegram to your employee profile.", isName: false };
    }
    if (session.state !== "ready") {
      return { title: "Telegram Mini App", subtitle: "Mobile workspace", isName: false };
    }
    const meta = getTelegramPageMeta(activeTab, session.auth.companyName);
    return { ...meta, isName: activeTab === "workspace" && Boolean(session.auth.companyName) };
  }, [activeTab, session]);

  return (
    <TelegramMiniAppShell
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      subtitleIsName={pageMeta.isName}
      footer={
        ready ? (
          <TelegramTabBar
            activeTab={activeTab}
            onChange={handleTabChange}
            badges={{ approvals: pendingApprovals }}
          />
        ) : undefined
      }
    >
      <div className="tg-mini-page">
        {session.state === "browser-preview" && <TelegramBrowserPreviewNotice />}

        {session.state === "missing-init-data" && (
          <StateCard
            icon={Smartphone}
            title="Open from Telegram"
            message={session.message ?? "Please open this Mini App from the bot menu or Telegram WebApp button."}
            actionLabel="Try again"
            onAction={refresh}
          />
        )}

        {session.state === "loading" && (
          <StateCard icon={Loader2} title="Preparing workspace" message={session.message ?? "Please wait..."} />
        )}

        {session.state === "error" && (
          <StateCard
            icon={AlertTriangle}
            title="Unable to open workspace"
            message={session.message}
            actionLabel="Try again"
            onAction={refresh}
          />
        )}

        {session.state === "needs-link" && <TelegramEmployeeLinkPage auth={session.auth} onLink={linkEmployee} />}

        {session.state === "ready" && (
          <TelegramMiniAppContent
            activeTab={activeTab}
            onOpenTab={handleTabChange}
            auth={session.auth}
            runtime={runtime}
            onApprovalsChanged={setPendingApprovals}
          />
        )}
      </div>
    </TelegramMiniAppShell>
  );
}

function StateCard({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { tx } = useI18n();

  return (
    <section className="tg-mini-empty" aria-live="polite">
      <div className="tg-mini-empty__icon" aria-hidden="true">
        <Icon size={28} />
      </div>
      <h2>{tx(title)}</h2>
      <p>{tx(message)}</p>

      {actionLabel && onAction ? (
        <Button type="button" onClick={onAction}>
          {tx(actionLabel)}
        </Button>
      ) : null}
    </section>
  );
}
