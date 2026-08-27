import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import GrnListPage from "../features/inventory/grn/pages/GrnListPage";
import GrnDraftEditorPage from "../features/inventory/grn/pages/GrnDraftEditorPage";
import GrnDetailPage from "../features/inventory/grn/pages/GrnDetailPage";

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
  order?: number;
  permissions?: string[];
};

const SECTION_INVENTORY = "Inventory";

function visibleRoute(
  path: string,
  label: string,
  element: ReactNode,
  order: number,
  permissions: string[],
): AppRoute {
  return {
    path,
    label,
    element,
    nav: true,
    section: SECTION_INVENTORY,
    order,
    permissions,
  };
}

function hiddenRoute(
  path: string,
  element: ReactNode,
  label?: string,
): AppRoute {
  return {
    path,
    label,
    element,
    nav: false,
    section: SECTION_INVENTORY,
  };
}

function grnRoutes(prefix: string, visible: boolean): AppRoute[] {
  const listPath = `${prefix}/grns`;

  return [
    visible
      ? visibleRoute(
          listPath,
          "Goods Receipts",
          <GrnListPage />,
          70,
          ["grn.view"],
        )
      : hiddenRoute(
          listPath,
          <GrnListPage />,
          "Goods Receipts",
        ),

    hiddenRoute(
      `${prefix}/grns/new`,
      <GrnDraftEditorPage />,
      "New Goods Receipt",
    ),

    hiddenRoute(
      `${prefix}/grns/:grnId/edit`,
      <GrnDraftEditorPage />,
      "Edit Goods Receipt",
    ),

    hiddenRoute(
      `${prefix}/grns/:grnId`,
      <GrnDetailPage />,
      "Goods Receipt Detail",
    ),
  ];
}

/**
 * Company-scoped SIV routes.
 *
 * Mounted beneath:
 * /companies/:companyId
 */
function companySivRoutes(
  prefix: string,
  visible: boolean,
): AppRoute[] {
  const listPath = `${prefix}/siv`;

  return [
    visible
      ? visibleRoute(
          listPath,
          "SIVs",
          <SivListPage />,
          80,
          ["siv.view"],
        )
      : hiddenRoute(
          listPath,
          <SivListPage />,
          "SIVs",
        ),

    hiddenRoute(
      `${prefix}/siv/approval/:sivId`,
      <SivApprovalPage />,
      "SIV Approval",
    ),

    hiddenRoute(
      `${prefix}/siv/open/:id`,
      <SivOpenRedirectPage />,
      "Open SIV Redirect",
    ),

    hiddenRoute(
      `${prefix}/siv/:sivId/details`,
      <SivDetailsPage />,
      "SIV Detail",
    ),

    hiddenRoute(
      `${prefix}/siv/:sivId/print`,
      <SivIssuedPrintPage />,
      "Print SIV",
    ),

    hiddenRoute(
      `${prefix}/siv/:sivId`,
      <SivOpenRedirectPage />,
      "Open SIV",
    ),
  ];
}

/**
 * Branch-scoped SIV draft routes.
 *
 * Mounted beneath:
 * /companies/:companyId/branches/:branchId
 */
function branchSivDraftRoutes(
  prefix: string,
): AppRoute[] {
  return [
    hiddenRoute(
      `${prefix}/siv/drafts/new`,
      <SivDraftEditorPage mode="create" />,
      "New SIV Draft",
    ),

    hiddenRoute(
      `${prefix}/siv/drafts/:draftId/edit`,
      <SivDraftEditorPage mode="edit" />,
      "Edit SIV Draft",
    ),

    // Optional compatibility route.
    hiddenRoute(
      `${prefix}/siv/drafts/:draftId`,
      <SivDraftEditorPage mode="edit" />,
      "Edit SIV Draft",
    ),
  ];
}

export function useGrnRoutes(): AppRoute[] {
  return [
    // Mounted below /companies/:companyId
    ...grnRoutes("", true),
    ...companySivRoutes("", true),

    // These paths include the nested branch segment.
    ...branchSivDraftRoutes("/branches/:branchId"),
  ];
}
