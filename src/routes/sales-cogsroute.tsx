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

// ── Existing pages (unchanged) ────────────────────────────────────────────────
import PosPage from "../features/sales-posting/pages/PosPage";
import SalesReportsPage from "../features/sales/pages/SalesReportsPage";
import SalesListPage from "../features/sales/pages/SalesListPage";
import SaleDetailPage from "../features/sales/pages/SaleDetailPage";
import OperationsDashboardPage from "../features/operations/pages/OperationsDashboardPage";
import ExternalSalesImportPage from "../features/sales/pages/ExternalSalesImportPage";
import SalesDashboardPage from "../features/sales/pages/SalesDashboardPage";
import PosSessionPage from "../features/sales-posting/pages/PosSessionPage";

// New HotelNova POS pages (.jsx — no TypeScript declarations)
// @ts-ignore
import POSPage from "../features/Sales-new/pages/POSPage";
// @ts-ignore
import DashboardPage, { OrdersPage, TablesPage } from "../features/Sales-new/pages/OtherPages";
// @ts-ignore
import { SessionPage } from "../features/Sales-new/pages/SessionPage";
// @ts-ignore
import { OperationsPage } from "../features/Sales-new/pages/OperationsPage";

import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

export type AppRoute = Omit<RouteObject, "children" | "element"> & {
  label?: string;
  element?: ReactNode;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  roles?: string[];
  permissions?: string[];
  children?: AppRoute[];
};

