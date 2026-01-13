import InventoryMasterHomePage from "../features/inventoryMaster/pages/InventoryMasterHomePage";
import InventoryItemsPage from "../features/inventoryMaster/items/pages/InventoryItemsPage";

/**
 * Merge with your existing routes if you already have them.
 */
export const inventoryMasterRoutes = [
  { path: "inventory-master", element: <InventoryMasterHomePage /> },
  { path: "inventory-master/items", element: <InventoryItemsPage /> },
];
