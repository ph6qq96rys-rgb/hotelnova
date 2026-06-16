import RequirePermission from "../auth/RequirePermission";

import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";
import CompanySettingsPage from "../features/company/onboarding/CompanySettingsPage";

export const companyRoutes = [
  {
    path: "companies/onboarding",
    element: <CompanyOnboardingModule />,
    label: "Company Setup",
    nav: true,
    section: "Administration",
  },

  {
    path: "companies/:companyId/onboarding",
    element: <CompanyOnboardingModule />,
    nav: false,
    section: "Administration",
  },

  {
    path: "companies/:companyId/settings",
    element: <CompanySettingsPage />,
    label: "Company Settings",
    nav: true,
    section: "Administration",
  },

  {
    path: "organizations",
    element: (
      <RequirePermission permission="companies.view">
        <OrgLocationsPage />
      </RequirePermission>
    ),
    label: "Organization Structure",
    nav: true,
    section: "Administration",
  },
];