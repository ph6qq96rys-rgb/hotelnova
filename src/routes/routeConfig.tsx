// src/routes/routeConfig.tsx

import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import {
  ArrowLeftRight,
  Building2,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Shield,
  Sliders,
  Upload,
  Users,
} from "lucide-react";

import DashboardPage from "../pages/DashboardPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";

import SettingsPage from "../modules/security/pages/SettingsPage";
import UsersPage from "../modules/security/pages/UsersPage";
import RolesPermissionsPage from "../modules/security/pages/RolesPermissionsPage";

import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";

import InventoryControlSettingsPage from "../features/inventory/settings/pages/InventoryControlSettingsPage";

import StockTransfersPage from "../features/inventory/stock-transfers/pages/StockTransfersPage";
import StockTransferCreatePage from "../features/inventory/stock-transfers/pages/StockTransferCreatePage";
import StockTransferDetailPage from "../features/inventory/stock-transfers/pages/StockTransferDetailPage";
import StockTransferEditPage from "../features/inventory/stock-transfers/pages/StockTransferEditPage";
import StockTransferApprovalsPage from "../features/inventory/stock-transfers/pages/StockTransferApprovalsPage";

import AdjustmentListPage from "../features/inventory/adjustments/pages/AdjustmentListPage";
import AdjustmentDetailsPage from "../features/inventory/adjustments/pages/AdjustmentDetailsPage";
import AdjustmentApprovalPage from "../features/inventory/adjustments/pages/AdjustmentApprovalPage";
import AdjustmentDraftEditorPage from "../features/inventory/adjustments/pages/AdjustmentDraftEditorPage";

import ProductionBatchPage from "../features/production/pages/ProductionBatchPage";
import RecipeEditorPage from "../features/production/pages/RecipeEditorPage";
import MenuItemCreatePage from "../features/production/pages/MenuItemCreatePage";
import MenuItemDetailPage from "../features/production/pages/MenuItemDetailPage";
import MenuCategoriesPage from "../features/production/pages/MenuCategoriesPage";
import MenuEngineeringPage from "../features/production/pages/MenuEngineeringPage";

import FnbControlCenterPage from "../features/reports/fnb/pages/FnbControlCenterPage";
import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import TelegramMiniAppDashboard from "../features/telegram-miniapp/TelegramMiniAppDashboard";

export type AppRoute = RouteObject & {
  path?: string;
  label?: string;
  element?: ReactNode;
  icon?: ReactNode;
  nav?: boolean;
  section?: string;
  roles?: string[];
  permissions?: string[];
  order?: number;
  menu?: {
    label?: string;
    section?: string;
    order?: number;
  };
};

export const appPaths = {
  dashboard: "dashboard",

  users: "users",
  rolesPermissions: "roles-permissions",

  orgLocations: "org",
  companyOnboarding: "onboarding",
  branchOnboarding: "branches/:branchId/onboarding",

  inventorySettings: "inventory/control-settings",

  stockTransfers: "inventory/stock-transfers",
  stockTransferNew: "inventory/stock-transfers/new",
  stockTransferApprovals: "inventory/stock-transfers/approvals",
  stockTransferDetail: "inventory/stock-transfers/:id",
  stockTransferEdit: "inventory/stock-transfers/:id/edit",

  adjustments: "inventory/adjustments",
  adjustmentNew: "inventory/adjustments/new",
  adjustmentDraft: "inventory/adjustments/drafts/:adjustmentId",
  adjustmentEdit: "inventory/adjustments/:adjustmentId/edit",
  adjustmentDetail: "inventory/adjustments/:adjustmentId",
  adjustmentApprove: "inventory/adjustments/:adjustmentId/approve",

  menuCategories: "production/menu/categories",
  menuItemNew: "production/menu/items/new",
  menuItemDetail: "production/menu/items/:id",
  recipeManagement: "production/recipes",
  menuItemRecipe: "production/menu/items/:id/recipe",
  productionBatches: "production/batches",
  productionBatchNew: "production/batches/new",
  productionBatchDetail: "production/batches/:batchId",
  menuEngineering: "production/menu-engineering",

  inventoryItems: "inventory-master/items",
  inventoryItemNew: "inventory-master/items/new",
  inventoryItemImport: "inventory-master/items/import",
  inventoryItemEdit: "inventory-master/items/:itemId/edit",

  reportsFnb: "reports/fnb",
  telegram: "telegram",
  settings: "settings",
} as const;

export const dashboardQuickActionPaths = {
  stockTransferNew: appPaths.stockTransferNew,
  adjustmentNew: appPaths.adjustmentNew,
  productionBatchNew: appPaths.productionBatchNew,
  recipeManagement: appPaths.recipeManagement,
  menuEngineering: appPaths.menuEngineering,
} as const;

export const publicRoutes: AppRoute[] = [
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
];

