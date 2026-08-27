import type { AppRoute } from "../routes/sales-cogsroute";

import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";

export const organizationRoutes: AppRoute[] = [
  {
    path: "organizations",
    element: <OrgLocationsPage />,

    nav: true,
    label: "Organizations",
    section: "Settings",
    order: 10,
  },
];