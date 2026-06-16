/**
 * Topbar.tsx
 *
 * Combines the shell-level toolbar (Topbar) and page-level header (PageHeader)
 * into one file. Removed from PageHeader:
 *   - <script src="http://localhost:8097"> (React DevTools injection — never
 *     commit this; it makes an external network request in production)
 *   - "-Tilahun" debug suffixes hardcoded into title/subtitle text
 */

import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";

// ── PageHeader ────────────────────────────────────────────────────────────────
// Used inside page components to render a consistent title + action row.

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Buttons, badges, or any controls placed to the right of the title. */
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="hna-page-header">
      <div className="hna-page-header__text">
        <h1 className="hna-page-header__title">{title}</h1>
        {subtitle && (
          <p className="hna-page-header__subtitle">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="hna-page-header__actions">{actions}</div>
      )}
    </div>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
// Shell-level toolbar: hamburger, page title, search, notifications, user pill.

type TopbarProps = {
  onOpenSidebar: () => void;
  title?: string;
  subtitle?: string;
};

export default function Topbar({
  onOpenSidebar,
  title = "Dashboard",
  subtitle = "Overview & quick actions",
}: TopbarProps) {
  const { user, logout } = useAuth();

  const displayName = (user as any)?.fullName || (user as any)?.name || user?.email || "Admin";
  const email       = user?.email || "";
  const initials    = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("");

  return (
    <>
      <style>{TOPBAR_CSS}</style>

      <header className="hna-topbar">
        {/* Left: hamburger + page title */}
        <div className="hna-topbar__left">
          <button
            type="button"
            className="hna-topbar__menu-btn"
            onClick={onOpenSidebar}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          <div className="hna-topbar__title">
            <span className="hna-topbar__title-main">{title}</span>
            {subtitle && (
              <span className="hna-topbar__title-sub">{subtitle}</span>
            )}
          </div>
        </div>

        {/* Centre: search */}
        <div className="hna-topbar__search">
          <SearchIcon />
          <input
            className="hna-topbar__search-input"
            placeholder="Search…"
            aria-label="Search"
          />
        </div>

        {/* Right: notifications + user */}
        <div className="hna-topbar__right">
          <button
            type="button"
            className="hna-topbar__icon-btn"
            aria-label="Notifications"
          >
            <BellIcon />
          </button>

          <div className="hna-topbar__user">
            <div className="hna-topbar__avatar" aria-hidden="true">
              {initials || "U"}
            </div>
            <div className="hna-topbar__user-info">
              <strong className="hna-topbar__user-name">{displayName}</strong>
              {email && (
                <span className="hna-topbar__user-email">{email}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="hna-topbar__logout-btn"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </header>
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18" height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function MenuIcon() {
  return (
    <SvgIcon>
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </SvgIcon>
  );
}

function SearchIcon() {
  return (
    <SvgIcon>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </SvgIcon>
  );
}

function BellIcon() {
  return (
    <SvgIcon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </SvgIcon>
  );
}

// ── Scoped CSS ────────────────────────────────────────────────────────────────

const TOPBAR_CSS = `
  /* ── Shell topbar ──────────────────────────────────────────────────────── */

  .hna-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 20px;
    background: var(--color-background-primary, #fff);
    border-bottom: 1px solid var(--color-border-tertiary, #e5e7eb);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  /* Left */
  .hna-topbar__left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .hna-topbar__menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-secondary, #6b7280);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }
  .hna-topbar__menu-btn:hover {
    background: var(--color-background-secondary, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  @media (min-width: 1024px) {
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

  /* Search */
  .hna-topbar__search {
    flex: 1;
    max-width: 360px;
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

  @media (max-width: 640px) {
    .hna-topbar__search { display: none; }
  }

  /* Right */
  .hna-topbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  }

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
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .hna-topbar__icon-btn:hover {
    background: var(--color-background-secondary, #f3f4f6);
    color: var(--color-text-primary, #111827);
  }

  .hna-topbar__user {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 4px 10px 4px 4px;
    border-radius: 8px;
    cursor: default;
    transition: background 0.12s;
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
    letter-spacing: -0.3px;
  }

  .hna-topbar__user-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .hna-topbar__user-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary, #111827);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  .hna-topbar__user-email {
    font-size: 11px;
    color: var(--color-text-tertiary, #9ca3af);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }

  @media (max-width: 768px) {
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

  /* ── PageHeader ─────────────────────────────────────────────────────────── */

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
    gap: 8px;
    flex-shrink: 0;
  }
`;