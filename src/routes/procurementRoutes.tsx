import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";

import PurchaseRequisitionListPage from "../features/procurement/pages/PurchaseRequisitionListPage";
import PurchaseRequisitionCreatePage from "../features/procurement/pages/PurchaseRequisitionCreatePage";
import PurchaseRequisitionDetailPage from "../features/procurement/pages/PurchaseRequisitionDetailPage";

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
];
