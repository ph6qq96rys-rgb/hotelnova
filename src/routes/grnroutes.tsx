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
  order?: number;
};

const SECTION_INVENTORY = "Inventory";

function visibleRoute(
  path: string,
  label: string,
  element: ReactNode,
  order: number
): AppRoute {
  return {
    path,
    label,
    element,
    nav: true,
    section: SECTION_INVENTORY,
    order,
  };
}

function hiddenRoute(
  path: string,
  element: ReactNode,
  label?: string
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
  return [
    visible
      ? visibleRoute(`${prefix}/grns`, "GRNs", <GrnListPage />, 70)
      : hiddenRoute(`${prefix}/grns`, <GrnListPage />, "GRNs"),

    hiddenRoute(`${prefix}/grns/drafts`, <GrnDraftListPage />, "GRN Drafts"),
    hiddenRoute(`${prefix}/grns/drafts/new`, <GrnDraftEditorPage />, "New GRN Draft"),
    hiddenRoute(`${prefix}/grns/drafts/:draftId`, <GrnDraftEditorPage />, "Edit GRN Draft"),
    hiddenRoute(`${prefix}/grns/reverse`, <GrnReversePage />, "Reverse GRN"),
    hiddenRoute(`${prefix}/grns/:grnId`, <GrnDetailPage />, "GRN Detail"),
  ];
}

function sivRoutes(prefix: string, visible: boolean): AppRoute[] {
  return [
    visible
      ? visibleRoute(`${prefix}/siv`, "SIVs", <SivListPage />, 80)
      : hiddenRoute(`${prefix}/siv`, <SivListPage />, "SIVs"),

    hiddenRoute(`${prefix}/siv/drafts/new`, <SivDraftEditorPage mode="create" />, "New SIV Draft"),
    hiddenRoute(`${prefix}/siv/drafts/:draftId/edit`, <SivDraftEditorPage mode="edit" />, "Edit SIV Draft"),
    hiddenRoute(`${prefix}/siv/drafts/:draftId`, <SivDraftEditorPage mode="edit" />, "Edit SIV Draft"),
    hiddenRoute(`${prefix}/siv/approval/:sivId`, <SivApprovalPage />, "SIV Approval"),
    hiddenRoute(`${prefix}/siv/open/:id`, <SivOpenRedirectPage />, "Open SIV Redirect"),
    hiddenRoute(`${prefix}/siv/open/:sivId/details`, <SivDetailsPage />, "Open SIV"),
    hiddenRoute(`${prefix}/siv/:sivId/print`, <SivIssuedPrintPage />, "Print SIV"),
    hiddenRoute(`${prefix}/siv/:sivId`, <SivDetailsPage />, "SIV Detail"),
  ];
}

export function useGrnRoutes(): AppRoute[] {
  return [
    ...grnRoutes("", true),
    ...sivRoutes("", true),

    ...grnRoutes("branches/:branchId", false),
    ...sivRoutes("branches/:branchId", false),
  ];
}