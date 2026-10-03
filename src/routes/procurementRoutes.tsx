import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { ClipboardCheck, FileText, LayoutDashboard, PackageX, Settings2, ShoppingCart, Truck } from "lucide-react";

import PurchaseRequisitionListPage from "../features/procurement/pages/PurchaseRequisitionListPage";
import PurchaseRequisitionCreatePage from "../features/procurement/pages/PurchaseRequisitionCreatePage";
import PurchaseRequisitionEditorPage from "../features/procurement/pages/PurchaseRequisitionEditorPage";
import PurchaseRequisitionDetailPage from "../features/procurement/pages/PurchaseRequisitionDetailPage";
import PurchasingDashboardPage from "../features/procurement/pages/ProcurementDashboardPage";
import SupplierListPage from "../features/procurement/pages/SupplierListPage";
import SupplierEditorPage from "../features/procurement/pages/SupplierEditorPage";
import PurchaseOrderListPage from "../features/procurement/pages/PurchaseOrderListPage";
import PurchaseOrderEditorPage from "../features/procurement/pages/PurchaseOrderEditorPage";
import PurchaseOrderDetailPage from "../features/procurement/pages/PurchaseOrderDetailPage";
import SupplierInvoiceListPage from "../features/procurement/pages/SupplierInvoiceListPage";
import SupplierInvoiceCreatePage from "../features/procurement/pages/SupplierInvoiceCreatePage";
import SupplierInvoiceDetailPage from "../features/procurement/pages/SupplierInvoiceDetailPage";
import PurchaseReturnListPage from "../features/procurement/pages/PurchaseReturnListPage";
import PurchaseReturnCreatePage from "../features/procurement/pages/PurchaseReturnCreatePage";
import PurchaseReturnDetailPage from "../features/procurement/pages/PurchaseReturnDetailPage";
import PurchasingSettingsPage from "../features/procurement/pages/PurchasingSettingsPage";
import ProcurementRulesPage from "../features/procurement/pages/ProcurementRulesPage";
import ProcurementInboxPage from "../features/procurement/pages/ProcurementInboxPage";
import ProcurementQuotationsPage from "../features/procurement/pages/ProcurementQuotationsPage";
import FixedAssetsPage from "../features/fixed-assets/pages/FixedAssetsPage";
import SupplierPerformancePage from "../features/procurement/pages/SupplierPerformancePage";
import ProcurementBudgetsPage from "../features/procurement/pages/ProcurementBudgetsPage";
import SupplierAgreementsPage from "../features/procurement/pages/SupplierAgreementsPage";
import ProcurementPlanningPage from "../features/procurement/pages/ProcurementPlanningPage";
import ProcurementConsolidationPage from "../features/procurement/pages/ProcurementConsolidationPage";
import MobileReceivingPage from "../features/procurement/pages/MobileReceivingPage";
import SupplierPortalPage from "../features/procurement/pages/SupplierPortalPage";
import SupplierSubmissionsPage from "../features/procurement/pages/SupplierSubmissionsPage";

export type AppRoute = RouteObject & {
  label?: string;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  order?: number;
  permissions?: string[];
};

const PROCUREMENT_SECTION = "Procurement";

