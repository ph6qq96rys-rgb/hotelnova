import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { usePageMeta } from "../hooks/usePageMeta";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const loc = useLocation();

  // One source of truth for title/subtitle/breadcrumb
  const meta = usePageMeta(loc.pathname);

  useEffect(() => {
    document.title = `${meta.title} • HotelNova`;
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
            title={meta.title}
            subtitle={meta.subtitle}
          />
        </header>

        {/* Breadcrumb goes ABOVE content */}
        {meta.crumbs?.length ? (
          <div className="breadcrumb">
            {meta.crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`}>
                {c.to ? <NavLink to={c.to}>{c.label}</NavLink> : c.label}
                {i < meta.crumbs.length - 1 ? " / " : ""}
              </span>
            ))}
          </div>
        ) : null}

        <main className="hna-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
