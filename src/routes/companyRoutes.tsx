import RequirePermission from "../auth/RequirePermission";

import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";
import CompanySettingsPage from "../features/company/onboarding/CompanySettingsPage";

export const companyRoutes = [
  {
    path: "onboarding",
    element: <CompanyOnboardingModule />,
    nav: false,
    section: "Administration",
  },

  {
    path: "settings",
    element: <CompanySettingsPage />,
    label: "Company Settings",
    nav: true,
    section: "Administration",
  },

  {
    path: "organizations",
    element: (
      <RequirePermission permission="COMPANIES.VIEW">
        <OrgLocationsPage />
      </RequirePermission>
    ),
    label: "Organization Structure",
    nav: true,
    section: "Administration",
  },
];