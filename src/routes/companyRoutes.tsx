import CompaniesPage from "../features/company/pages/CompaniesPage";
import CompanyDetailPage from "../features/company/pages/CompanyDetailPage";
import CompanyOnboardingWizardPage from "../features/company/pages/CompanyOnboardingWizardPage";
import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import RequirePermission from "../auth/RequirePermission";
import BranchSetupWizardPage from "../features/company/pages/BranchSetupWizardPage"

export const companyRoutes = [
  {
    path: "companies",
    element:<CompaniesPage /> /*(
      <RequirePermission permission="companies.view">
        <CompaniesPage />
      </RequirePermission>
    )*/,
  },
  {
    path: "companies/new",
    element: (
      <RequirePermission permission="companies.create">
        <CompanyOnboardingWizardPage />
      </RequirePermission>
    ),
  },
  {
    path: "companies/:companyId",
    element: (
      <RequirePermission permission="companies.view">
        <CompanyDetailPage />
      </RequirePermission>
    ),
  },
 
 
  {
    path: "organizations",
    element: (
      <RequirePermission permission="companies.view">
        <OrgLocationsPage />
      </RequirePermission>
    ),
  },
];

export const BranchRoutes = [

 {
        path:"/companies/:companyId/branches/:branchId/setup",
        element:<BranchSetupWizardPage />
  },
]