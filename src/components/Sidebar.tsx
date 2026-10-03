import { cateringNavigation, isCateringNavigationActive } from "../features/eventmanagment/components/cateringNavigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
import { branchesApi } from "../features/company/api/branchesApi";
import {
  canAccessRoute as canAccessErpRoute,
  hasCompanyAdminRole,
  hasSystemAdminRole,
  normalizePermission,
} from "../auth/erpAccess";
import { useAppContext } from "../app/AppContext";
import { useAppScope } from "../app/useAppScope";
import { useAppRoutes } from "../routes/routeDefConfig";
import { useI18n, type TranslationKey } from "../i18n";
import type { AppRoute } from "../routes/routeConfig";

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
  icon?: ReactNode;
  children?: SidebarItem[];
};

type BranchOption = {
  id: string;
  name: string;
};

const SIDEBAR_COLLAPSED_KEY = "hotelnova.sidebar.collapsed.v1";


const NAV_LABEL_KEYS: Record<string, TranslationKey> = {
  "Dashboard": "nav.dashboardItem",
  "Company Settings": "nav.companySettings",
  "Sales Dashboard": "nav.salesDashboard",
  "POS": "nav.pos",
  "POS Operations": "nav.posOperations",
  "POS Session": "nav.posSession",
  "Items": "nav.inventoryItems",
  "Inventory Ledger": "nav.inventoryLedger",
  "Inventory Control Settings": "nav.inventoryControlSettings",
  "Stock Transfers": "nav.stockTransfers",
  "Adjustments": "nav.adjustments",
  "Goods Receipts": "nav.goodsReceipts",
  "Stock Issue Vouchers": "nav.stockIssueVouchers",
  "Purchase Requisitions": "nav.purchaseRequisitions",
  "Menu Categories": "nav.menuCategories",
  "Create Menu Item": "nav.createMenuItem",
  "Create New Menu": "nav.createMenuItem",
  "Recipe Management": "nav.recipeManagement",
  "Production Batches": "nav.productionBatches",
  "Menu Engineering": "nav.menuEngineering",
  "Menu Items": "nav.menuItems",
  "Employees": "nav.employees",
  "Payroll": "nav.payroll",
  "Leave": "nav.leave",
  "Attendance": "nav.attendance",
  "Users": "nav.users",
  "Roles & Permissions": "nav.rolesPermissions",
  "Event Management": "nav.eventManagement",
};

const NAV_SECTION_KEYS: Record<string, TranslationKey> = {
  "System": "nav.system",
  "Dashboard": "nav.dashboard",
  "General": "nav.general",
  "Setup": "nav.setup",
  "Administration": "nav.administration",
  "Security": "nav.security",
  "Sales": "nav.sales",
  "Inventory": "nav.inventory",
  "Procurement": "nav.procurement",
  "Production": "nav.production",
  "Finance": "nav.finance",
  "Human Resources": "nav.humanResources",
  "HR": "nav.hr",
  "Operations": "nav.operations",
  "Events": "nav.events",
  "Reports": "nav.reports",
  "Telegram Bot": "nav.telegramBot",
  "Settings": "nav.settings",
};
const SECTION_ORDER = [
  "System",
  "Dashboard",
  "General",
  "Setup",
  "Administration",
  "Security",
  "Sales",
  "Inventory",
  "Procurement",
  "Production",
  "Finance",
  "Human Resources",
  "HR",
  "Operations",
  "Catering",
  "Butchery",
  "Reports",
  "Telegram Bot",
  "Settings",
];

function readCollapsedPreference(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
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
  } else if (!companyId && !path.startsWith("platform/") && !path.startsWith("system-admin/")) {
    return null;
  }

  if (path.includes(":")) return null;

  return normalizePath(path);
}

