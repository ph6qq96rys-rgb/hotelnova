import BranchQrMenuPage from "../features/public-menu/BranchQrMenuPage";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  ShoppingCart,
  Upload,
} from "lucide-react";

import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import SalesDashboardPage from "../features/sales/pages/SalesDashboardPage";
import SalesListPage from "../features/sales/pages/SalesListPage";
import SaleDetailPage from "../features/sales/pages/SaleDetailPage";
import SalesReportsPage from "../features/sales/pages/SalesReportsPage";
import ExternalSalesImportPage from "../features/sales/pages/ExternalSalesImportPage";
import OperationsDashboardPage from "../features/operations/pages/OperationsDashboardPage";
import DigitalMenuPage from "../shared/DigitalMenuPage";

export type AppRoute = Omit<RouteObject, "children" | "element"> & {
  label?: string;
  element?: ReactNode;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  roles?: string[];
  permissions?: string[];
  children?: AppRoute[];
  menu?: {
    label?: string;
    section?: string;
    order?: number;
  };
  order?: number;
};

export const salesRoutes: AppRoute[] = [
  { path: "sales/qr-menu", label: "QR Menu", element: <BranchQrMenuPage />, icon: <ClipboardList size={18} />, nav: true, section: "Sales", order: 15, permissions: ["menu.manage"] },
  {
    path: "sales",
    label: "Sales Dashboard",
    element: <SalesDashboardPage />,
    icon: <LayoutDashboard size={18} />,
    nav: true,
    section: "Sales",
    order: 10,
    permissions: ["sales.view"],
  },
  {
    path: "sales/list",
    label: "Sales Register",
    element: <SalesListPage />,
    icon: <ShoppingCart size={18} />,
    nav: false,
    section: "Sales",
    order: 20,
  },
  {
  path: "digital-menu",
  element: <DigitalMenuPage />,
  nav: false,
  label: "Digital Menu",
  section: "general",
},
  {
    path: "sales/details/:saleId",
    label: "Sale Detail",
    element: <SaleDetailPage />,
    nav: false,
    section: "Sales",
  },
  {
    path: "sales/reports",
    label: "Sales Reports",
    element: <SalesReportsPage />,
    icon: <BarChart3 size={18} />,
    nav: false,
    section: "Reports",
    order: 30,
  },
  {
    path: "sales/import",
    label: "External Sales Import",
    element: <ExternalSalesImportPage />,
    icon: <Upload size={18} />,
    nav: false,
    section: "Sales",
    order: 40,
  },
  {
    path: "sales/operations",
    label: "Operations Dashboard",
    element: <OperationsDashboardPage />,
    icon: <ClipboardList size={18} />,
    nav: false,
    section: "Operations",
    order: 50,
    permissions: ["operations.view", "operations.manage", "sales.view", "pos.view", "pos.sell", "pos.close"],
  },
];

export function useSalesRoutes(): AppRoute[] {
  return salesRoutes;
}
