import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronsUpDown,
  Circle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";

import { useAuth } from "../auth/useAuth";
import { useAppContext } from "../app/AppContext";
import { useAppRoutes } from "../routes/routeDefConfig";
import type { AppRoute } from "../routes/sales-cogsroute";

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
  onSignOut?: () => void;
};

type SidebarRoute = AppRoute & {
  menu?: {
    label?: string;
    section?: string;
    order?: number;
  };
  getHref?: (companyId: string) => string;
  order?: number;
};

type SidebarItem = {
  key: string;
  label: string;
  section: string;
  to: string;
  order: number;
  icon?: React.ReactNode;
};

const SIDEBAR_COLLAPSED_KEY = "hotelnova.sidebar.collapsed.v1";
const SYSTEM_ADMIN_ROLES = ["SYSTEMADMIN", "SYSADMIN"];

const SECTION_ORDER = [
  "System",
  "Dashboard",
  "Sales",
  "Inventory",
  "Procurement",
  "Production",
  "Finance",
  "HR",
  "Security",
  "Reports",
  "Settings",
  "General",
];

function readCollapsedPreference(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

function isSystemAdminRole(role: string): boolean {
  return SYSTEM_ADMIN_ROLES.includes(role.trim().toUpperCase());
}

function isVisibleRoute(route: SidebarRoute): boolean {
  return Boolean(route.nav || route.menu);
}

function getRouteLabel(route: SidebarRoute): string {
  return (route.menu?.label ?? route.label ?? "").trim();
}

function getRouteSection(route: SidebarRoute): string {
  return (route.menu?.section ?? route.section ?? "General").trim() || "General";
}

function getRouteOrder(route: SidebarRoute): number {
  return route.menu?.order ?? route.order ?? 1000;
}

function normalizePath(path: string): string | null {
  const clean = path.trim();

  if (!clean) return null;

  return clean === "/" ? "/" : `/${clean.replace(/^\/+/, "")}`;
}

function resolveSidebarPath(
  route: SidebarRoute,
  companyId: string | null
): string | null {
  if (route.getHref) {
    if (!companyId) return null;
    return normalizePath(route.getHref(companyId));
  }

  if (!route.path) return null;

  let path = route.path.trim();

  if (!path) return null;

  path = path.replace(/^\/+/, "");

  if (path.startsWith("companies/:companyId/")) {
    if (!companyId) return null;
    path = path.replace("companies/:companyId/", `companies/${companyId}/`);
  } else if (path === "companies/:companyId") {
    if (!companyId) return null;
    path = `companies/${companyId}`;
  } else if (!path.startsWith("companies/") && companyId) {
    path = `companies/${companyId}/${path}`;
  }

  if (path.includes(":")) return null;

  return normalizePath(path);
}

function buildSidebarItems(
  routes: SidebarRoute[],
  companyId: string | null
): SidebarItem[] {
  const items = new Map<string, SidebarItem>();

  for (const route of routes) {
    if (!isVisibleRoute(route)) continue;

    const label = getRouteLabel(route);
    const section = getRouteSection(route);
    const to = resolveSidebarPath(route, companyId);

    if (!label || !to) continue;

    const key = `${section}:${to}`;

    if (!items.has(key)) {
      items.set(key, {
        key,
        label,
        section,
        to,
        order: getRouteOrder(route),
        icon: route.icon,
      });
    }
  }

  return [...items.values()].sort((a, b) => {
    const aSection = SECTION_ORDER.indexOf(a.section);
    const bSection = SECTION_ORDER.indexOf(b.section);

    const sectionSort =
      (aSection === -1 ? 999 : aSection) -
      (bSection === -1 ? 999 : bSection);

    if (sectionSort !== 0) return sectionSort;
    if (a.order !== b.order) return a.order - b.order;

    return a.label.localeCompare(b.label);
  });
}

function groupSidebarItems(items: SidebarItem[]): Record<string, SidebarItem[]> {
  return items.reduce<Record<string, SidebarItem[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});
}

function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "U";
}

