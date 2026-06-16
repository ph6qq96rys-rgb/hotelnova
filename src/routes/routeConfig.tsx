import type { RouteObject } from "react-router-dom";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Shield,
  Settings,
  Building2,
  Package,
  ArrowLeftRight,
  ChefHat,
  Sliders,
  ClipboardList,
} from "lucide-react";

import DashboardPage from "../pages/DashboardPage"
import SettingsPage from "../modules/security/pages/SettingsPage";
import InventoryMasterHomePage from "../features/inventoryMaster/pages/InventoryMasterHomePage";
import InventoryItemsPage from "../features/inventoryMaster/items/pages/InventoryItemsPage";
import InventoryLedgerPage from "../features/inventory/ledger/pages/InventoryLedgerPage";
import OrgLocationsPage from "../features/org/pages/OrgLocationsPage";
import StockTransferEditPage from "../features/inventory/stock-transfers/pages/StockTransferEditPage";
import StockTransfersPage from "../features/inventory/stock-transfers/pages/StockTransfersPage";
import StockTransferApprovalsPage from "../features/inventory/stock-transfers/pages/StockTransferApprovalsPage";
import StockTransferCreatePage from "../features/inventory/stock-transfers/pages/StockTransferCreatePage";
import ProductionBatchPage from "../features/production/pages/ProductionBatchPage";
import RecipeEditorPage from "../features/production/pages/RecipeEditorPage";
import MenuItemCreatePage from "../features/production/pages/MenuItemCreatePage";
import MenuItemDetailPage from "../features/production/pages/MenuItemDetailPage";
import MenuCategoriesPage from "../features/production/pages/MenuCategoriesPage"
import RolesPermissionsPage from "../modules/security/pages/RolesPermissionsPage";
import AdjustmentListPage from "../features/inventory/adjustments/pages/AdjustmentListPage";
import AdjustmentDetailsPage from "../features/inventory/adjustments/pages/AdjustmentDetailsPage";
import AdjustmentApprovalPage from "../features/inventory/adjustments/pages/AdjustmentApprovalPage";
import AdjustmentDraftEditorPage from "../features/inventory/adjustments/pages/AdjustmentDraftEditorPage";

// ── Auth pages — rendered outside the authenticated shell ────────────────────
import ForgotPasswordPage from "../pages/ForgotPasswordPage";


import MenuEngineeringPage from "../features/production/pages/MenuEngineeringPage";
import InventoryControlSettingsPage from "../features/inventory/settings/pages/InventoryControlSettingsPage";
import StockTransferDetailPage from "../features/inventory/stock-transfers/pages/StockTransferDetailPage";
import FnbControlCenterPage from "../features/reports/fnb/pages/FnbControlCenterPage";
import ImportInventoryItemsPage from "../features/inventoryMaster/items/pages/Importinventoryitemspage";
import ItemUpsertPage from "../features/inventoryMaster/items/pages/ItemUpsertPage";
import TelegramSivRequestPage from "../features/telegram-miniapp/siv-request/TelegramSivRequestPage";
import UsersPage from "../modules/security/pages/UsersPage";

// ─────────────────────────────────────────────────────────────────────────────

export type AppRoute = RouteObject & {
  path?: string;
  label?: string;
  element?: ReactNode;
  icon?: ReactNode;
  /** Show in sidebar navigation. */
  nav?: boolean;
  /** Sidebar section heading. */
  section?: string;
  roles?: string[];
  permissions?: string[];
};

// ── Public / unauthenticated routes ──────────────────────────────────────────
//
//  These render outside the authenticated shell (no sidebar, no auth guard).
//  Keep them separate from appRoutes so the shell layout never wraps them.

export const publicRoutes: AppRoute[] = [
  //{ path: "/register",         element: <RegisterPage /> },
  { path: "/forgot-password",  element: <ForgotPasswordPage /> },
];

// ── Authenticated app routes ──────────────────────────────────────────────────

export const routeConfig: AppRoute[] = [

  // ── General ────────────────────────────────────────────────────────────────

  {
    path: "/dashboard",
    label: "Dashboard",
    element: <DashboardPage />,
    icon: <LayoutDashboard size={18} />,
    nav: true,
    section: "General",
  },

  // ── Company ────────────────────────────────────────────────────────────────


  
  // ── Identity ───────────────────────────────────────────────────────────────

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
    // Fixed casing: "/RolesPermissions" → "/roles-permissions"
    path: "/roles-permissions",
    label: "Roles & Permissions",
    element: <RolesPermissionsPage />,
    icon: <Shield size={18} />,
    nav: true,
    section: "Identity",
   permissions: ["roles.view"],
  },


  // ── Inventory master ───────────────────────────────────────────────────────

  {
    path: "/inventory-master",
    label: "Inventory",
    element: <InventoryMasterHomePage />,
    icon: <Package size={18} />,
    nav: true,
    section: "Inventory",
    permissions: ["inventory.view"],
  },

  {
    path: "/inventory-master/items",
    label: "Items",
    element: <InventoryItemsPage />,
    icon: <Package size={18} />,
    nav: true,
    section: "Inventory",
    permissions: ["inventory.view"],
  },
  {
    // Create new item — navigated to from InventoryItemsPage "+ New item" button
    path: "/inventory-master/items/new",
    element: <ItemUpsertPage />,
    nav: false,
    permissions: ["inventory.manage"],
  },
  {
    // Edit existing item — navigated to from row "Edit" button
    path: "/inventory-master/items/:id/edit",
    element: <ItemUpsertPage />,
    nav: false,
    permissions: ["inventory.manage"],
  },
  {
    path: "/inventory-master/items/import",
    element: <ImportInventoryItemsPage />,
    nav: false,
    permissions: ["inventory.manage"],
  },
  {
    // Fixed typo: "leger" → "ledger"
    path: "/inventory-master/ledger",
    label: "Inventory Ledger",
    element: <InventoryLedgerPage />,
    icon: <ClipboardList size={18} />,
    nav: true,
    section: "Inventory",
    permissions: ["inventory.view"],
  },
  //Inventory Control Settings
{
  path: "/inventory/control-settings",
  label: "Inventory Control Settings",
  element: <InventoryControlSettingsPage />,
  icon: <Settings size={18} />,
  nav: true,
  section: "Inventory",
  permissions: ["inventory.manage"],
},
  // ── Stock transfers ────────────────────────────────────────────────────────

