// src/routes/inventoryMasterRoutes.tsx

import type { AppRoute } from "./sales-cogsroute";

import InventoryMasterHomePage from "../features/inventoryMaster/pages/InventoryMasterHomePage";

import InventoryItemsPage from "../features/inventoryMaster/items/pages/InventoryItemsPage";
import ItemUpsertPage from "../features/inventoryMaster/items/pages/ItemUpsertPage";
import ImportInventoryItemsPage from "../features/inventoryMaster/items/pages/Importinventoryitemspage";

import InventoryLedgerPage from "../features/inventory/ledger/pages/InventoryLedgerPage";

export const inventoryMasterRoutes: AppRoute[] = [
  {
    path: "inventory-master",
    element: <InventoryMasterHomePage />,
    label: "Inventory",
    nav: true,
    section: "Inventory",
    order: 10,
  },

  {
    path: "inventory-master/items",
    element: <InventoryItemsPage />,
    label: "Items",
    nav: true,
    section: "Inventory",
    order: 20,
  },

  {
    path: "inventory-master/items/new",
    element: <ItemUpsertPage />,
    nav: false,
  },

  {
    path: "inventory-master/items/:id/edit",
    element: <ItemUpsertPage />,
    nav: false,
  },

  {
    path: "inventory-master/items/import",
    element: <ImportInventoryItemsPage />,
    nav: false,
  },

  {
    path: "inventory-master/ledger",
    element: <InventoryLedgerPage />,
    label: "Inventory Ledger",
    nav: true,
    section: "Inventory",
    order: 30,
  },
];