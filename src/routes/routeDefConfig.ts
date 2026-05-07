import { inventoryMasterRoutes } from "./inventoryMasterRoutes";
import { routeConfig } from "./routeConfig";
import type { AppRoute } from "./routeConfig";
import { companyRoutes, BranchRoutes } from "./companyRoutes";
import { userManagementRoutes } from "./userManagementRoutes";
import { authRoutes } from "./authRoutes";

import { useInventoryRoutes } from "./grnroutes";

/**
 * ✅ Single source of truth for routes — as a HOOK (not a const),
 * so any feature routes that depend on hooks (companyId, auth, etc.)
 * are only evaluated during React render.
 */
export function useAppRoutes(): AppRoute[] {
  const inventoryRoutes = useInventoryRoutes();

  return [
    ...(routeConfig as AppRoute[]),
    ...(companyRoutes as AppRoute[]),
    ...(BranchRoutes as AppRoute[]),
    ...inventoryRoutes,
    ...(authRoutes as AppRoute[]),
    ...(inventoryMasterRoutes as AppRoute[]),
    ...(userManagementRoutes as AppRoute[]),
  ];
}