{
  path: "/inventory/stock-transfers",
  label: "Stock Transfers",
  element: <StockTransfersPage />,
  icon: <ArrowLeftRight size={18} />,
  nav: true,
  section: "Inventory",
 // permissions: ["inventory.view"],
},
{
  path: "/inventory/stock-transfers/new",
  element: <StockTransferCreatePage />,
  nav: false,
},
{
  path: "/inventory/stock-transfers/approvals",
  label: "Transfer Approvals",
  element: <StockTransferApprovalsPage />,
  nav: false,
  //permissions: ["inventory.view"],
},
{
  path: "/inventory/stock-transfers/:id",
  element: <StockTransferDetailPage />,
  nav: false,
},
{
  path: "/inventory/stock-transfers/:id/edit",
  element: <StockTransferEditPage />,
  nav: false,
},

  // ── Adjustments ────────────────────────────────────────────────────────────

  {
    path: "/inventory/adjustments",
    label: "Adjustments",
    element: <AdjustmentListPage />,
    icon: <Sliders size={18} />,
    nav: true,
    section: "Inventory",
    //permissions: ["inventory.view"],
  },
  {
    path: "/inventory/adjustments/new",
    element: <AdjustmentDraftEditorPage />,
    nav: false,
  },
  {
    path: "/inventory/adjustments/drafts/:adjustmentId",
    element: <AdjustmentDraftEditorPage />,
    nav: false,
  },
  {
    path: "/inventory/adjustments/:adjustmentId/edit",
    element: <AdjustmentDraftEditorPage />,
    nav: false,
  },
  {
    path: "/inventory/adjustments/:adjustmentId",
    element: <AdjustmentDetailsPage />,
    nav: false,
  },
  {
    path: "/inventory/adjustments/:adjustmentId/approve",
    element: <AdjustmentApprovalPage />,
    nav: false,
  },
  // ── Reports ─────────────────────────────────────────────────────────────

  {
    path: "/reports/fnb",
    element: <FnbControlCenterPage />,
    label: "F&B Control Center",
    icon: <ChefHat size={18} />,
    nav: true,
    section: "Reports",
   // permissions: ["reports.view"],
  },
// ── Menu & production ─────────────────────────────────────────────────────

 

{
  path: "/production/menu/categories",
  label: "Menu Categories",
  element: <MenuCategoriesPage />,
  icon: <ChefHat size={18} />,
  nav: true,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/menu/items/new",
  label: "Create Menu Item",
  element: <MenuItemCreatePage />,
  icon: <ChefHat size={18} />,
  nav: true,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/menu/items/:id",
  label: "Menu Configuration",
  element: <MenuItemDetailPage />,
  nav: true,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/telegram/siv-request",
  label:"Mini App",
  icon:<ChefHat size={18}/>,
  nav:true,
  section:"Production",
  element: <TelegramSivRequestPage />
},
{
  path: "/production/recipes",
  label: "Recipe Management",
  element: <RecipeEditorPage />,
  icon: <ChefHat size={18} />,
  nav: true,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/menu/items/:id/recipe",
  label: "Recipe Editor",
  element: <RecipeEditorPage />,
  nav: false,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/batches",
  label: "Production Batches",
  element: <ProductionBatchPage />,
  icon: <ChefHat size={18} />,
  nav: true,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/batches/new",
  label: "New Production Batch",
  element: <ProductionBatchPage />,
  nav: false,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/batches/:batchId",
  label: "Production Batch Detail",
  element: <ProductionBatchPage />,
  nav: false,
  section: "Production",
  permissions: ["inventory.view"],
},
{
  path: "/production/menu-engineering",
  label: "Menu Engineering",
  element: <MenuEngineeringPage />,
  icon: <ChefHat size={18} />,
  nav: true,
  section: "Production",
  permissions: ["inventory.view"],
},
  // ── Organisation & locations ───────────────────────────────────────────────

  {
    path: "/org",
    label: "Locations",
    element: <OrgLocationsPage />,
    icon: <Building2 size={18} />,
    nav: true,
    section: "Setup",
    //permissions: ["inventory.view"],
  },

  // ── System ─────────────────────────────────────────────────────────────────

  {
    path: "/settings",
    label: "Settings",
    element: <SettingsPage />,
    icon: <Settings size={18} />,
    nav: true,
    section: "System",
  },
  
];