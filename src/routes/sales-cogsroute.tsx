import {
  BarChart3,
  CalendarClock,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  ShoppingCart,
  Upload,
  UtensilsCrossed,
} from "lucide-react";

// ── Sales pages ───────────────────────────────────────────────────────────────
import SalesReportsPage    from "../features/sales/pages/SalesReportsPage";
import SalesListPage       from "../features/sales/pages/SalesListPage";
import SaleDetailPage      from "../features/sales/pages/SaleDetailPage";
import ExternalSalesImportPage from "../features/sales/pages/ExternalSalesImportPage";
import SalesDashboardPage  from "../features/sales/pages/SalesDashboardPage";
import OperationsDashboardPage from "../features/operations/pages/OperationsDashboardPage";

// ── HotelNova POS pages (.jsx — no TypeScript declarations) ───────────────────
// POSPage:       dark-theme POS terminal, wired to backend API
// SessionPage:   dark-theme session open/close/X/Z report
// OperationsPage: cashier shifts, safe drops, EOD, stations
// OtherPages:    DashboardPage (sales overview), OrdersPage, TablesPage
// @ts-ignore


import type { ReactNode }    from "react";
import type { RouteObject }  from "react-router-dom";

export type AppRoute = Omit<RouteObject, "children" | "element"> & {
  label?:       string;
  element?:     ReactNode;
  icon?:        ReactNode;
  nav?:         boolean;
  section?:     string;
  roles?:       string[];
  permissions?: string[];
  children?:    AppRoute[];
};

export function useSalesRoutes(): AppRoute[] {
  return [
    {
      path: "/sales",
      children: [

        // =====================================================================
        // DASHBOARD
        // =====================================================================

        {
          index:   true,
          label:   "Sales Dashboard",
          element: <SalesDashboardPage />,
          icon:    <LayoutDashboard size={18} />,
          nav:     true,
          section: "Sales",
        },

        // =====================================================================
        // POS
        // POSPage fetches its own session — no props needed.
        // SessionPage manages open/close/X/Z — no props needed.
        // Both are the canonical routes; the old TypeScript versions are removed
        // to avoid two competing terminals showing in the nav.
        // =====================================================================

        
        // =====================================================================
        // SALES MANAGEMENT
        // =====================================================================

        {
          path:    "list",
          label:   "Sales Register",
          element: <SalesListPage />,
          icon:    <ShoppingCart size={18} />,
          nav:     true,
          section: "Sales",
        },
        {
          path:    ":saleId",
          label:"Sales Details",
          element: <SaleDetailPage />,
          nav:     true,
          section: "Sales",
        },

        // =====================================================================
        // REPORTS
        // =====================================================================

        {
          path:    "reports",
          label:   "Sales Reports",
          element: <SalesReportsPage />,
          icon:    <BarChart3 size={18} />,
          nav:     true,
          section: "Reports",
        },
     

        // =====================================================================
        // EXTERNAL SALES
        // =====================================================================

        {
          path:    "import",
          label:   "External Sales Import",
          element: <ExternalSalesImportPage />,
          icon:    <Upload size={18} />,
          nav:     true,
          section: "Sales",
        },

        // =====================================================================
        // OPERATIONS
        // =====================================================================

        {
          path:    "operations",
          label:   "Operations Dashboard",
          element: <OperationsDashboardPage />,
          icon:    <ClipboardList size={18} />,
          nav:     true,
          section: "Operations",
        },
  
      ] satisfies AppRoute[],
    },
  ];
}