export const routeConfig: AppRoute[] = [
  {
    path: appPaths.dashboard,
    label: "Dashboard",
    element: <DashboardPage />,
    icon: <LayoutDashboard size={18} />,
    nav: true,
    section: "General",
    order: 10,
  },

  {
    path: appPaths.orgLocations,
    label: "Organization",
    element: <OrgLocationsPage />,
    icon: <Building2 size={18} />,
    nav: true,
    section: "Setup",
    order: 10,
  },

  {
    path: appPaths.companyOnboarding,
    label: "Company Onboarding",
    element: <CompanyOnboardingModule />,
    icon: <ClipboardList size={18} />,
    nav: true,
    section: "Setup",
    order: 20,
  },

  {
    path: appPaths.branchOnboarding,
    label: "Branch Onboarding",
    element: <CompanyOnboardingModule />,
    icon: <ClipboardList size={18} />,
    nav: false,
    section: "Setup",
    order: 30,
  },

  {
    path: appPaths.users,
    label: "Users",
    element: <UsersPage />,
    icon: <Users size={18} />,
    nav: true,
    section: "Identity",
    order: 10,
  },

  {
    path: appPaths.rolesPermissions,
    label: "Roles & Permissions",
    element: <RolesPermissionsPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Identity",
    order: 20,
  },

  {
    path: appPaths.inventorySettings,
    label: "Inventory Control Settings",
    element: <InventoryControlSettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "Inventory",
    order: 40,
  },

  {
    path: appPaths.stockTransfers,
    label: "Stock Transfers",
    element: <StockTransfersPage />,
    icon: <ArrowLeftRight size={18} />,
    nav: true,
    section: "Inventory",
    order: 50,
  },

  {
    path: appPaths.stockTransferNew,
    element: <StockTransferCreatePage />,
    nav: false,
  },

  {
    path: appPaths.stockTransferApprovals,
    label: "Transfer Approvals",
    element: <StockTransferApprovalsPage />,
    nav: false,
  },

  {
    path: appPaths.stockTransferDetail,
    element: <StockTransferDetailPage />,
    nav: false,
  },

  {
    path: appPaths.stockTransferEdit,
    element: <StockTransferEditPage />,
    nav: false,
  },

  {
    path: appPaths.adjustments,
    label: "Adjustments",
    element: <AdjustmentListPage />,
    icon: <Sliders size={18} />,
    nav: true,
    section: "Inventory",
    order: 60,
  },

  {
    path: appPaths.adjustmentNew,
    element: <AdjustmentDraftEditorPage />,
    nav: false,
  },

  {
    path: appPaths.adjustmentDraft,
    element: <AdjustmentDraftEditorPage />,
    nav: false,
  },

  {
    path: appPaths.adjustmentEdit,
    element: <AdjustmentDraftEditorPage />,
    nav: false,
  },

  {
    path: appPaths.adjustmentDetail,
    element: <AdjustmentDetailsPage />,
    nav: false,
  },

  {
    path: appPaths.adjustmentApprove,
    element: <AdjustmentApprovalPage />,
    nav: false,
  },

  {
    path: appPaths.menuCategories,
    label: "Menu Categories",
    element: <MenuCategoriesPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 10,
  },

  {
    path: appPaths.menuItemNew,
    label: "Create Menu Item",
    element: <MenuItemCreatePage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 20,
  },

  {
    path: appPaths.menuItemDetail,
    label: "Menu Configuration",
    element: <MenuItemDetailPage />,
    nav: false,
    section: "Production",
  },

  {
    path: appPaths.recipeManagement,
    label: "Recipe Management",
    element: <RecipeEditorPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 30,
  },

  {
    path: appPaths.menuItemRecipe,
    label: "Recipe Editor",
    element: <RecipeEditorPage />,
    nav: false,
    section: "Production",
  },

  {
    path: appPaths.productionBatches,
    label: "Production Batches",
    element: <ProductionBatchPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 40,
  },

  {
    path: appPaths.productionBatchNew,
    label: "New Production Batch",
    element: <ProductionBatchPage />,
    nav: false,
    section: "Production",
  },

  {
    path: appPaths.productionBatchDetail,
    label: "Production Batch Detail",
    element: <ProductionBatchPage />,
    nav: false,
    section: "Production",
  },

  {
    path: appPaths.menuEngineering,
    label: "Menu Engineering",
    element: <MenuEngineeringPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 50,
  },

  {
    path: appPaths.reportsFnb,
    label: "F&B Control Center",
    element: <FnbControlCenterPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Reports",
    order: 10,
  },

  {
    path: appPaths.telegram,
    label: "Mini App",
    element: <TelegramMiniAppDashboard />,
    icon: <Upload size={18} />,
    nav: true,
    section: "Telegram Bot",
    order: 10,
  },

  {
    path: appPaths.settings,
    label: "Settings",
    element: <SettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "System",
    order: 10,
  },
];