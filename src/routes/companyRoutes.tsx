import RequirePermission from "../auth/RequirePermission";


import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";

import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";
import CompanySettingsPage from "../features/company/onboarding/CompanySettingsPage";

export const companyRoutes = [
  // =========================================================
  // Companies
  // =========================================================

  

  // =========================================================
  // ERP Onboarding
  // =========================================================

  {
    path: "companies/new",
    element: (
      // <RequirePermission permission="companies.create">
      <CompanyOnboardingModule />
      // </RequirePermission>
    ),
  },

  {
    path: "companies/onboarding",
    label: "Company Onboarding",
    nav: true,
    element: (
      // <RequirePermission permission="companies.create">
      <CompanyOnboardingModule />
      // </RequirePermission>
    ),

  },

  {
    path: "companies/:companyId/onboarding",
    element: (
      // <RequirePermission permission="companies.update">
      <CompanyOnboardingModule />
      // </RequirePermission>
    ),
  },

  {
    path: "companies/:companyId/branches/:branchId/onboarding",
    element: (
      // <RequirePermission permission="branches.update">
      <CompanyOnboardingModule />
      // </RequirePermission>
    ),
  },

  // =========================================================
  // Company Settings
  // =========================================================

  {
    path: "companies/:companyId/settings",
    element: (
      // <RequirePermission permission="companies.update">
      <CompanySettingsPage />
      // </RequirePermission>
    ),
  },

  // =========================================================
  // Organization
  // =========================================================

  {
    path: "organizations",
    element: (
      <RequirePermission permission="companies.view">
        <OrgLocationsPage />
      </RequirePermission>
    ),
  },
];