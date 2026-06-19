import type { AppRoute } from "../routes/sales-cogsroute";

import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";

export const organizationRoutes: AppRoute[] = [
  {
    path: "organizations",
    element: <OrgLocationsPage />,

    nav: true,
    label: "Organizations",
    section: "Settings",
    order: 10,
  },

  {
    path: "onboarding",
    element: <CompanyOnboardingModule />,

    nav: true,
    label: "Company Onboarding",
    section: "Settings",
    order: 11,
  },

  {
    path: "branches/:branchId/onboarding",
    element: <CompanyOnboardingModule />,

    nav: true,
    label: "Branch Onboarding",
    section: "Settings",
    order: 12,
  },
];