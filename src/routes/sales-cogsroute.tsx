import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  ReceiptText,
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
  {
    path: "sales",
    label: "Sales Dashboard",
    element: <SalesDashboardPage />,
    icon: <LayoutDashboard size={18} />,
    nav: true,
    section: "Sales",
    order: 10,
  },
  {
    path: "sales/list",
    label: "Sales Register",
    element: <SalesListPage />,
    icon: <ShoppingCart size={18} />,
    nav: true,
    section: "Sales",
    order: 20,
  },
  {
    path: "sales/new",
    label: "New Sale",
    element: <SalesListPage />,
    icon: <ReceiptText size={18} />,
    nav: false,
    section: "Sales",
    order: 25,
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
    nav: true,
    section: "Reports",
    order: 30,
  },
  {
    path: "sales/import",
    label: "External Sales Import",
    element: <ExternalSalesImportPage />,
    icon: <Upload size={18} />,
    nav: true,
    section: "Sales",
    order: 40,
  },
  {
    path: "sales/operations",
    label: "Operations Dashboard",
    element: <OperationsDashboardPage />,
    icon: <ClipboardList size={18} />,
    nav: true,
    section: "Operations",
    order: 50,
  },
];

export function useSalesRoutes(): AppRoute[] {
  return salesRoutes;
}