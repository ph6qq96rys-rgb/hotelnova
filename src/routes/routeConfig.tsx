import type { RouteObject } from "react-router-dom";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, Shield, Settings, Building2 } from "lucide-react";

import DashboardPage from "../pages/DashboardPage";
import UsersPage from "../features/identity/users/pages/UsersPage"
import RolesPage from "../pages/RolesPage";
import PermissionsPage from "../pages/PermissionsPage";

import SettingsPage from "../pages/SettingsPage";
import CompaniesPage from "../features/company/pages/CompaniesPage";
import InventoryMasterHomePage from '../features/inventoryMaster/pages/InventoryMasterHomePage';
import UomsPage from '../features/inventoryMaster/pages/UomsPage';
import CategoriesPage from '../features/inventoryMaster/pages/CategoriesPage';
import InventoryItemsPage from '../features/inventoryMaster/items/pages/InventoryItemsPage';
import InventoryLedgerPage from "../features/inventory/ledger/pages/InventoryLedgerPage";

// Pages
import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import StockTransferEditPage from "../features/inventory/stock-transfers/pages/StockTransferEditPage";
import StockTransfersPage from "../features/inventory/stock-transfers/pages/StockTransfersPage"
import StockTransferApprovalsPage from "../features/inventory/stock-transfers/pages/StockTransferApprovalsPage";
import StockTransferCreatePage from "../features/inventory/stock-transfers/pages/StockTransferCreatePage";
import ProductionBatchPage from "../features/production/pages/ProductionBatchPage";
import RecipeEditorPage from "../features/production/pages/RecipeEditorPage"
import ItemsPage from "../features/inventoryMaster/items/pages/ItemsPage";
import ItemUpsertPage from "../features/inventoryMaster/items/pages/ItemUpsertPage";
import MenuItemCreatePage from "../features/production/pages/MenuItemCreatePage"
import MenuItemDetailPage from "../features/production/pages/MenuItemDetailPage";

import AssignAccessPage from "../pages/RolesPermissionsPage";
import BranchSetupWizardPage from "../features/company/pages/BranchSetupWizardPage";
import StoreLocationSetupPage from "../features/company/pages/StoreLocationSetupPage";
import SetupLayout from "../features/company/pages/SetupLayout";
import CompanySettingsPage from "../features/company/pages/Companysettingspage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import RolesPermissionsPage from "../features/security/pages/RolesPermissionsPage";
import AdjustmentListPage from "../features/inventory/adjustments/pages/AdjustmentListPage";
import AdjustmentDetailsPage from "../features/inventory/adjustments/pages/AdjustmentDetailsPage";
import AdjustmentApprovalPage from "../features/inventory/adjustments/pages/AdjustmentApprovalPage";
import AdjustmentDraftEditorPage from "../features/inventory/adjustments/pages/AdjustmentDraftEditorPage";




 export type AppRoute = RouteObject & {
  path?: string;              // absolute path: "/users"
  label?: string;             // sidebar label
  element?: ReactNode;        // route element
  icon?: ReactNode;          // sidebar icon
  nav?: boolean;             // show in sidebar?
  section?: string;          // sidebar grouping header
  roles?: string[];          // optional RBAC
  permissions?: string[];    // optional PBAC
   menu?: {
    label: string;
    icon?: ReactNode;
    permission?: string;   // e.g. "users.view"
    section?: string;      // optional grouping in sidebar
  };
};

export const routeConfig: AppRoute[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    element: <DashboardPage />,
    icon: <LayoutDashboard size={18} />,
    nav: true,
    section: "General",
  },

  {
    path: "/companies",
    label: "Companies",
    element: <CompaniesPage />,
    icon: <Building2 size={18} />,
    nav: true,
    section: "Company",
    //permissions: ["companies.view"], // (DEV mode: you can ignore permissions in sidebar filter)
  },
  {
    path: "/branchies",
    label: "Setup Branch",
    element: <BranchSetupWizardPage />,
    icon: <Building2 size={18} />,
    nav: true,
    section: "Company",
   // permissions: ["companies.view"], // (DEV mode: you can ignore permissions in sidebar filter)
  },
 
  {
      path: "/companies/:companyId/branches/:branchId/setup",
      element: <SetupLayout />,
      children: [
        { index: true, 
          element: <BranchSetupWizardPage />
         },
        { path: "store-location", 
          element: <StoreLocationSetupPage /> 
        },

      ]
    },
    
  {
    path: "/users",
    label: "Users",
    element: <UsersPage />,
    icon: <Users size={18} />,
    nav: true,
    section: "Identity",
   permissions: ["users.view"],
  },
  {
    path: "/register",
    label: "Register",
    element: <RegisterPage />,
  },
  {
    path: "/forgot-password",
    label: "Forgot Password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    label: "Reset Password",
    element: <ResetPasswordPage />,
  },

  {
    path: "/roles",
    label: "Roles",
    element: <RolesPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Identity",
    permissions: ["roles.view"],
  },
{
    path: "/Permissions",
    label: "Permissions",
    element: <PermissionsPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Identity",
    permissions: ["permissions.view"],
  },
  
  {
    path: "/RolesPermissions",
    label: "RolesPermissions",
    element: <RolesPermissionsPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Identity",
    permissions: ["roles.view"],
  },
   {
    path: "/companies/:companyId/access-control",
    label: "Assign Access",
    element: <AssignAccessPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Identity",
    permissions: ["roles.view"],
  },
  // ✅ Inventory
{
  path: "/inventory-master",
  label: "Inventory",
  element: <InventoryMasterHomePage />,
  icon: <Settings size={18} />,
  nav: true,
  section: "Inventory",
 permissions: ["inventory.view"],
},
{
  path: "/inventory-master/uoms",
  label: "Units of Measure",
  element: <UomsPage />,
  icon: <Settings size={18} />,
  nav: false,
  section: "Inventory",
  permissions: ["inventory.view"],
},
{
  path: "/inventory-master/items",
  label: "Items",
  element: <InventoryItemsPage />,
  icon: <Settings size={18} />,
  nav: true,
  section: "Inventory",
  permissions: ["inventory.view"],
},

