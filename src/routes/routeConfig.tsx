// src/routes/routeConfig.tsx

import { lazy, type ReactNode } from "react";
const CustomerMenuDetailsPage = lazy(() => import("../features/production/pages/CustomerMenuDetailsPage"));
import type { RouteObject } from "react-router-dom";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Beef,
  Building2,
  CalendarDays,
  ChefHat,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  PackageCheck,
  Sliders,
  Upload,
  Users,
} from "lucide-react";

import DashboardPage from "../pages/DashboardPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";

const SettingsPage = lazy(() => import("../modules/security/pages/SettingsPage"));
const UsersPage = lazy(() => import("../modules/security/pages/UsersPage"));
const RolesPermissionsPage = lazy(() => import("../modules/security/pages/RolesPermissionsPage"));

import CompanyOnboardingModule from "../features/company/onboarding/CompanyOnboardingModule";

const InventoryControlSettingsPage = lazy(() => import("../features/inventory/settings/pages/InventoryControlSettingsPage"));

import StockTransfersPage from "../features/inventory/stock-transfers/pages/StockTransfersPage";
import StockTransferCreatePage from "../features/inventory/stock-transfers/pages/StockTransferCreatePage";
import StockTransferDetailPage from "../features/inventory/stock-transfers/pages/StockTransferDetailPage";
import StockTransferEditPage from "../features/inventory/stock-transfers/pages/StockTransferEditPage";
import StockTransferApprovalsPage from "../features/inventory/stock-transfers/pages/StockTransferApprovalsPage";

import AdjustmentListPage from "../features/inventory/adjustments/pages/AdjustmentListPage";
import AdjustmentDetailsPage from "../features/inventory/adjustments/pages/AdjustmentDetailsPage";
import AdjustmentApprovalPage from "../features/inventory/adjustments/pages/AdjustmentApprovalPage";
import AdjustmentDraftEditorPage from "../features/inventory/adjustments/pages/AdjustmentDraftEditorPage";

const ProductionBatchPage = lazy(() => import("../features/production/pages/ProductionBatchPage"));
const RecipeEditorPage = lazy(() => import("../features/production/pages/RecipeEditorPage"));
const MenuItemCreatePage = lazy(() => import("../features/production/pages/MenuItemCreatePage"));
const MenuItemDetailPage = lazy(() => import("../features/production/pages/MenuItemDetailPage"));
const MenuCategoriesPage = lazy(() => import("../features/production/pages/MenuCategoriesPage"));
const MenuEngineeringPage = lazy(() => import("../features/production/pages/MenuEngineeringPage"));
const MenuItemListPage = lazy(() => import("../features/production/pages/MenuItemsListPage"));

const FnbControlCenterPage = lazy(() => import("../features/reports/fnb/pages/FnbControlCenterPage"));
import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import TelegramMiniAppDashboard from "../features/telegram-miniapp/TelegramMiniAppDashboard";
const EventManagementPage = lazy(() => import("../features/eventmanagment/pages/EventManagementPage"));
const SalesWorkbenchPage = lazy(() => import("../features/eventmanagment/sales/SalesWorkbenchPage"));

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
  hidden?: boolean;
  menu?: {
    label?: string;
    section?: string;
    order?: number;
  };
};

