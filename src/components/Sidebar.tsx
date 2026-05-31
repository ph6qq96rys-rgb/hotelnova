import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAppRoutes } from "../routes/routeDefConfig";
import type { AppRoute } from "../routes/sales-cogsroute";
import { useAuth } from "../auth/AuthProvider";
import { useAppScope } from "../app/useAppScope";

// ── Types ─────────────────────────────────────────────────────────────────────

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

type NavRow = {
  id: string;
  section: string;
  path: string;
  label: string;
  icon?: ReactNode;
};

type NavGroup = {
  section: string;
  items: NavRow[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

type NavRoute = AppRoute & { nav: true; path: string; label: string };

function isNavRoute(r: AppRoute): r is NavRoute {
  return r.nav === true && typeof r.path === "string" && typeof r.label === "string";
}

function canSee(
  required: string[] | undefined,
  hasPermission: (p: string, companyId?: string | null, branchId?: string | null) => boolean,
  companyId?: string | null,
  branchId?: string | null
) {
  if (!required || required.length === 0) return true;
  return required.some((p) => hasPermission(p, companyId, branchId));
}

function collectNavRows(
  routes: AppRoute[],
  hasPermission: (p: string, companyId?: string | null, branchId?: string | null) => boolean,
  companyId: string | null | undefined,
  branchId: string | null | undefined,
  parentPath = ""
): NavRow[] {
  const result: NavRow[] = [];
  for (const r of routes) {
    const segment = r.path ?? "";
    const fullPath = segment.startsWith("/")
      ? segment
      : parentPath && segment
      ? `${parentPath}/${segment}`.replace(/\/+/g, "/")
      : (parentPath || segment);

    if (isNavRoute(r) && canSee(r.permissions, hasPermission, companyId, branchId)) {
      const section = r.section ?? "General";
      const path = normalizePath(fullPath || (r.path ?? ""));
      result.push({ id: `${section}::${path}`, section, path, label: r.label, icon: r.icon });
    }

    if (Array.isArray((r as any).children)) {
      result.push(...collectNavRows((r as any).children, hasPermission, companyId, branchId, fullPath));
    }
  }
  return result;
}

// ── Section group component ───────────────────────────────────────────────────

function NavSection({
  group,
  onClose,
  currentPath,
}: {
  group: NavGroup;
  onClose: () => void;
  currentPath: string;
}) {
  const [collapsed, setCollapsed] = useState(false);


  return (
    <div className="hnav-section">
      <button
        className="hnav-section-head"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="hnav-section-label">{group.section}</span>
        <span className={`hnav-chevron ${collapsed ? "hnav-chevron-up" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {!collapsed && (
        <div className="hnav-items">
          {group.items.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onClose}
              end={item.path === "/" || item.path === "/dashboard"}
              className={({ isActive }) =>
                `hnav-item${isActive ? " hnav-item-active" : ""}`
              }
            >
              {item.icon && (
                <span className="hnav-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="hnav-item-label">{item.label}</span>
              {(currentPath === item.path || currentPath.startsWith(item.path + "/")) &&
                currentPath !== "/" && (
                  <span className="hnav-item-dot" aria-hidden="true" />
                )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { hasPermission, isAuthenticated, user } = useAuth();
  const { companyId, branchId, companyName, branchName } = useAppScope();
  const appRoutes = useAppRoutes();
  const location = useLocation();

  const groups = useMemo((): NavGroup[] => {
    if (!isAuthenticated) return [];

    const rows = collectNavRows(appRoutes, hasPermission, companyId, branchId);

    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });

    const map = new Map<string, NavRow[]>();
    for (const row of deduped) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }

    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  }, [appRoutes, isAuthenticated, hasPermission, companyId, branchId]);

  const initials = useMemo(() => {
    const name = (user as any)?.name ?? (user as any)?.email ?? "";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join("");
  }, [user]);

  return (
    <>
      <style>{SIDEBAR_CSS}</style>

      {/* Overlay */}
      {open && <div className="hnav-overlay" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`hnav-root${open ? " hnav-open" : ""}`}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="hnav-brand">
          <div className="hnav-brand-mark">H</div>
          <div className="hnav-brand-text">
            <div className="hnav-brand-name">HotelNova</div>
            {companyName && (
              <div className="hnav-brand-company">{companyName}</div>
            )}
          </div>
          <button
            className="hnav-close-btn"
            onClick={onClose}
            aria-label="Close navigation"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="hnav-scroll" aria-label="Sidebar navigation">
          {groups.map((group) => (
            <NavSection
              key={group.section}
              group={group}
              onClose={onClose}
              currentPath={location.pathname}
            />
          ))}
        </nav>

        {/* User footer */}
        <div className="hnav-footer">
          <div className="hnav-user">
            <div className="hnav-avatar">{initials || "U"}</div>
            <div className="hnav-user-info">
              <div className="hnav-user-name">
                {(user as any)?.name ?? (user as any)?.email ?? "User"}
              </div>
              {branchName && (
                <div className="hnav-user-branch">{branchName}</div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Scoped CSS ────────────────────────────────────────────────────────────────

const SIDEBAR_CSS = `
  .hnav-overlay {
    position: fixed; inset: 0; z-index: 40;
    background: rgba(0,0,0,0.32);
    backdrop-filter: blur(2px);
    animation: hnav-fade-in 0.15s ease;
  }

  .hnav-root {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: 256px; z-index: 50;
    display: flex; flex-direction: column;
    background: var(--color-background-primary);
    border-right: 1px solid var(--color-border-tertiary);
    transform: translateX(-100%);
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  }

  .hnav-root.hnav-open { transform: translateX(0); }

  @media (min-width: 1024px) {
    .hnav-root { transform: translateX(0); position: sticky; top: 0; height: 100vh; }
    .hnav-overlay { display: none; }
    .hnav-close-btn { display: none; }
  }

  /* Brand */
  .hnav-brand {
    display: flex; align-items: center; gap: 10px;
    padding: 18px 16px 16px;
    border-bottom: 1px solid var(--color-border-tertiary);
    flex-shrink: 0;
  }

  .hnav-brand-mark {
    width: 32px; height: 32px; border-radius: 8px;
    background: #1a1a2e;
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 500; flex-shrink: 0;
    letter-spacing: -0.5px;
  }

  .hnav-brand-text { flex: 1; min-width: 0; }

  .hnav-brand-name {
    font-size: 14px; font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .hnav-brand-company {
    font-size: 11px; color: var(--color-text-tertiary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 1px;
  }

  .hnav-close-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: none; background: transparent; cursor: pointer;
    color: var(--color-text-secondary);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: background 0.12s;
  }
  .hnav-close-btn:hover { background: var(--color-background-secondary); }

  /* Scroll area */
  .hnav-scroll {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 8px 0 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border-tertiary) transparent;
  }
  .hnav-scroll::-webkit-scrollbar { width: 4px; }
  .hnav-scroll::-webkit-scrollbar-track { background: transparent; }
  .hnav-scroll::-webkit-scrollbar-thumb {
    background: var(--color-border-tertiary);
    border-radius: 4px;
  }

  /* Section */
  .hnav-section { margin-bottom: 4px; }

  .hnav-section-head {
    width: 100%; display: flex; align-items: center;
    justify-content: space-between;
    padding: 6px 16px 4px;
    background: none; border: none; cursor: pointer;
    color: var(--color-text-tertiary);
    transition: color 0.12s;
  }
  .hnav-section-head:hover { color: var(--color-text-secondary); }

  .hnav-section-label {
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase;
  }

  .hnav-chevron {
    display: flex; align-items: center;
    transition: transform 0.18s;
    color: var(--color-text-tertiary);
  }
  .hnav-chevron-up { transform: rotate(-180deg); }

  /* Items */
  .hnav-items { padding: 2px 8px 6px; }

  .hnav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 10px; border-radius: 7px;
    font-size: 13.5px; font-weight: 400;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: background 0.1s, color 0.1s;
    position: relative;
    white-space: nowrap; overflow: hidden;
  }
  .hnav-item:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
  }
  .hnav-item-active {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
    font-weight: 500;
  }
  .hnav-item-active::before {
    content: "";
    position: absolute; left: 0; top: 20%; bottom: 20%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: #1a1a2e;
  }

  .hnav-item-icon {
    display: flex; align-items: center; flex-shrink: 0;
    color: inherit; opacity: 0.7;
    width: 18px; height: 18px;
  }
  .hnav-item-active .hnav-item-icon { opacity: 1; }

  .hnav-item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

  .hnav-item-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #1a1a2e; flex-shrink: 0;
  }

  /* Footer */
  .hnav-footer {
    flex-shrink: 0;
    padding: 12px 16px;
    border-top: 1px solid var(--color-border-tertiary);
  }

  .hnav-user { display: flex; align-items: center; gap: 10px; }

  .hnav-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border-tertiary);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 500;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .hnav-user-info { flex: 1; min-width: 0; }

  .hnav-user-name {
    font-size: 12.5px; font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .hnav-user-branch {
    font-size: 11px; color: var(--color-text-tertiary);
    margin-top: 1px;
  }

  @keyframes hnav-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;