// src/routes/companyRoutes.tsx
// Guarded ERP company routes.

import RequirePermission from "../auth/RequirePermission";
import RequireErpRole from "../auth/RequireErpRole";

import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";
import CompanySettingsPage from "../features/company/onboarding/CompanySettingsPage";

export const companyRoutes = [
  {
    path: "onboarding",
    element: (
      <RequireErpRole roles={["CompanyAdmin", "SystemAdmin"]}>
        <CompanyOnboardingModule />
      </RequireErpRole>
    ),
    nav: false,
    section: "Administration",
  },
  {
    path: "settings",
    element: (
      <RequireErpRole roles={["CompanyAdmin", "SystemAdmin"]}>
        <CompanySettingsPage />
      </RequireErpRole>
    ),
    label: "Company Settings",
    nav: false,
    section: "Administration",
    permissions: ["settings.view"],
  },
  {
    path: "organizations",
    element: (
      <RequirePermission permission="COMPANIES.VIEW">
        <RequireErpRole roles={["CompanyAdmin", "SystemAdmin"]}>
          <OrgLocationsPage />
        </RequireErpRole>
      </RequirePermission>
    ),
    label: "Organization Structure",
    nav: true,
    section: "Administration",
    permissions: ["companies.update"],
  },
];