export const appPaths = {
  dashboard: "dashboard",
  eventManagement: "eventmanagment",

  users: "users",
  rolesPermissions: "security/roles-permissions",

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
  menuItemsList: "production/menu/items",
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


const eventManagementModuleRoutes: AppRoute[] = [
  { path: "eventmanagment/command", label: "Command", element: <EventManagementPage />, icon: <LayoutDashboard size={18} />, nav: true, section: "Catering", order: 11, permissions: ["catering.view", "catering.commandcenter.view", "catering.dashboard.view"] },
  { path: "eventmanagment/sales", label: "Sales", element: <SalesWorkbenchPage />, icon: <Receipt size={18} />, nav: true, section: "Catering", order: 12, permissions: ["catering.view", "catering.quotations.view", "catering.inquiries.view"] },
  { path: "eventmanagment/event", label: "Event Ops", element: <EventManagementPage />, icon: <CalendarDays size={18} />, nav: true, section: "Catering", order: 13, permissions: ["catering.view", "catering.events.manage"] },
  { path: "eventmanagment/kitchen", label: "Kitchen", element: <EventManagementPage />, icon: <ChefHat size={18} />, nav: true, section: "Catering", order: 14, permissions: ["catering.view", "catering.events.manage"] },
  { path: "eventmanagment/butchery", label: "Butchery", element: <EventManagementPage />, icon: <Beef size={18} />, nav: true, section: "Butchery", order: 15, permissions: ["butchery.view"] },
  { path: "eventmanagment/inventory", label: "Inventory", element: <EventManagementPage />, icon: <PackageCheck size={18} />, nav: true, section: "Catering", order: 16, permissions: ["catering.view", "catering.inventory.view"] },
  { path: "eventmanagment/finance", label: "Finance", element: <EventManagementPage />, icon: <BadgeDollarSign size={18} />, nav: true, section: "Catering", order: 17, permissions: ["catering.view", "catering.billing.view", "catering.reports.view"] },
  { path: "eventmanagment/reports", label: "Reports", element: <EventManagementPage />, icon: <FileText size={18} />, nav: true, section: "Catering", order: 18, permissions: ["catering.view", "catering.reports.view"] },
  { path: "eventmanagment/portal", label: "Customer Portal", element: <EventManagementPage />, icon: <Users size={18} />, nav: true, section: "Catering", order: 19, permissions: ["catering.view", "catering.inquiries.view"] },
];
const allRoutes: AppRoute[] = [
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
    path: appPaths.eventManagement,
    label: "Event Management",
    element: <EventManagementPage />,
    icon: <CalendarDays size={18} />,
    nav: true,
    section: "Catering",
    order: 10,
    permissions: [
      "catering.view",
      "catering.events.manage",
      "catering.commandcenter.view",
      "catering.dashboard.view",
    ],
  },
  ...eventManagementModuleRoutes,
  {
    path: appPaths.orgLocations,
    label: "Organization",
    element: <OrgLocationsPage />,
    icon: <Building2 size={18} />,
    nav: true,
    section: "Setup",
    order: 10,
    permissions: ["branches.view", "stocklocations.view", "stores.view"],
  },

  {
    path: appPaths.companyOnboarding,
    label: "Company Onboarding",
    element: <CompanyOnboardingModule />,
    icon: <ClipboardList size={18} />,
    nav: true,
    section: "Setup",
    order: 20,
    permissions: [
      "company.view",
      "company.manage",
      "onboarding.view",
      "onboarding.manage",
    ],
  },

  {
    path: appPaths.branchOnboarding,
    label: "Branch Onboarding",
    element: <CompanyOnboardingModule />,
    icon: <ClipboardList size={18} />,
    nav: true,
    section: "Setup",
    order: 30,
    permissions: [
      "company.view",
      "company.manage",
      "onboarding.view",
      "onboarding.manage",
    ],
  },

  {
    path: appPaths.users,
    label: "Users",
    element: <UsersPage />,
    icon: <Users size={18} />,
    nav: true,
    section: "Security",
    order: 10,
    permissions: [
      "users.view",
      "users.manage",
      "security.view",
      "security.manage",
    ],
  },

  {
    path: appPaths.rolesPermissions,
    label: "Roles & Permissions",
    element: <RolesPermissionsPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Security",
    order: 20,
    permissions: [
      "security.view",
      "security.manage",
      "roles.view",
      "roles.manage",
    ],
  },

  {
    path: appPaths.inventorySettings,
    label: "Inventory Control Settings",
    element: <InventoryControlSettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "Inventory",
    order: 40,
    permissions: ["settings.view", "settings.update"],
  },

  {
    path: appPaths.stockTransfers,
    label: "Stock Transfers",
    element: <StockTransfersPage />,
    icon: <ArrowLeftRight size={18} />,
    nav: true,
    section: "Inventory",
    order: 50,
    permissions: ["stocktransfers.view"],
  },

  {
    path: appPaths.stockTransferNew,
    element: <StockTransferCreatePage />,
    nav: false,
    permissions: ["stocktransfers.create"],
  },

  {
    path: appPaths.stockTransferApprovals,
    label: "Transfer Approvals",
    element: <StockTransferApprovalsPage />,
    nav: false,
    permissions: ["stocktransfers.approve"],
  },

  {
    path: appPaths.stockTransferDetail,
    element: <StockTransferDetailPage />,
    nav: false,
    permissions: ["stocktransfers.view"],
  },

  {
    path: appPaths.stockTransferEdit,
    element: <StockTransferEditPage />,
    nav: false,
    permissions: ["stocktransfers.create"],
  },

  {
    path: appPaths.adjustments,
    label: "Adjustments",
    element: <AdjustmentListPage />,
    icon: <Sliders size={18} />,
    nav: true,
    section: "Inventory",
    order: 60,
    permissions: ["inventory.adjustments.view"],
  },

  {
    path: appPaths.adjustmentNew,
    element: <AdjustmentDraftEditorPage />,
    nav: false,
    permissions: ["inventory.adjustments.create"],
  },

  {
    path: appPaths.adjustmentDraft,
    element: <AdjustmentDraftEditorPage />,
    nav: false,
    permissions: ["inventory.adjustments.create"],
  },

  {
    path: appPaths.adjustmentEdit,
    element: <AdjustmentDraftEditorPage />,
    nav: false,
    permissions: ["inventory.adjustments.create"],
  },

  {
    path: appPaths.adjustmentDetail,
    element: <AdjustmentDetailsPage />,
    nav: false,
    permissions: ["inventory.adjustments.view"],
  },

  {
    path: appPaths.adjustmentApprove,
    element: <AdjustmentApprovalPage />,
    nav: false,
    permissions: ["inventory.adjustments.approve"],
  },

  {
    path: appPaths.menuCategories,
    label: "Menu Categories",
    element: <MenuCategoriesPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 10,
    permissions: ["menu.view", "menu.manage"],
  },

  {
    path: appPaths.menuItemNew,
    label: "Create New Menu",
    element: <MenuItemCreatePage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 20,
    permissions: ["menu.manage"],
  },

  {
    path: "production/menu/items/:id/customer-details",
    label: "Customer recipe details",
    element: <CustomerMenuDetailsPage />,
    nav: false,
    section: "Production",
    permissions: ["menu.view"],
  },
  {
    path: appPaths.menuItemDetail,
    label: "Menu Configuration",
    element: <MenuItemDetailPage />,
    nav: false,
    section: "Production",
    permissions: ["menu.view", "menu.manage"],
  },
{
    path: appPaths.menuItemsList,
    label: "Menu Items",
    element: <MenuItemListPage />,
    nav: true,
    section: "Production",
    permissions: ["menu.view", "menu.manage"],
  },
  {
    path: appPaths.recipeManagement,
    label: "Recipe Management",
    element: <RecipeEditorPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 30,
    permissions: ["recipes.view"],
  },

  {
    path: appPaths.menuItemRecipe,
    label: "Recipe Editor",
    element: <RecipeEditorPage />,
    nav: false,
    section: "Production",
    permissions: ["recipes.manage"],
  },

  {
    path: appPaths.productionBatches,
    label: "Production Batches",
    element: <ProductionBatchPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 40,
    permissions: ["production.view"],
  },

  {
    path: appPaths.productionBatchNew,
    label: "New Production Batch",
    element: <ProductionBatchPage />,
    nav: false,
    section: "Production",
    permissions: ["production.create"],
  },

  {
    path: appPaths.productionBatchDetail,
    label: "Production Batch Detail",
    element: <ProductionBatchPage />,
    nav: false,
    section: "Production",
    permissions: ["production.view"],
  },

  {
    path: appPaths.menuEngineering,
    label: "Menu Engineering",
    element: <MenuEngineeringPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Production",
    order: 50,
    permissions: ["menu.view", "production.view"],
  },

  {
    path: appPaths.reportsFnb,
    label: "F&B Control Center",
    element: <FnbControlCenterPage />,
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Reports",
    order: 10,
    permissions: ["reports.view"],
  },

  {
    path: appPaths.telegram,
    label: "Mini App",
    element: <TelegramMiniAppDashboard />,
    icon: <Upload size={18} />,
    nav: true,
    section: "Telegram Bot",
    order: 10,
    permissions: ["telegram.manage"],
  },

  {
    path: appPaths.settings,
    label: "Settings",
    element: <SettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "Security",
    order: 30,
    permissions: ["settings.view", "settings.manage", "security.manage"],
  },
];

// Navigation and routes remain controlled by each module permission.
export const routeConfig: AppRoute[] = allRoutes;
