// src/layouts/AppShell.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Factory,
  Home,
  Menu,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { useAppContext } from "../app/AppContext";
import {
  canAccessRoute,
  normalizePermission,
} from "../auth/erpAccess";
import { useAuth } from "../auth/useAuth";
import { usePageMeta } from "../hooks/usePageMeta";
import { useAppRoutes, type RouteWithHref } from "../routes/routeDefConfig";

type MobileNavItem = {
  key: string;
  label: string;
  to: string;
  section: string;
};

const MOBILE_SECTION_ORDER = [
  "Dashboard",
  "Sales",
  "Inventory",
  "Production",
  "Human Resources",
  "HR",
];

function getRouteLabel(route: RouteWithHref): string {
  return (route.menu?.label ?? route.label ?? "").trim();
}

function getRouteSection(route: RouteWithHref): string {
  return (route.menu?.section ?? route.section ?? "General").trim() || "General";
}

function getMobileIcon(section: string, label: string) {
  const text = `${section} ${label}`.toLowerCase();

  if (text.includes("dashboard")) return <Home size={18} strokeWidth={2} />;
  if (text.includes("sales") || text.includes("pos")) return <ShoppingCart size={18} strokeWidth={2} />;
  if (text.includes("inventory") || text.includes("procurement")) return <Boxes size={18} strokeWidth={2} />;
  if (text.includes("production") || text.includes("menu")) return <Factory size={18} strokeWidth={2} />;
  if (text.includes("hr") || text.includes("human")) return <UsersRound size={18} strokeWidth={2} />;

  return <Home size={18} strokeWidth={2} />;
}

function resolveMobilePath(route: RouteWithHref, companyId: string | null): string | null {
  if (route.getHref) {
    if (!companyId) return null;
    return route.getHref(companyId);
  }

  const path = route.path?.trim();

  if (!path || path.includes(":")) return null;

  if (path.startsWith("/")) return path;
  if (path.startsWith("platform/") || path.startsWith("system-admin/")) return `/${path}`;
  if (!companyId) return null;

  return `/companies/${companyId}/${path.replace(/^\/+/, "")}`;
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const routes = useAppRoutes();
  const auth = useAuth();
  const appScope = useAppContext();

  const meta = usePageMeta(location.pathname);
  const crumbs = meta.crumbs ?? [];
  const companyId = auth.companyId ?? appScope.companyId ?? null;

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

  const mobileNavItems = useMemo<MobileNavItem[]>(() => {
    const identity = {
      roles: roleNames,
      permissions: permissionNames,
    };

    const candidatesByKey = new Map<string, MobileNavItem>();

    for (const route of routes) {
      if (!route.nav && !route.menu) continue;
      if (!canAccessRoute(identity, route)) continue;

      const label = getRouteLabel(route);
      const section = getRouteSection(route);
      const to = resolveMobilePath(route, companyId);

      if (!label || !to) continue;

      const key = `${section}:${to}`;

      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, {
          key,
          label,
          to,
          section,
        });
      }
    }

    const candidates = [...candidatesByKey.values()];

    const bySection = new Map<string, MobileNavItem>();

    for (const section of MOBILE_SECTION_ORDER) {
      const item = candidates.find((candidate) => {
        const normalized = candidate.section.toLowerCase();
        const wanted = section.toLowerCase();

        return normalized === wanted || candidate.label.toLowerCase().includes(wanted);
      });

      if (item && !bySection.has(section)) {
        bySection.set(section, item);
      }
    }

    return [...bySection.values()].slice(0, 4);
  }, [routes, companyId, roleNames, permissionNames]);

  useEffect(() => {
    document.title = `${meta.title || "Dashboard"} - Hotel Nova`;
  }, [meta.title]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  return (
    <div className={`hna-shell${sidebarOpen ? " hna-shell--nav-open" : ""}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="hna-sidebar" aria-hidden="true" />

      <div className="hna-main">
        <div className="hna-topbar-slot">
          <Topbar
            onOpenSidebar={openSidebar}
            sidebarOpen={sidebarOpen}
            title={meta.title || "Dashboard"}
            subtitle={meta.subtitle}
          />
        </div>

        {crumbs.length > 0 ? (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;

              const safeTo =
                crumb.to && !crumb.to.includes(":")
                  ? crumb.to
                  : undefined;

              return (
                <span key={`${crumb.label}-${index}`}>
                  {safeTo && !isLast ? (
                    <NavLink to={safeTo}>{crumb.label}</NavLink>
                  ) : (
                    <span>{crumb.label}</span>
                  )}

                  {!isLast ? " / " : ""}
                </span>
              );
            })}
          </nav>
        ) : null}

        <main className="hna-content">
          <Outlet />
        </main>

        <nav className="hna-mobile-nav" aria-label="Primary mobile navigation">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) =>
                `hna-mobile-nav__item${isActive ? " is-active" : ""}`
              }
            >
              <span className="hna-mobile-nav__icon" aria-hidden="true">
                {getMobileIcon(item.section, item.label)}
              </span>
              <span className="hna-mobile-nav__label">{item.label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            className="hna-mobile-nav__item hna-mobile-nav__button"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            onPointerDown={openSidebar}
            onTouchStart={openSidebar}
            onClick={openSidebar}
          >
            <span className="hna-mobile-nav__icon" aria-hidden="true">
              <Menu size={18} strokeWidth={2} />
            </span>
            <span className="hna-mobile-nav__label">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