export function useSalesRoutes(): AppRoute[] {
  return [
    {
      path: "/sales",
      children: [
        // =====================================================
        // DASHBOARD
        // =====================================================

        {
          index: true,
          label: "Sales Dashboard",
          element: <SalesDashboardPage />,
          icon: <LayoutDashboard size={18} />,
          nav: true,
          section: "Sales",
        },

        // =====================================================
        // POS
        // =====================================================

        {
          path: "pos",
          label: "POS Terminal",
          element: <PosPage />,
          icon: <Monitor size={18} />,
          nav: true,
          section: "POS",
        },
        {
          path: "pos/session",
          label: "POS Session",
          element: <PosSessionPage />,
          icon: <CalendarClock size={18} />,
          nav: true,
          section: "POS",
        },

        // ── HotelNova POS pages ─────────────────────────────

        {
          path: "pos/terminal",
          label: "HN POS Terminal",
          element: <POSPage />,
          icon: <Monitor size={18} />,
          nav: true,
          section: "POS",
        },
        {
          path: "pos/hn-session",
          label: "HN POS Session",
          element: <SessionPage />,
          icon: <CalendarClock size={18} />,
          nav: true,
          section: "POS",
        },
        {
          path: "pos/orders",
          label: "Live Orders",
          element: <OrdersPage />,
          icon: <ChefHat size={18} />,
          nav: true,
          section: "POS",
        },
        {
          path: "pos/tables",
          label: "Table Service",
          element: <TablesPage />,
          icon: <UtensilsCrossed size={18} />,
          nav: true,
          section: "POS",
        },

        // Future POS Features
        /*
        {
          path: "pos/parked",
          label: "Parked Orders",
          element: <ParkedOrdersPage />,
          icon: <Receipt size={18} />,
          nav: true,
          section: "POS",
        },
        {
          path: "pos/delivery",
          label: "Delivery Orders",
          element: <DeliveryOrdersPage />,
          icon: <Bike size={18} />,
          nav: true,
          section: "POS",
        },
        */

        // =====================================================
        // SALES MANAGEMENT
        // =====================================================

        {
          path: "list",
          label: "Sales Register",
          element: <SalesListPage />,
          icon: <ShoppingCart size={18} />,
          nav: true,
          section: "Sales",
        },
        {
          path: ":saleId",
          element: <SaleDetailPage />,
          nav: false,
          section: "Sales",
        },

        // Future Sales Features
        /*
        {
          path: "refunds",
          label: "Refunds",
          element: <RefundsPage />,
          icon: <RotateCcw size={18} />,
          nav: true,
          section: "Sales",
        },
        {
          path: "voids",
          label: "Voided Sales",
          element: <VoidedSalesPage />,
          icon: <Ban size={18} />,
          nav: true,
          section: "Sales",
        },
        {
          path: "discounts",
          label: "Discount Analysis",
          element: <DiscountAnalysisPage />,
          icon: <Percent size={18} />,
          nav: true,
          section: "Sales",
        },
        */

        // =====================================================
        // REPORTS
        // =====================================================

        {
          path: "reports",
          label: "Sales Reports",
          element: <SalesReportsPage />,
          icon: <BarChart3 size={18} />,
          nav: true,
          section: "Reports",
        },
        {
          path: "reports/dashboard",
          label: "Sales Overview",
          element: <DashboardPage />,
          icon: <BarChart3 size={18} />,
          nav: true,
          section: "Reports",
        },

        // =====================================================
        // FUTURE SALES REPORTS
        // =====================================================

        /*
        {
          path: "reports/daily",
          label: "Daily Sales",
          element: <DailySalesReportPage />,
          icon: <BarChart3 size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/hourly",
          label: "Hourly Sales",
          element: <HourlySalesReportPage />,
          icon: <Clock3 size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/products",
          label: "Product Mix",
          element: <ProductMixReportPage />,
          icon: <Package size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/categories",
          label: "Category Sales",
          element: <CategorySalesReportPage />,
          icon: <FolderTree size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/payments",
          label: "Payment Analysis",
          element: <PaymentAnalysisPage />,
          icon: <CreditCard size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/cashiers",
          label: "Cashier Performance",
          element: <CashierPerformancePage />,
          icon: <Users size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/tax",
          label: "Tax Report",
          element: <TaxReportPage />,
          icon: <ReceiptText size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/x",
          label: "X Report",
          element: <XReportPage />,
          icon: <FileBarChart size={18} />,
          nav: true,
          section: "Reports",
        },

        {
          path: "reports/z",
          label: "Z Report",
          element: <FileBarChart size={18} />,
          nav: true,
          section: "Reports",
        },
        */

        // =====================================================
        // INVENTORY REPORTS
        // =====================================================

        /*
        {
          path: "reports/cogs",
          label: "COGS Report",
          element: <CogsReportPage />,
          icon: <DollarSign size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/consumption",
          label: "Consumption Report",
          element: <ConsumptionReportPage />,
          icon: <PackageMinus size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/variance",
          label: "Variance Report",
          element: <AlertTriangle size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/theoretical-vs-actual",
          label: "Theoretical vs Actual",
          element: <TheoreticalVsActualPage />,
          icon: <Scale size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/valuation",
          label: "Inventory Valuation",
          element: <InventoryValuationPage />,
          icon: <Boxes size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/fifo-aging",
          label: "FIFO Aging",
          element: <Archive size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/dead-stock",
          label: "Dead Stock",
          element: <PackageX size={18} />,
          nav: true,
          section: "Inventory",
        },

        {
          path: "reports/fast-movers",
          label: "Fast Movers",
          element: <TrendingUp size={18} />,
          nav: true,
          section: "Inventory",
        },
        */

        // =====================================================
        // KITCHEN / KDS
        // =====================================================

        /*
        {
          path: "kds",
          label: "Kitchen Display",
          element: <KitchenDisplayPage />,
          icon: <ChefHat size={18} />,
          nav: true,
          section: "Kitchen",
        },

        {
          path: "kds/preparation",
          label: "Preparation Queue",
          element: <PreparationQueuePage />,
          icon: <ClipboardList size={18} />,
          nav: true,
          section: "Kitchen",
        },

        {
          path: "kds/yield",
          label: "Production Yield",
          element: <ProductionYieldPage />,
          icon: <Factory size={18} />,
          nav: true,
          section: "Kitchen",
        },
        */

        // =====================================================
        // EXTERNAL SALES
        // =====================================================

        {
          path: "import",
          label: "External Sales Import",
          element: <ExternalSalesImportPage />,
          icon: <Upload size={18} />,
          nav: true,
          section: "Sales",
        },

        /*
        {
          path: "import/history",
          label: "Import History",
          element: <ImportHistoryPage />,
          icon: <History size={18} />,
          nav: true,
          section: "Sales",
        },
        */

        // =====================================================
        // OPERATIONS
        // =====================================================

        {
          path: "operations",
          label: "Operations Dashboard",
          element: <OperationsDashboardPage />,
          icon: <ClipboardList size={18} />,
          nav: true,
          section: "Operations",
        },
        {
          path: "operations/manage",
          label: "Operations Management",
          element: <OperationsPage />,
          icon: <ClipboardList size={18} />,
          nav: true,
          section: "Operations",
        },
      ] satisfies AppRoute[],
    },
  ];
}