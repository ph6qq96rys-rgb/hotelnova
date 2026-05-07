import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import GrnListPage from "../features/inventory/grn/pages/GrnListPage";
import GrnDraftListPage from "../features/inventory/grn/pages/GrnDraftListPage";
import GrnDraftEditorPage from "../features/inventory/grn/pages/GrnDraftEditorPage";
import GrnDetailPage from "../features/inventory/grn/pages/GrnDetailPage";
import GrnReversePage from "../features/inventory/grn/pages/GrnReversePage";

import SivListPage from "../features/inventory/siv/pages/SivListPage";
import SivDraftEditorPage from "../features/inventory/siv/pages/SivDraftEditorPage";
import SivDetailsPage from "../features/inventory/siv/pages/SivDetailsPage";
import SivApprovalListPage from "../features/inventory/siv/pages/SivApprovalListPage";
import SivApprovalPage from "../features/inventory/siv/pages/SivApprovalPage";
import SivOpenRedirectPage from "../features/inventory/siv/pages/SivOpenRedirectPage";
import SivIssuedPrintPage from "../features/inventory/siv/pages/SivIssuedPrintPage";

export type AppRoute = RouteObject & {
  path?: string;
  label?: string;
  element?: ReactNode;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  roles?: string[];
  permissions?: string[];
  menu?: {
    label: string;
    icon?: ReactNode;
    permission?: string;
    section?: string;
  };
};

export function useInventoryRoutes(): AppRoute[] {
  return [
    /* -----------------------------
     * GRN
     * ----------------------------- */
    
  {
    path: "/companies/:companyId/grns",
    element: <GrnListPage />,
    label: "GRNs",
    nav: true,
    section: "Inventory",
    menu: { label: "GRNs", section: "Inventory" },
  },

  // --- DRAFTS ---
  {
    path: "/companies/:companyId/grns/drafts",
    element: <GrnDraftListPage />,
    label: "GRN Drafts",
    nav: false,
    section: "Inventory",
    menu: { label: "GRN Drafts", section: "Inventory" },
  },
  {
    path: "/companies/:companyId/grns/drafts/new",
    element: <GrnDraftEditorPage />,
    label: "New GRN Draft",
    nav: false,
    section: "Inventory",
  },
  {
    path: "/companies/:companyId/grns/drafts/:draftId",
    element: <GrnDraftEditorPage />,
    label: "Edit GRN Draft",
    nav: false,
    section: "Inventory",
  },

  // --- SPECIAL ROUTES (must come BEFORE :grnId) ---
  {
    path: "/companies/:companyId/grns/reverse",
    element: <GrnReversePage />,
    label: "Reverse GRN",
    nav: false,
    section: "Inventory",
    menu: { label: "Reverse GRN", section: "Inventory" },
  },

  // --- DETAIL (keep LAST to avoid conflicts) ---
  {
    path: "/companies/:companyId/grns/:grnId",
    element: <GrnDetailPage />,
    label: "GRN Detail",
    nav: false,
    section: "Inventory",
  },

 
/* -----------------------------
 * SIV
 * ----------------------------- */
{
  path: "/companies/:companyId/siv",
  element: <SivListPage />,
  label: "SIVs",
  nav: true,
  section: "Inventory",
  menu: { label: "SIVs", section: "Inventory" },
},
{
  path: "/companies/:companyId/siv/drafts/new",
  element: <SivDraftEditorPage mode="create" />,
  label: "New SIV Draft",
  nav: false,
  section: "Inventory",

},
{
  path: "/companies/:companyId/siv/drafts/:draftId/edit",
  element: <SivDraftEditorPage mode="edit" />,
  label: "Edit SIV Draft",
  nav: false,
  section: "Inventory",
},
{
  path: "/companies/:companyId/siv/drafts/:draftId",
  element: <SivDraftEditorPage mode="edit" />,
  label: "Edit SIV Draft",
  nav: false,
  section: "Inventory",
},
{
  path: "/companies/:companyId/siv/for-approval",
  element: <SivApprovalListPage />,
  label: "SIV Approval Queue",
  nav: true,
  section: "Inventory",
  menu: { label: "SIV Approval Queue", section: "Inventory" },
},
{
  path: "/companies/:companyId/siv/approval/:sivId",
  element: <SivApprovalPage />,
  label: "SIV Approval",
  nav: false,
  section: "Inventory",
},
{
  path: "/companies/:companyId/siv/open/:sivId",
  element: <SivDetailsPage />,
  label: "Open SIV",
  nav: false,
  section: "Inventory",
},
{
  path: "/companies/:companyId/siv/:sivId",
  element: <SivDetailsPage />,
  label: "SIV Detail",
  nav: false,
  section: "Inventory",
},
    {
  path: "/companies/:companyId/siv/:sivId/print",
  element: <SivIssuedPrintPage />,
  label: "Print SIV",
  nav: false,
  section: "Inventory",
},
{
  path: "/companies/:companyId/siv/open/:id",
  element: <SivOpenRedirectPage />,
  label: "Open SIV Redirect",
  nav: false,
  section: "Inventory",
}
  ];
}