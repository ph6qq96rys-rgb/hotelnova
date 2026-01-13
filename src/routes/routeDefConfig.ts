//import type { AppRoute } from "./types-or-same-file"; // wherever AppRoute is

// import each feature's routes
//import { stockTransferRoutes } from "./stockTransferRoutes";
import { inventoryMasterRoutes } from "./inventoryMasterRoutes";
import { routeConfig } from "./routeConfig"; 
import type { AppRoute } from "./routeConfig";
import { companyRoutes, BranchRoutes } from "./companyRoutes";
import { userManagementRoutes } from "./userManagementRoutes";

import{grnRoutes} from"./grnroutes";

// ✅ single source of truth
export const appRoutes: AppRoute[] = [
  ...(routeConfig as AppRoute[]),
  ...(companyRoutes as AppRoute[]),
  ...(BranchRoutes as AppRoute[]),
  ...(grnRoutes as AppRoute[]),
  ...(inventoryMasterRoutes as AppRoute[]),
  ...(userManagementRoutes as AppRoute[]),
];