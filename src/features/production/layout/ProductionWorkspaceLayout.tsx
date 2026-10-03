// src/features/production/layout/ProductionWorkspaceLayout.tsx

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChefHat, ClipboardList, Factory, LayoutDashboard, Utensils } from "lucide-react";
import { useI18n } from "../../../i18n";
import "./production.css";

//  Types 

type ActiveModule = "dashboard" | "menu" | "recipe" | "batch";

//  Nav config 

const NAV_ITEMS = [
  { label: "Dashboard",         to: "/production",              icon: LayoutDashboard, end: true },
  { label: "Menu Items",        to: "/production/menu/items",   icon: Utensils,end: false },
  { label: "Recipe Editor",     to: "/production/recipes",      icon: ChefHat ,end: false },
  { label: "Production Batches",to: "/production/batches",      icon: Factory ,end: false },
  { label: "Batch History",     to: "/production/history",      icon: ClipboardList ,end: false },
] as const;

const MODULE_TITLES: Record<ActiveModule, string> = {
  dashboard: "Production Workspace",
  menu:      "Menu Engineering",
  recipe:    "Recipe Management",
  batch:     "Production Execution",
};

//  Helpers 

function getActiveModule(pathname: string): ActiveModule {
  if (pathname.includes("/menu"))   return "menu";
  if (pathname.includes("/recipe")) return "recipe";
  if (pathname.includes("/batch"))  return "batch";
  return "dashboard";
}

//  Component 

export default function ProductionWorkspaceLayout() {
  const { tx } = useI18n();
  const nav      = useNavigate();
  const location = useLocation();
  const module   = getActiveModule(location.pathname);

  return (
    <div className="p-shell">
      {/*  Sidebar  */}
      <aside className="p-sidebar">
        <div className="p-brand">
          <div className="p-brand__mark">P</div>
          <div>
            <div className="p-brand__name">{tx("Production")}</div>
            <div className="p-brand__sub">{tx("Menu - Recipe - Batch")}</div>
          </div>
        </div>

        <nav className="p-nav">
          <div className="p-nav__section">{tx("Workspace")}</div>
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `p-nav__item${isActive ? " p-nav__item--active" : ""}`
              }
            >
              <Icon size={16} />
              {tx(label)}
            </NavLink>
          ))}
        </nav>

        <div className="p-flow-tracker">
          <div className="p-flow-tracker__label">{tx("Current flow")}</div>
          <div className="p-flow-steps">
            <span className={module === "menu"   ? "is-active" : ""}>{tx("Menu")}</span>
            <span className="sep">{tx("to")}</span>
            <span className={module === "recipe" ? "is-active" : ""}>{tx("Recipe")}</span>
            <span className="sep">{tx("to")}</span>
            <span className={module === "batch"  ? "is-active" : ""}>{tx("Batch")}</span>
          </div>
        </div>
      </aside>

      {/*  Main  */}
      <main className="p-main">
        <header className="p-topbar">
          <div>
            <div className="p-topbar__kicker">{tx("Restaurant ERP")}</div>
            <h1 className="p-topbar__title">{tx(MODULE_TITLES[module])}</h1>
          </div>

          <div className="p-btn-row">
            <button
              type="button"
              className="p-btn p-btn--outline"
              onClick={() => nav("/production/menu/items/new")}
            >
              {tx("+ New Menu Item")}
            </button>
            <button
              type="button"
              className="p-btn p-btn--accent"
              onClick={() => nav("/production/batches/new")}
            >
              {tx("+ New Batch")}
            </button>
          </div>
        </header>

        <div className="p-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}