{
  path: "/inventory-master/leger",
  label: "Inventory Ledger",
  element: <InventoryLedgerPage />,
  icon: <Settings size={18} />,
  nav: true,
  section: "Inventory",
  permissions: ["inventory.view"],
},

{
  path: "/inventory-master/categories",
  label: "Categories",
  element: <CategoriesPage />,
  icon: <Settings size={18} />,
  nav: false,
  section: "Inventory",
  permissions: ["inventory.view"],
},

{
  path: "/stock-transfers",
  label: "Stock Transfers",
  element: <StockTransfersPage />,
  icon: <Settings size={18} />,
  nav: true,
  section: "Inventory",
  permissions: ["inventory.view"],
},
{
  path: "/inventory/stock-transfers/new",
  label: "New Transfer",
  element: <StockTransferCreatePage />,
  icon: <Settings size={18} />,
  nav: false,
  section: "Stock Transfers",
  permissions: ["inventory.view"],
},
{
  path: "/inventory/stock-transfers/:id",
  label: "Transfer Detail",
  element: <StockTransferEditPage />,
  nav: false,
  section: "Stock Transfers",
  permissions: ["inventory.view"],
},
{
  path: "/inventory/stock-transfers/:id/edit",
  label: "Edit Transfer",
  element: <StockTransferEditPage />,
  nav: false,
  section: "Stock Transfers",
  permissions: ["inventory.view"],
},
{
  path: "/inventory/inventory/stock-transfers/approvals",
  label: "Stock Transfer Approvals",
  element: <StockTransferApprovalsPage />,
  nav: false,
  section: "Stock Transfers",
  permissions: ["inventory.view"],
},
{
  path: "/inventory/adjustments",
  element: <AdjustmentListPage />,
  nav: true,
  section: "Inventory",
  permissions: ["inventory.view"],
  label: "Inventory Adjustments",
},
{
  path: "/inventory/adjustments/new",
  element: <AdjustmentDraftEditorPage />,
},
{
  path: "/inventory/adjustments/drafts/:adjustmentId",
  element: <AdjustmentDraftEditorPage />,
},
{
  path: "/inventory/adjustments/:adjustmentId/edit",
  element: <AdjustmentDraftEditorPage />,
},
{
  path: "/inventory/adjustments/:adjustmentId",
  element: <AdjustmentDetailsPage />,
},
{
  path: "/inventory/adjustments/:adjustmentId/approve",
  element: <AdjustmentApprovalPage />,
},

{ path:"/inventory/items", 
  label:"Item Enrollment", 
  element:<ItemsPage />, 
  nav:true,
  section:"Inventory"
},
{ path:"/inventory/items/new",
   label:"New Item Enrollment", 
   element:<ItemUpsertPage/>,
   nav:false,
    section:"Inventory"
  },
{ path:"/inventory/items/:id", 
  label:"Edit Item Enrollment", 
  element:<ItemUpsertPage/>,
  nav:true, 
  section:"Inventory"
},

{
  path:"/production/batches/new",
  label:"Production",
  element:<ProductionBatchPage/>,
  nav:true,
  section:"Production",
 permissions:["inventory.view"],
},
{
  path:"/production/batches/:batchId",
  label:"Production",
  element:<ProductionBatchPage/>,
  nav:true,
  section:"Production",
 permissions:["inventory.view"],
},
{
  path: "/production/menu/items/new",
  label:"Create Menu",
  element: <MenuItemCreatePage />,
  nav:true,
  section:"Production",
},

{
  path: "/production/menu/items/:id",
  element: <MenuItemDetailPage />,
  nav:false,
  section:"Production",
},

{
  path: "/production/menu/items/:id/recipe",
  element: <RecipeEditorPage />,
  nav:false,
  section:"Production",
},
//Organazation & Locations
{
  path: "/org",
  label: "Locations",
  element: <OrgLocationsPage />,
  menu: { label: "Organization & Locations", 
    icon: <Building2 size={18} />, 
  //  permission: "inventory.view", 
    section: "Setup" },
},
//Settings
  {
    path: "/settings",
    label: "Settings",
    element: <SettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "System",
  },
  {
    path: "/companies/:companyId/settings",
    label: "Company SettingsPage",
    element: <CompanySettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "System",
  }
]  
