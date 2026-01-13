import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { appRoutes } from "../routes/routeDefConfig";
import type { AppRoute } from "../routes/routeConfig";
import { useAuth } from "../auth/AuthProvider";
import { useAppScope } from "../app/useAppScope";

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

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

/** ✅ Nav-only route shape (must have label + path) */
type NavRoute = AppRoute & { nav: true; path: string; label: string };

/** ✅ Type guard (MUST be at module scope for best TS narrowing) */
function isNavRoute(r: AppRoute): r is NavRoute {
  return r.nav === true && typeof r.path === "string" && typeof r.label === "string";
}

/**
 * Route visibility rule:
 * - if route.permissions is empty => visible
 * - else visible if user has ANY required permission in current scope
 */
function canSee(
  required: string[] | undefined,
  hasPermission: (p: string, companyId?: string | null, branchId?: string | null) => boolean,
  companyId?: string | null,
  branchId?: string | null
) {
  if (!required || required.length === 0) return true;
  return required.some((p) => hasPermission(p, companyId, branchId));
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { hasPermission, isAuthenticated } = useAuth();
  const { companyId, branchId } = useAppScope();

  const groups = useMemo(() => {
    if (!isAuthenticated) return [];

    const rows: NavRow[] = appRoutes
      .filter(isNavRoute) // ✅ now r.path/r.label are string
      .filter((r) => canSee(r.permissions, hasPermission, companyId, branchId))
      .map((r) => {
        const section = r.section ?? "General";
        const path = normalizePath(r.path);

        return {
          id: `${section}::${path}`,
          section,
          path,
          label: r.label,
          icon: r.icon
        };
      });

    // De-duplicate by path
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });

    // Group by section
    const map = new Map<string, NavRow[]>();
    for (const row of deduped) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }

    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  }, [isAuthenticated, hasPermission, companyId, branchId]);

  return (
    <>
      {open && <div className="hna-sidebar-overlay" onClick={onClose} />}

      <aside className={`hna-sidebar-inner ${open ? "is-open" : ""}`}>
        <div className="hna-brand">
          <div className="hna-brand-title">HotelNova</div>

          <button
            className="hna-sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
            type="button"
          >
            ✕
          </button>
        </div>

        <nav className="hna-nav" aria-label="Sidebar navigation">
          {groups.map((group) => (
            <div key={group.section} className="hna-nav-group">
              <div className="hna-nav-group-title">{group.section}</div>

              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) => `hna-nav-item ${isActive ? "active" : ""}`}
                  end={item.path === "/" || item.path === "/dashboard"}
                >
                  {item.icon && <span className="hna-nav-icon">{item.icon}</span>}
                  <span className="hna-nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
