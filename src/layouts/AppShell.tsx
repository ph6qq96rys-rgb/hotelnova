// src/layouts/AppShell.tsx

import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { usePageMeta } from "../hooks/usePageMeta";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const meta = usePageMeta(location.pathname);
  const crumbs = meta.crumbs ?? [];

  useEffect(() => {
    document.title = `${meta.title || "Dashboard"} • HotelNova`;
  }, [meta.title]);

  return (
    <div className="hna-shell">
      <aside className="hna-sidebar">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </aside>

      <div className="hna-main">
        <header className="hna-topbar">
          <Topbar
            onOpenSidebar={() => setSidebarOpen(true)}
            title={meta.title || "Dashboard"}
            subtitle={meta.subtitle}
          />
        </header>

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
      </div>
    </div>
  );
}