export default function Sidebar({
  open = false,
  onClose,
  onSignOut,
}: SidebarProps) {
  const routes = useAppRoutes();
  const navigate = useNavigate();
  const auth = useAuth();
  const appScope = useAppContext();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    document.documentElement.style.setProperty(
      "--hnav-current-width",
      collapsed ? "84px" : "292px"
    );

    window.dispatchEvent(
      new CustomEvent("hotelnova:sidebar-resize", {
        detail: { collapsed },
      })
    );
  }, [collapsed]);

  const companyId = auth.companyId ?? appScope.companyId;

  const companyName =
    auth.auth?.companyName ??
    appScope.companyName ??
    "No company selected";

  const branchName =
    auth.auth?.branchName ??
    appScope.branchName ??
    "No branch selected";

  const userName =
    auth.user?.fullName ??
    auth.user?.email ??
    "Admin User";

  const isSystemAdmin =
    auth.isSystemAdmin ||
    auth.roles.some(isSystemAdminRole);

  const dashboardPath = companyId
    ? `/companies/${companyId}/dashboard`
    : isSystemAdmin
      ? "/platform/tenants"
      : "/login";

  const groupedRoutes = useMemo(() => {
    const items = buildSidebarItems(routes as SidebarRoute[], companyId);

    if (isSystemAdmin) {
      items.unshift({
        key: "System:/platform/tenants",
        label: "Tenant Workspaces",
        section: "System",
        to: "/platform/tenants",
        order: 0,
        icon: <Building2 size={16} strokeWidth={2} />,
      });

      items.unshift({
        key: "System:/system-admin/companies",
        label: "Companies",
        section: "System",
        to: "/system-admin/companies",
        order: 1,
        icon: <ShieldCheck size={16} strokeWidth={2} />,
      });
    }

    return groupSidebarItems(items);
  }, [routes, companyId, isSystemAdmin]);

  const sectionEntries = Object.entries(groupedRoutes);
  const initials = getInitials(userName);

  function toggleSection(section: string) {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function toggleSidebar() {
    setCollapsed((value) => !value);
    setUserMenuOpen(false);
  }

  function handleNavigate(to: string) {
    setUserMenuOpen(false);
    onClose?.();
    navigate(to);
  }

  function handleSignOut() {
    setUserMenuOpen(false);

    if (onSignOut) {
      onSignOut();
      return;
    }

    auth.logout();
  }

  return (
    <>
      <style>{SIDEBAR_CSS}</style>

      {open && (
        <button
          type="button"
          className="hnav-overlay"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`hnav-root${open ? " hnav-open" : ""}${collapsed ? " hnav-collapsed" : ""}`}
        aria-label="Main navigation"
      >
        <div className="hnav-brand">
          <button
            type="button"
            className="hnav-brand-lockup"
            onClick={() => handleNavigate(dashboardPath)}
            aria-label="Go to dashboard"
            title="Go to dashboard"
          >
            <div className="hnav-brand-mark" aria-hidden="true">
              HN
            </div>

            <div className="hnav-brand-text">
              <span className="hnav-brand-name">HotelNova</span>
              <span className="hnav-brand-env">ERP Console</span>
            </div>
          </button>

          <div className="hnav-brand-actions">
            <button
              type="button"
              className="hnav-icon-btn hnav-collapse-btn"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen size={15} strokeWidth={2} />
              ) : (
                <PanelLeftClose size={15} strokeWidth={2} />
              )}
            </button>

            <button
              type="button"
              className="hnav-icon-btn hnav-close-btn"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="hnav-scope-card" aria-label="Current company scope">
          <div className="hnav-scope-icon" aria-hidden="true">
            <Building2 size={15} strokeWidth={2.2} />
          </div>

          <div className="hnav-scope-meta">
            <span className="hnav-scope-label">
              {isSystemAdmin && !companyId ? "Platform mode" : "Active company"}
            </span>
            <span className="hnav-scope-name">{companyName}</span>
            <span className="hnav-scope-branch">
              {isSystemAdmin && !companyId ? "System Administrator" : branchName}
            </span>
          </div>
        </div>

        <nav className="hnav-scroll" aria-label="Sidebar navigation">
          {sectionEntries.length === 0 ? (
            <div className="hnav-empty">
              {companyId
                ? "No modules are available for your role."
                : "Select a company to load ERP modules."}
            </div>
          ) : (
            sectionEntries.map(([section, items]) => {
              const collapsedSection = Boolean(collapsedSections[section]);

              return (
                <section className="hnav-section" key={section}>
                  <button
                    type="button"
                    className="hnav-section-head"
                    onClick={() => toggleSection(section)}
                    aria-expanded={!collapsedSection}
                    title={section}
                  >
                    <span className="hnav-section-label">{section}</span>
                    <span className={`hnav-chevron${collapsedSection ? "" : " hnav-chevron-up"}`}>
                      <ChevronDown size={12} strokeWidth={2.5} />
                    </span>
                  </button>

                  {!collapsedSection && (
                    <ul className="hnav-items" role="list">
                      {items.map((item) => (
                        <li key={item.key} role="listitem">
                          <NavLink
                            to={item.to}
                            end={item.to === dashboardPath}
                            onClick={onClose}
                            title={collapsed ? item.label : undefined}
                            className={({ isActive }) =>
                              `hnav-item${isActive ? " hnav-item-active" : ""}`
                            }
                          >
                            <span className="hnav-item-icon" aria-hidden="true">
                              {item.icon ?? <Circle size={7} strokeWidth={3} />}
                            </span>

                            <span className="hnav-item-label">{item.label}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </nav>

        <div className="hnav-footer">
          <div className="hnav-divider" />

          <div className="hnav-user-row">
            <div className="hnav-avatar" aria-hidden="true">
              {initials}
            </div>

            <div className="hnav-user-meta">
              <span className="hnav-user-name">{userName}</span>
              <span className="hnav-user-branch">
                {isSystemAdmin ? "System Administrator" : branchName}
              </span>
            </div>

            <button
              type="button"
              className="hnav-icon-btn hnav-user-toggle"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((value) => !value)}
            >
              <ChevronsUpDown size={13} strokeWidth={2} />
            </button>
          </div>

          {userMenuOpen && (
            <ul className="hnav-user-menu" role="menu">
              <li role="none">
                <button
                  type="button"
                  className="hnav-user-menu-item"
                  role="menuitem"
                  onClick={() => handleNavigate("/settings/account")}
                >
                  <Settings size={13} strokeWidth={2} aria-hidden="true" />
                  Account settings
                </button>
              </li>

              {isSystemAdmin && (
                <li role="none">
                  <button
                    type="button"
                    className="hnav-user-menu-item"
                    role="menuitem"
                    onClick={() => handleNavigate("/system-admin/companies")}
                  >
                    <ShieldCheck size={13} strokeWidth={2} aria-hidden="true" />
                    System console
                  </button>
                </li>
              )}

              <li role="none">
                <button
                  type="button"
                  className="hnav-user-menu-item hnav-user-menu-danger"
                  role="menuitem"
                  onClick={handleSignOut}
                >
                  <LogOut size={13} strokeWidth={2} aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

const SIDEBAR_CSS = `
:root {
  --hnav-width: 292px;
  --hnav-collapsed-width: 84px;
  --hnav-current-width: var(--hnav-width);
  --hnav-bg: #0f172a;
  --hnav-bg-2: #111827;
  --hnav-border: rgba(148, 163, 184, 0.18);
  --hnav-text: #e5e7eb;
  --hnav-muted: #94a3b8;
  --hnav-soft: rgba(148, 163, 184, 0.1);
  --hnav-hover: rgba(255, 255, 255, 0.075);
  --hnav-active: rgba(59, 130, 246, 0.18);
  --hnav-active-border: #60a5fa;
  --hnav-danger: #fca5a5;
  --hnav-shadow: 0 28px 70px rgba(15, 23, 42, 0.34);
}

.hnav-root {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 45;
  display: flex;
  width: var(--hnav-width);
  height: 100dvh;
  flex-direction: column;
  border-right: 1px solid var(--hnav-border);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 34%),
    linear-gradient(180deg, var(--hnav-bg), var(--hnav-bg-2));
  color: var(--hnav-text);
  box-shadow: var(--hnav-shadow);
  transition: width 180ms ease, transform 180ms ease;
}

.hnav-root.hnav-collapsed {
  width: var(--hnav-collapsed-width);
}

.hnav-overlay {
  position: fixed;
  inset: 0;
  z-index: 44;
  border: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
}

.hnav-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 76px;
  padding: 18px 18px 14px;
}

.hnav-brand-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hnav-brand-lockup {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.hnav-brand-mark {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.95), rgba(37, 99, 235, 0.72));
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.hnav-brand-text,
.hnav-scope-meta,
.hnav-user-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.hnav-brand-name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.hnav-brand-env,
.hnav-scope-label,
.hnav-user-branch {
  color: var(--hnav-muted);
  font-size: 11px;
  font-weight: 600;
}

.hnav-icon-btn {
  display: inline-grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--hnav-muted);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}

.hnav-icon-btn:hover {
  border-color: var(--hnav-border);
  background: var(--hnav-hover);
  color: var(--hnav-text);
}

.hnav-close-btn {
  display: none;
}

.hnav-scope-card {
  display: flex;
  gap: 11px;
  margin: 0 14px 12px;
  padding: 12px;
  border: 1px solid var(--hnav-border);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.48);
}

.hnav-scope-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 11px;
  background: rgba(96, 165, 250, 0.14);
  color: #bfdbfe;
}

.hnav-scope-name,
.hnav-scope-branch,
.hnav-user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hnav-scope-name {
  margin-top: 2px;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 750;
}

.hnav-scope-branch {
  margin-top: 1px;
  color: var(--hnav-muted);
  font-size: 12px;
}

.hnav-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 10px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
}

.hnav-empty {
  margin: 12px 6px;
  padding: 14px;
  border: 1px dashed var(--hnav-border);
  border-radius: 14px;
  color: var(--hnav-muted);
  font-size: 13px;
  line-height: 1.45;
}

.hnav-section {
  margin-top: 8px;
}

.hnav-section-head {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 8px 8px;
  border: 0;
  background: transparent;
  color: var(--hnav-muted);
  cursor: pointer;
}

.hnav-section-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hnav-chevron {
  display: inline-grid;
  place-items: center;
  transition: transform 140ms ease;
}

.hnav-chevron-up {
  transform: rotate(180deg);
}

.hnav-items {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hnav-item {
  position: relative;
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #cbd5e1;
  text-decoration: none;
  transition:
    background 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.hnav-item:hover {
  border-color: rgba(148, 163, 184, 0.12);
  background: var(--hnav-hover);
  color: #fff;
}

.hnav-item-active {
  border-color: rgba(96, 165, 250, 0.26);
  background: var(--hnav-active);
  color: #fff;
}

.hnav-item-active::before {
  position: absolute;
  left: -10px;
  width: 3px;
  height: 22px;
  border-radius: 999px;
  background: var(--hnav-active-border);
  content: "";
}

.hnav-item-icon {
  display: inline-grid;
  width: 20px;
  flex: 0 0 20px;
  place-items: center;
  color: currentColor;
  opacity: 0.92;
}

.hnav-item-label {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hnav-footer {
  position: relative;
  padding: 0 14px 16px;
}

.hnav-divider {
  height: 1px;
  margin-bottom: 12px;
  background: var(--hnav-border);
}

.hnav-user-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px;
  border: 1px solid var(--hnav-border);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.52);
}

.hnav-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.hnav-user-meta {
  flex: 1;
}

.hnav-user-name {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 750;
}

.hnav-user-menu {
  position: absolute;
  right: 14px;
  bottom: 78px;
  left: 14px;
  z-index: 2;
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--hnav-border);
  border-radius: 16px;
  background: #111827;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
  list-style: none;
}

.hnav-user-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #dbeafe;
  font-size: 13px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}

.hnav-user-menu-item:hover {
  background: var(--hnav-hover);
  color: #fff;
}

.hnav-user-menu-danger {
  color: var(--hnav-danger);
}

.hnav-root.hnav-collapsed .hnav-brand {
  justify-content: center;
  padding-inline: 12px;
}

.hnav-root.hnav-collapsed .hnav-brand-lockup {
  justify-content: center;
}

.hnav-root.hnav-collapsed .hnav-brand-text,
.hnav-root.hnav-collapsed .hnav-scope-meta,
.hnav-root.hnav-collapsed .hnav-section-label,
.hnav-root.hnav-collapsed .hnav-chevron,
.hnav-root.hnav-collapsed .hnav-item-label,
.hnav-root.hnav-collapsed .hnav-user-meta,
.hnav-root.hnav-collapsed .hnav-user-toggle {
  display: none;
}

.hnav-root.hnav-collapsed .hnav-brand-actions {
  flex-direction: column;
  gap: 4px;
}

.hnav-root.hnav-collapsed .hnav-scope-card {
  justify-content: center;
  margin-inline: 10px;
  padding: 10px;
}

.hnav-root.hnav-collapsed .hnav-scroll {
  padding-inline: 10px;
}

.hnav-root.hnav-collapsed .hnav-section-head {
  justify-content: center;
  padding: 8px;
}

.hnav-root.hnav-collapsed .hnav-items {
  gap: 6px;
}

.hnav-root.hnav-collapsed .hnav-item {
  justify-content: center;
  padding: 10px;
}

.hnav-root.hnav-collapsed .hnav-item-icon {
  width: 22px;
  flex: 0 0 22px;
}

.hnav-root.hnav-collapsed .hnav-footer {
  padding-inline: 10px;
}

.hnav-root.hnav-collapsed .hnav-user-row {
  justify-content: center;
  padding: 10px;
}

.hnav-root.hnav-collapsed .hnav-user-menu {
  left: 84px;
  right: auto;
  bottom: 16px;
  width: 220px;
}

@media (max-width: 1024px) {
  .hnav-root {
    transform: translateX(-105%);
    transition: transform 180ms ease;
  }

  .hnav-root.hnav-open {
    transform: translateX(0);
  }

  .hnav-close-btn {
    display: inline-grid;
  }

  .hnav-collapse-btn {
    display: none;
  }
}

@media (min-width: 1025px) {
  .hnav-overlay {
    display: none;
  }
}
`;