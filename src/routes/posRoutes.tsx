// src/routes/posRoutes.tsx
import { PosSalesPage, PosSessionPage, PosOperationsPage, PosTablesSetupPage } from "../features/pos";
import type { AppRoute } from "./sales-cogsroute";

export function getPostRoutes(): AppRoute[] {
  return [
    {
      path: "sales/pos",
      element: <PosSalesPage />,
      label: "POS",
      section: "Sales",
      nav: true,
      permissions: ["pos.sell"],
    },
    {
      path: "sales/pos/session",
      element: <PosSessionPage />,
      label: "POS Session",
      section: "Sales",
      nav: true,
      permissions: ["pos.close"],
    },
    {
      path: "sales/pos/operations",
      element: <PosOperationsPage />,
      label: "POS Operations",
      section: "Sales",
      nav: true,
      permissions: ["pos.view"],
    },
    {
      path: "sales/pos/tables",
      element: <PosTablesSetupPage />,
      label: "POS Tables",
      section: "Sales",
      nav: true,
      permissions: ["tables.view"],
    },
  ];
}
