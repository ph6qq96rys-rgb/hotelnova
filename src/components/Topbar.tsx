import type { ReactNode } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/AuthProvider";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="hna-page-header">
      <div className="hna-page-header__text">
        <h1 className="hna-page-header__title">{title}</h1>
        {subtitle && <p className="hna-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="hna-page-header__actions">{actions}</div>}
    </div>
  );
}

type TopbarProps = {
  onOpenSidebar: () => void;
  sidebarOpen?: boolean;
  title?: string;
  subtitle?: string;
};

export default function Topbar({
  onOpenSidebar,
  sidebarOpen = false,
  title,
  subtitle,
}: TopbarProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const resolvedTitle = title ?? t("common.dashboard");
  const resolvedSubtitle = subtitle ?? t("app.workspace");

  const displayName =
    (user as any)?.fullName || (user as any)?.name || user?.email || "Admin";
  const email = user?.email || "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word: string) => word[0].toUpperCase())
    .join("");

  return (
    <>
      <style>{TOPBAR_CSS}</style>

      <header className="hna-topbar">
        <div className="hna-topbar__left">
          <button
            type="button"
            className="hna-topbar__menu-btn"
            onPointerDown={onOpenSidebar}
            onTouchStart={onOpenSidebar}
            onClick={onOpenSidebar}
            aria-label={t("common.openMenu")}
            aria-expanded={sidebarOpen}
          >
            <Menu size={18} strokeWidth={2} aria-hidden="true" />
          </button>

          <div className="hna-topbar__title">
            <span className="hna-topbar__title-main">{resolvedTitle}</span>
            {resolvedSubtitle && <span className="hna-topbar__title-sub">{resolvedSubtitle}</span>}
          </div>
        </div>

        <div className="hna-topbar__search">
          <Search size={18} strokeWidth={2} aria-hidden="true" />
          <input
            className="hna-topbar__search-input"
            placeholder={t("common.search")}
            aria-label={t("common.search")}
          />
        </div>

        <div className="hna-topbar__right">
          <button
            type="button"
            className="hna-topbar__icon-btn"
            aria-label={t("common.notifications")}
          >
            <Bell size={18} strokeWidth={2} aria-hidden="true" />
          </button>

          <ScopeSwitcher />

          <div className="hna-topbar__user">
            <div className="hna-topbar__avatar" aria-hidden="true">
              {initials || "U"}
            </div>
            <div className="hna-topbar__user-info">
              <strong className="hna-topbar__user-name">{displayName}</strong>
              {email && <span className="hna-topbar__user-email">{email}</span>}
            </div>
          </div>

          <LanguageSelector compact />

          <button
            type="button"
            className="hna-topbar__logout-btn"
            onClick={logout}
          >
            {t("common.signOut")}
          </button>
        </div>
      </header>
    </>
  );
}