function buildSidebarItems(
  routes: SidebarRoute[],
  companyId: string | null,
  canAccessRoute: (route: SidebarRoute) => boolean
): SidebarItem[] {
  const items = new Map<string, SidebarItem>();

  for (const route of routes) {
    if (!isVisibleRoute(route)) continue;
    if (!canAccessRoute(route)) continue;

    const label = getRouteLabel(route);
    const section = getRouteSection(route);
    const to = resolveSidebarPath(route, companyId);

    if (!label || !to) continue;

    if (to.includes("/eventmanagment")) {
      const marker=to.indexOf("/eventmanagment");
      const module=to.slice(marker+"/eventmanagment/".length);
      for(const group of cateringNavigation){
        group.links.forEach(([label,target],index)=>{
          if(target.split("?")[0]!==module)return;
          const href=to.slice(0,marker)+"/eventmanagment/"+target;
          const key=group.title+":"+href;
          items.set(key,{key,label,section:group.title,to:href,order:index,icon:route.icon});
        });
      }
      // Keep less common operational destinations available in the main menu.
      if(!["inventory","reports"].includes(module))continue;
    }
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

function getBranchOptionName(branch: unknown): string {
  const row = branch as Record<string, unknown>;
  const value = row?.name ?? row?.branchName ?? row?.tradeName ?? row?.code;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : "Unnamed branch";
}

function getBranchOptionId(branch: unknown): string | null {
  const row = branch as Record<string, unknown>;
  const value = row?.id ?? row?.branchId;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function replaceBranchInPath(pathname: string, branchId: string): string {
  const encodedBranchId = encodeURIComponent(branchId);

  return pathname.replace(
    /(\/branches\/)[^/?#]+/i,
    `$1${encodedBranchId}`
  );
}

function replaceBranchInSearch(search: string, branchId: string): string {
  if (!search) return search;

  const params = new URLSearchParams(search);
  let changed = false;

  for (const key of ["branchId", "branch_id", "BranchId"]) {
    if (params.has(key)) {
      params.set(key, branchId);
      changed = true;
    }
  }

  return changed ? `?${params.toString()}` : search;
}

export default function Sidebar({
  open = false,
  onClose,
  onSignOut,
}: SidebarProps) {
  const routes = useAppRoutes();
  const { t, tx } = useI18n();

  function translateNavLabel(label: string): string {
    const key = NAV_LABEL_KEYS[label];
    return key ? t(key) : tx(label);
  }

  function translateNavSection(section: string): string {
    const key = NAV_SECTION_KEYS[section];
    return key ? t(key) : tx(section);
  }
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const appScope = useAppContext();
  const resolvedScope = useAppScope();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

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

  const companyId = resolvedScope.companyId || auth.companyId || appScope.companyId || null;

  const companyName =
    resolvedScope.companyName ??
    auth.auth?.companyName ??
    appScope.companyName ??
    t("nav.noCompany");

  const branchName =
    resolvedScope.branchName ?? t("nav.noBranch");

  const branchId = resolvedScope.branchId || null;

  const userName =
    auth.user?.fullName ??
    auth.user?.email ??
    "Admin User";

  const roleNames = useMemo(
    () =>
      [
        ...(((auth as any).roles ?? []) as string[]),
        ...(((auth.user as any)?.roles ?? []) as string[]),
        ...(((auth.user as any)?.roleNames ?? []) as string[]),
      ]
        .filter(Boolean)
        .map(String),
    [auth, auth.user]
  );

  const isSystemAdmin =
    Boolean(auth.isSystemAdmin) || hasSystemAdminRole(roleNames);

  const isCompanyAdmin = hasCompanyAdminRole(roleNames);

  const permissionNames = useMemo(
    () =>
      [
        ...(((auth as any).permissions ?? []) as string[]),
        ...(((auth.user as any)?.permissions ?? []) as string[]),
      ]
        .filter(Boolean)
        .map((permission) => normalizePermission(String(permission))),
    [auth, auth.user]
  );

  const permissionSet = useMemo(
    () => new Set(permissionNames),
    [permissionNames]
  );

  useEffect(() => {
    if (!companyId || (isSystemAdmin && !appScope.companyId)) {
      setBranches([]);
      return;
    }

    let cancelled = false;

    setBranchesLoading(true);
    branchesApi
      .list(companyId, { page: 1, pageSize: 100, activeOnly: true })
      .then((rows) => {
        if (cancelled) return;

        const nextBranches = rows
          .map((branch) => {
            const id = getBranchOptionId(branch);

            return id
              ? {
                  id,
                  name: getBranchOptionName(branch),
                }
              : null;
          })
          .filter((branch): branch is BranchOption => Boolean(branch))
          .sort((a, b) => a.name.localeCompare(b.name));

        setBranches(nextBranches);
      })
      .catch(() => {
        if (!cancelled) {
          setBranches([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBranchesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, isSystemAdmin, appScope.companyId]);

  function canAccessRoute(route: SidebarRoute): boolean {
    return canAccessErpRoute(
      {
        roles: roleNames,
        permissions: [...permissionSet],
      },
      route
    );
  }

  const dashboardPath = companyId
    ? `/companies/${companyId}/dashboard`
    : isSystemAdmin
      ? "/platform/tenants"
      : "/login";

  const groupedRoutes = useMemo(() => {
    const items = buildSidebarItems(
      routes as SidebarRoute[],
      companyId,
      canAccessRoute
    );

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
  }, [routes, companyId, isSystemAdmin, roleNames, permissionNames]);

  const sectionEntries = Object.entries(groupedRoutes);
  const initials = getInitials(userName);

  const scopeLabel =
    isSystemAdmin && !companyId
      ? tx("Platform mode")
      : t("nav.activeCompany");

  const scopeBranch =
    isSystemAdmin && !companyId
      ? tx("System Administrator")
      : branchName === t("nav.noBranch")
        ? isCompanyAdmin
          ? t("nav.companyAdminAllBranches")
          : t("nav.allBranches")
        : branchName;

  const footerRoleLabel = isSystemAdmin
    ? tx("System Administrator")
    : isCompanyAdmin
      ? tx("Company Administrator")
      : branchName === t("nav.noBranch")
        ? t("nav.allBranches")
        : branchName;

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

  async function handleBranchChange(nextBranchId: string) {
    const selected = branches.find((branch) => branch.id === nextBranchId);
    const selectedBranchId = selected?.id ?? null;

    if(!await appScope.requestBranchChange({
      id: selectedBranchId,
      name: selected?.name ?? null,
    }))return;

    if (selectedBranchId) {
      const nextPath = replaceBranchInPath(location.pathname, selectedBranchId);
      const nextSearch = replaceBranchInSearch(location.search, selectedBranchId);

      if (nextPath !== location.pathname || nextSearch !== location.search) {
        navigate(`${nextPath}${nextSearch}${location.hash}`, { replace: true });
      }
    }

    setUserMenuOpen(false);
  }

  const sidebarContent = (
    <>
      <style>{SIDEBAR_CSS}</style>

      {open && (
        <button
          type="button"
          className="hnav-overlay"
          onClick={onClose}
          aria-label={tx("Close sidebar")}
        />
      )}

      <aside
        className={`hnav-root${open ? " hnav-open" : ""}${collapsed ? " hnav-collapsed" : ""}`}
        aria-label={tx("Main navigation")}
      >
        <div className="hnav-brand">
          <button
            type="button"
            className="hnav-brand-lockup"
            onClick={() => handleNavigate(dashboardPath)}
            aria-label={tx("Go to dashboard")}
            title={tx("Go to dashboard")}
          >
            <div className="hnav-brand-mark" aria-hidden="true">
              HN
            </div>

            <div className="hnav-brand-text">
              <span className="hnav-brand-name">Hotel Nova</span>
              <span className="hnav-brand-env">ERP Console</span>
            </div>
          </button>

          <div className="hnav-brand-actions">
            <button
              type="button"
              className="hnav-icon-btn hnav-collapse-btn"
              onClick={toggleSidebar}
              aria-label={collapsed ? tx("Expand sidebar") : tx("Collapse sidebar")}
              title={collapsed ? tx("Expand sidebar") : tx("Collapse sidebar")}
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
              aria-label={tx("Close sidebar")}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="hnav-scope-card" aria-label={tx("Current company scope")}>
          <div className="hnav-scope-icon" aria-hidden="true">
            <Building2 size={15} strokeWidth={2.2} />
          </div>

          <div className="hnav-scope-meta">
            <span className="hnav-scope-label">{scopeLabel}</span>
            <span className="hnav-scope-name">{companyName}</span>
            <span className="hnav-scope-branch">{scopeBranch}</span>

            {companyId && branches.length > 0 && (
              <label className="hnav-branch-select-wrap">
                <span className="hnav-branch-select-label">{t("nav.branch")}</span>
                <select
                  className="hnav-branch-select"
                  value={branchId ?? ""}
                  onChange={(event) => handleBranchChange(event.target.value)}
                  disabled={branchesLoading}
                  aria-label={t("nav.branch")}
                >
                  <option value="">{isCompanyAdmin ? t("nav.companyAdminAllBranches") : t("nav.allBranches")}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <nav className="hnav-scroll" aria-label={tx("Sidebar navigation")}>
          {sectionEntries.length === 0 ? (
            <div className="hnav-empty">
              {companyId
                ? t("nav.noModules")
                : t("nav.selectCompany")}
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
                    title={translateNavSection(section)}
                  >
                    <span className="hnav-section-label">{translateNavSection(section)}</span>
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
                            aria-current={item.to.includes("/eventmanagment") ? (isCateringNavigationActive(item.to,location.pathname,location.search) ? "page" : false) : undefined}
                            onClick={onClose}
                            title={collapsed ? translateNavLabel(item.label) : undefined}
                            className={({ isActive }) =>
                              `hnav-item${(item.to.includes("/eventmanagment") ? isCateringNavigationActive(item.to,location.pathname,location.search) : isActive) ? " hnav-item-active" : ""}`
                            }
                          >
                            <span className="hnav-item-icon" aria-hidden="true">
                              {item.icon ?? <Circle size={7} strokeWidth={3} />}
                            </span>

                            <span className="hnav-item-label">{translateNavLabel(item.label)}</span>
                          </NavLink>
                          {!collapsed && item.children?.length ? (
                            <ul className="hnav-subitems" role="list">
                              {item.children.map((child) => (
                                <li key={child.key} role="listitem">
                                  <NavLink
                                    to={child.to}
                                    onClick={onClose}
                                    title={translateNavLabel(child.label)}
                                    className={({ isActive }) =>
                                      `hnav-subitem${isActive ? " hnav-subitem-active" : ""}`
                                    }
                                  >
                                    <span className="hnav-subitem-icon" aria-hidden="true">
                                      {child.icon ?? <Circle size={6} strokeWidth={3} />}
                                    </span>
                                    <span className="hnav-subitem-label">{translateNavLabel(child.label)}</span>
                                  </NavLink>
                                </li>
                              ))}
                            </ul>
                          ) : null}
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
              <span className="hnav-user-branch">{footerRoleLabel}</span>
            </div>

            <button
              type="button"
              className="hnav-icon-btn hnav-user-toggle"
              aria-label={tx("User menu")}
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

  if (typeof document === "undefined") {
    return sidebarContent;
  }

  return createPortal(sidebarContent, document.body);
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
  z-index: 2147483000;
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
  z-index: 2147482990;
  border: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
  touch-action: none;
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

.hnav-branch-select-wrap {
  display: grid;
  gap: 4px;
  margin-top: 9px;
}

.hnav-branch-select-label {
  color: var(--hnav-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.hnav-branch-select {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 30px 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.82);
  color: #f8fafc;
  font-size: 12px;
  font-weight: 650;
  outline: none;
}

.hnav-branch-select:focus {
  border-color: rgba(96, 165, 250, 0.72);
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
}

.hnav-branch-select:disabled {
  opacity: 0.62;
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


.hnav-subitems {
  display: grid;
  gap: 2px;
  margin: 3px 0 8px 31px;
  padding: 0 0 0 10px;
  border-left: 1px solid rgba(148, 163, 184, 0.22);
  list-style: none;
}

.hnav-subitem {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #aebccc;
  text-decoration: none;
}

.hnav-subitem:hover,
.hnav-subitem-active {
  background: rgba(20, 184, 166, 0.1);
  border-color: rgba(45, 212, 191, 0.16);
  color: #fff;
}

.hnav-subitem-icon {
  display: inline-grid;
  width: 16px;
  flex: 0 0 16px;
  place-items: center;
}

.hnav-subitem-label {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
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

.hnav-root.hnav-collapsed 
.hnav-subitems {
  display: grid;
  gap: 2px;
  margin: 3px 0 8px 31px;
  padding: 0 0 0 10px;
  border-left: 1px solid rgba(148, 163, 184, 0.22);
  list-style: none;
}

.hnav-subitem {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #aebccc;
  text-decoration: none;
}

.hnav-subitem:hover,
.hnav-subitem-active {
  background: rgba(20, 184, 166, 0.1);
  border-color: rgba(45, 212, 191, 0.16);
  color: #fff;
}

.hnav-subitem-icon {
  display: inline-grid;
  width: 16px;
  flex: 0 0 16px;
  place-items: center;
}

.hnav-subitem-label {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hnav-footer {
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
    width: min(336px, 90vw);
    max-width: calc(100vw - 28px);
    border-top-right-radius: 18px;
    border-bottom-right-radius: 18px;
    transform: translateX(-105%);
    transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    will-change: transform;
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

@media (max-width: 420px) {
  .hnav-root {
    width: min(328px, 92vw);
    max-width: calc(100vw - 18px);
  }

  .hnav-brand {
    min-height: 64px;
    padding: 12px 14px 8px;
  }

  .hnav-brand-mark {
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }

  .hnav-scope-card {
    margin-inline: 10px;
    border-radius: 12px;
    padding: 10px;
  }

  .hnav-scroll {
    padding-inline: 8px;
  }

  .hnav-item {
    min-height: 44px;
    border-radius: 10px;
  }

  .hnav-section-head {
    padding-top: 9px;
  }

  
.hnav-subitems {
  display: grid;
  gap: 2px;
  margin: 3px 0 8px 31px;
  padding: 0 0 0 10px;
  border-left: 1px solid rgba(148, 163, 184, 0.22);
  list-style: none;
}

.hnav-subitem {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #aebccc;
  text-decoration: none;
}

.hnav-subitem:hover,
.hnav-subitem-active {
  background: rgba(20, 184, 166, 0.1);
  border-color: rgba(45, 212, 191, 0.16);
  color: #fff;
}

.hnav-subitem-icon {
  display: inline-grid;
  width: 16px;
  flex: 0 0 16px;
  place-items: center;
}

.hnav-subitem-label {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hnav-footer {
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }
}

@media (min-width: 1025px) {
  .hnav-overlay {
    display: none;
  }
}
`;





