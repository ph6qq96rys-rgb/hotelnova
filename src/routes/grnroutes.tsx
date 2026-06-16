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

const SECTION_INVENTORY = "Inventory";

const companyBase = "/companies/:companyId";
const branchBase = "/companies/:companyId/branches/:branchId";

const grnBase = `${companyBase}/grns`;
const branchGrnBase = `${branchBase}/grns`;

const sivBase = `${companyBase}/siv`;
const branchSivBase = `${branchBase}/siv`;

function grnRoutes(base: string, nav: boolean): AppRoute[] {
  return [
    {
      path: base,
      element: <GrnListPage />,
      label: "GRNs",
      nav,
      section: SECTION_INVENTORY,
      menu: { label: "GRNs", section: SECTION_INVENTORY },
    },
    {
      path: `${base}/drafts`,
      element: <GrnDraftListPage />,
      label: "GRN Drafts",
      nav: false,
      section: SECTION_INVENTORY,
      menu: { label: "GRN Drafts", section: SECTION_INVENTORY },
    },
    {
      path: `${base}/drafts/new`,
      element: <GrnDraftEditorPage />,
      label: "New GRN Draft",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/drafts/:draftId`,
      element: <GrnDraftEditorPage />,
      label: "Edit GRN Draft",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/reverse`,
      element: <GrnReversePage />,
      label: "Reverse GRN",
      nav: false,
      section: SECTION_INVENTORY,
      menu: { label: "Reverse GRN", section: SECTION_INVENTORY },
    },
    {
      path: `${base}/:grnId`,
      element: <GrnDetailPage />,
      label: "GRN Detail",
      nav: false,
      section: SECTION_INVENTORY,
    },
  ];
}

function sivRoutes(base: string, nav: boolean): AppRoute[] {
  return [
    {
      path: base,
      element: <SivListPage />,
      label: "SIVs",
      nav,
      section: SECTION_INVENTORY,
      menu: { label: "SIVs", section: SECTION_INVENTORY },
    },
    {
      path: `${base}/drafts/new`,
      element: <SivDraftEditorPage mode="create" />,
      label: "New SIV Draft",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/drafts/:draftId/edit`,
      element: <SivDraftEditorPage mode="edit" />,
      label: "Edit SIV Draft",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/drafts/:draftId`,
      element: <SivDraftEditorPage mode="edit" />,
      label: "Edit SIV Draft",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/approval/:sivId`,
      element: <SivApprovalPage />,
      label: "SIV Approval",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/open/:id`,
      element: <SivOpenRedirectPage />,
      label: "Open SIV Redirect",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/open/:sivId/details`,
      element: <SivDetailsPage />,
      label: "Open SIV",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/:sivId/print`,
      element: <SivIssuedPrintPage />,
      label: "Print SIV",
      nav: false,
      section: SECTION_INVENTORY,
    },
    {
      path: `${base}/:sivId`,
      element: <SivDetailsPage />,
      label: "SIV Detail",
      nav: false,
      section: SECTION_INVENTORY,
    },
  ];
}

export function useGrnRoutes(): AppRoute[] {
  return [
    ...grnRoutes(grnBase, true),
    ...grnRoutes(branchGrnBase, false),

    ...sivRoutes(sivBase, true),
    ...sivRoutes(branchSivBase, false),
  ];
}