const TOPBAR_CSS = `
  .hna-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    height: 56px;
    padding: 0 20px;
    background: var(--color-background-primary, #fff);
    border-bottom: 1px solid var(--color-border-tertiary, #e5e7eb);
    position: sticky;
    top: 0;
    z-index: 1200;
  }

  .hna-topbar__left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .hna-topbar__menu-btn,
  .hna-topbar__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-secondary, #6b7280);
    touch-action: manipulation;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .hna-topbar__menu-btn:hover,
  .hna-topbar__icon-btn:hover {
    background: var(--color-background-secondary, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  @media (min-width: 1025px) {
    .hna-topbar__menu-btn { display: none; }
  }

  .hna-topbar__title {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .hna-topbar__title-main {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .hna-topbar__title-sub {
    font-size: 11.5px;
    color: var(--color-text-tertiary, #9ca3af);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .hna-topbar__search {
    flex: 1 1 220px;
    max-width: 360px;
    min-width: 180px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 34px;
    background: var(--color-background-secondary, #f3f4f6);
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--color-text-tertiary, #9ca3af);
    transition: border-color 0.15s, background 0.15s;
  }

  .hna-topbar__search:focus-within {
    background: var(--color-background-primary, #fff);
    border-color: var(--color-border-secondary, #d1d5db);
    color: var(--color-text-secondary, #6b7280);
  }

  .hna-topbar__search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--color-text-primary, #111827);
    min-width: 0;
  }

  .hna-topbar__search-input::placeholder {
    color: var(--color-text-tertiary, #9ca3af);
  }

  @media (max-width: 920px) {
    .hna-topbar__search { max-width: 260px; }
  }

  @media (max-width: 640px) {
    .hna-topbar__search { display: none; }
  }

  .hna-topbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
    min-width: 0;
  }

  .hna-scope {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 150px;
    max-width: 260px;
    height: 38px;
    padding: 4px 10px;
    border: 1px solid var(--color-border-tertiary, #e5e7eb);
    border-radius: 8px;
    color: var(--color-text-secondary, #6b7280);
    background: var(--color-background-primary, #fff);
  }

  .hna-scope__text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .hna-scope__company,
  .hna-scope__branch {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hna-scope__company {
    font-size: 10.5px;
    line-height: 1.1;
    color: var(--color-text-tertiary, #9ca3af);
  }

  .hna-scope__branch {
    font-size: 12px;
    line-height: 1.2;
    color: var(--color-text-primary, #111827);
  }

  .hna-scope__select {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    padding: 0;
    background: transparent;
    color: var(--color-text-primary, #111827);
    font: inherit;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
  }

  .hna-scope__select:disabled {
    color: var(--color-text-tertiary, #9ca3af);
    cursor: default;
  }

  .hna-topbar__user {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 4px 10px 4px 4px;
    border-radius: 8px;
    cursor: default;
    transition: background 0.12s;
    min-width: 0;
  }

  .hna-topbar__user:hover {
    background: var(--color-background-secondary, #f3f4f6);
  }

  .hna-topbar__avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #1a1a2e;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
    letter-spacing: 0;
  }

  .hna-topbar__user-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .hna-topbar__user-name,
  .hna-topbar__user-email {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .hna-topbar__user-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary, #111827);
  }

  .hna-topbar__user-email {
    font-size: 11px;
    color: var(--color-text-tertiary, #9ca3af);
  }

  @media (max-width: 768px) {
    .hna-scope {
      min-width: 120px;
      max-width: 180px;
      padding-inline: 8px;
    }

    .hna-topbar__user { padding-right: 4px; }
    .hna-topbar__user-info { display: none; }
  }
  .hna-topbar__logout-btn {
    padding: 0 12px;
    height: 32px;
    border: 1px solid var(--color-border-tertiary, #e5e7eb);
    border-radius: 7px;
    background: transparent;
    color: var(--color-text-secondary, #6b7280);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .hna-topbar__logout-btn:hover {
    background: var(--color-background-secondary, #f3f4f6);
    color: var(--color-text-primary, #111827);
    border-color: var(--color-border-secondary, #d1d5db);
  }

  .hna-page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }

  .hna-page-header__text {
    min-width: 0;
  }

  .hna-page-header__title {
    font-size: 22px;
    font-weight: 600;
    color: var(--color-text-primary, #111827);
    line-height: 1.25;
    margin: 0;
  }

  .hna-page-header__subtitle {
    margin: 4px 0 0;
    font-size: 13.5px;
    color: var(--color-text-tertiary, #9ca3af);
    line-height: 1.4;
  }

  .hna-page-header__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    min-width: 0;
  }

  @media (max-width: 680px) {
    .hna-topbar {
      gap: 8px;
      padding-inline: 12px;
      height: 60px;
      box-shadow: 0 8px 22px rgba(28, 26, 23, 0.06);
    }

    .hna-topbar__menu-btn {
      width: 44px;
      height: 44px;
      background: var(--color-background-secondary, #f3f4f6);
      color: var(--color-text-primary, #111827);
    }

    .hna-topbar__left {
      gap: 10px;
    }

    .hna-topbar__title {
      flex: 1;
    }

    .hna-topbar__title-main {
      font-size: 15px;
      max-width: calc(100vw - 160px);
    }

    .hna-topbar__title-sub,
    .hn-language svg,
  .hna-topbar__logout-btn {
      display: none;
    }

    .hna-topbar__right { gap: 4px; }

    .hna-scope {
      max-width: 44px;
      min-width: 44px;
      justify-content: center;
      padding: 0;
    }

    .hna-scope__text {
      display: none;
    }

    .hna-page-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .hna-page-header__actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 420px) {
    .hna-topbar {
      padding-inline: 12px;
    }

    .hna-topbar__icon-btn {
      display: none;
    }

    .hna-topbar__user {
      padding: 0;
    }
  }
`;
