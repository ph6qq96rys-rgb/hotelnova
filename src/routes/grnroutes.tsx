import GrnListPage from "../features/inventory/grn/pages/GrnListPage";
import GrnDraftListPage from "../features/inventory/grn/pages/GrnDraftListPage";
import GrnDraftEditorPage from "../features/inventory/grn/pages/GrnDraftEditorPage";
import GrnDetailPage from "../features/inventory/grn/pages/GrnDetailPage";
import GrnReversePage from "../features/inventory/grn/pages/GrnReversePage";
//import GrnDraftEditorPage from "../features/inventory/grn/pages/GrnCreatePage";
import type { RouteObject } from "react-router-dom";
import type { ReactNode } from "react";


export type AppRoute = RouteObject & {
  path?: string;              // absolute path: "/users"
  label?: string;             // sidebar label
  element?: ReactNode;        // route element
  icon?: ReactNode;          // sidebar icon
  nav?: boolean;             // show in sidebar?
  section?: string;          // sidebar grouping header
  roles?: string[];          // optional RBAC
  permissions?: string[];    // optional PBAC
   menu?: {
    label: string;
    icon?: ReactNode;
    permission?: string;   // e.g. "users.view"
    section?: string;      // optional grouping in sidebar
  };
};
export const grnRoutes: AppRoute[] = [
  { path: "/companies/:companyId/grns/drafts", 
    element: <GrnDraftListPage /> ,
    label: "GRN Drafts",
        nav: false,
    menu: {
      label: "GRN Drafts",}
 },
  { path: "/companies/:companyId/grns/drafts/new", 
    element: <GrnDraftEditorPage mode="new" />,
    label: "New GRN Draft",
        nav: false,
},
  { path: "/companies/:companyId/grns/drafts/:draftId", 
    element: <GrnDraftEditorPage mode="edit" />,
    label: "Edit GRN Draft",
        nav: false,
},

  { path: "/companies/grns", 
    element: <GrnListPage />,
    label: "GRNs",
        nav: true,
    menu: {
      label: "GRNs",}
 },
  { path: "/companies/:companyId/grns/:grnId", 
    element: <GrnDetailPage />,
    label: "GRN Detail",
        nav: false,
 },

  { path: "/companies/:companyId/grns/reverse", 
    element: <GrnReversePage />,
    label: "Reverse GRN",
        nav: false,
    menu: {
      label: "Reverse GRN",}
},
];