export const procurementRoutes: AppRoute[] = [
  {path:"procurement/supplier-portal",label:"Supplier Workspace",element:<SupplierPortalPage/>,icon:<Truck size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:95},
  {path:"procurement/supplier-submissions",label:"Supplier Submissions",element:<SupplierSubmissionsPage/>,icon:<FileText size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:55,permissions:["purchasing.view"]},
  {path:"procurement/receiving",label:"Receive Deliveries",element:<MobileReceivingPage/>,icon:<Truck size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:25,permissions:["purchasing.receiveinspect"]},
  {path:"procurement/consolidation",label:"Branch Consolidation",element:<ProcurementConsolidationPage/>,icon:<ShoppingCart size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:62,permissions:["purchasing.view"]},
  {path:"procurement/planning",label:"Purchasing Planning",element:<ProcurementPlanningPage/>,icon:<ClipboardCheck size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:60,permissions:["purchasing.view"]},
  {path:"procurement/agreements",label:"Supplier Agreements",element:<SupplierAgreementsPage/>,icon:<FileText size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:72,permissions:["purchasing.view"]},
  {path:"procurement/budgets",label:"Purchasing Budgets",element:<ProcurementBudgetsPage/>,icon:<LayoutDashboard size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:70,permissions:["purchasing.view"]},
  {path:"procurement/supplier-performance",label:"Supplier Performance",element:<SupplierPerformancePage/>,icon:<LayoutDashboard size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:65,permissions:["purchasing.view"]},
  {path:"procurement/assets",label:"Fixed Asset Register",element:<FixedAssetsPage/>,icon:<FileText size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:75,permissions:["fixedassets.view"]},
  {path:"procurement/quotations",label:"Supplier Quotations",element:<ProcurementQuotationsPage/>,icon:<FileText size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:15,permissions:["purchasing.view"]},
  {path:"procurement/quotations/:id",element:<ProcurementQuotationsPage/>,nav:false,permissions:["purchasing.view"]},
  {path:"procurement/inbox",label:"Purchasing Inbox",element:<ProcurementInboxPage/>,icon:<ClipboardCheck size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:6,permissions:["purchasing.view"]},
  {path:"procurement/rules",label:"Approval Rules",element:<ProcurementRulesPage/>,icon:<Settings2 size={18}/>,nav:true,section:PROCUREMENT_SECTION,order:85,permissions:["purchasing.manage"]},
  {
    path: "procurement/overview",
    label: "Purchasing Overview",
    element: <PurchasingDashboardPage />,
    icon: <LayoutDashboard size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 5,
    permissions: ["purchasing.view"],
  },
  {
    path: "procurement/requisitions",
    label: "Purchase Requisitions",
    element: <PurchaseRequisitionListPage />,
    icon: <ClipboardCheck size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 10,
    permissions: ["purchasing.view"],
  },
  {
    path: "procurement/requisitions/new",
    element: <PurchaseRequisitionEditorPage />,
    nav: false,
    permissions: ["purchasing.create"],
  },
  {
    path: "procurement/requisitions/:id/edit",
    element: <PurchaseRequisitionEditorPage />,
    nav: false,
    permissions: ["purchasing.create"],
  },
  {
    path: "procurement/requisitions/reorder",
    element: <PurchaseRequisitionCreatePage />,
    nav: false,
    permissions: ["purchasing.create"],
  },
  {
    path: "procurement/requisitions/:id",
    element: <PurchaseRequisitionDetailPage />,
    nav: false,
    permissions: ["purchasing.view"],
  },
  {
    path: "procurement/purchase-orders",
    label: "Purchase Orders",
    element: <PurchaseOrderListPage />,
    icon: <ShoppingCart size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 20,
    permissions: ["purchasing.view"],
  },
  { path: "procurement/purchase-orders/new", element: <PurchaseOrderEditorPage />, nav: false, permissions: ["purchasing.create"] },
  { path: "procurement/purchase-orders/:id/edit", element: <PurchaseOrderEditorPage />, nav: false, permissions: ["purchasing.create"] },
  { path: "procurement/purchase-orders/:id", element: <PurchaseOrderDetailPage />, nav: false, permissions: ["purchasing.view"] },
  {
    path: "procurement/supplier-invoices",
    label: "Supplier Invoices",
    element: <SupplierInvoiceListPage />,
    icon: <FileText size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 30,
    permissions: ["purchasing.view"],
  },
  { path: "procurement/supplier-invoices/new", element: <SupplierInvoiceCreatePage />, nav: false, permissions: ["purchasing.view"] },
  { path: "procurement/supplier-invoices/:id/edit", element: <SupplierInvoiceCreatePage />, nav: false, permissions: ["purchasing.view"] },
  { path: "procurement/supplier-invoices/:id", element: <SupplierInvoiceDetailPage />, nav: false, permissions: ["purchasing.view"] },
  {
    path: "procurement/purchase-returns",
    label: "Purchase Returns",
    element: <PurchaseReturnListPage />,
    icon: <PackageX size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 40,
    permissions: ["purchasing.view"],
  },
  { path: "procurement/purchase-returns/new", element: <PurchaseReturnCreatePage />, nav: false, permissions: ["purchasing.receiveinspect"] },
  { path: "procurement/purchase-returns/:id", element: <PurchaseReturnDetailPage />, nav: false, permissions: ["purchasing.view"] },
  {
    path: "procurement/suppliers",
    label: "Suppliers",
    element: <SupplierListPage />,
    icon: <Truck size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 50,
    permissions: ["suppliers.view"],
  },
  { path: "procurement/suppliers/new", element: <SupplierEditorPage />, nav: false, permissions: ["suppliers.create"] },
  { path: "procurement/suppliers/:supplierId", element: <SupplierEditorPage />, nav: false, permissions: ["suppliers.view"] },
  {
    path: "procurement/settings",
    label: "Purchasing Settings",
    element: <PurchasingSettingsPage />,
    icon: <Settings2 size={18} />,
    nav: true,
    section: PROCUREMENT_SECTION,
    order: 90,
    permissions: ["purchasing.view"],
  },
];
