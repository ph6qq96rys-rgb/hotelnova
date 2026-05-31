import { inventoryMasterRoutes } from "./inventoryMasterRoutes";
import { routeConfig } from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { userManagementRoutes } from "./userManagementRoutes";
import { authRoutes } from "./authRoutes";
import { useGrnRoutes } from "./grnroutes";
import { useSalesRoutes } from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";

import type { AppRoute } from "./sales-cogsroute";

export function useAppRoutes(): AppRoute[] {
  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();

  return [
    ...(routeConfig as AppRoute[]),
    ...(companyRoutes as AppRoute[]),
    ...grnRoutes,
    ...salesRoutes,
    ...hrRoutes,
    ...(authRoutes as AppRoute[]),
    ...(inventoryMasterRoutes as AppRoute[]),
    ...(userManagementRoutes as AppRoute[]),
  ];
}