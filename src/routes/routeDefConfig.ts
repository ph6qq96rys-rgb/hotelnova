import { routeConfig } from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { useGrnRoutes } from "./grnroutes";
import { useSalesRoutes } from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";
import { useAppScope } from "../app/useAppScope";
import {getPostRoutes} from "./posRoutes";

import type { AppRoute } from "./sales-cogsroute";

function resolveRoutePath(path: string | undefined, companyId?: string | null) {
  if (!path) return undefined;

  if (path.includes(":companyId")) {
    if (!companyId) return undefined;
    return path.replace(/:companyId/g, companyId);
  }

  return path;
}

function flattenRoutes(
  routes: AppRoute[],
  companyId?: string | null,
  parentPath = ""
): AppRoute[] {
  const result: AppRoute[] = [];

  for (const r of routes) {
    const segment = r.path ?? "";

    const fullPath = segment.startsWith("/")
      ? segment
      : parentPath && segment
      ? `${parentPath}/${segment}`.replace(/\/+/g, "/")
      : parentPath || segment;

    const resolvedPath = resolveRoutePath(fullPath, companyId);

    result.push({
      ...r,
      path: resolvedPath,
    });

    if (Array.isArray((r as any).children)) {
      result.push(
        ...flattenRoutes((r as any).children as AppRoute[], companyId, fullPath)
      );
    }
  }

  return result;
}

export function useAppRoutes(): AppRoute[] {
  const { companyId } = useAppScope();

  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();  
  

  return flattenRoutes(
    [
      ...(routeConfig as AppRoute[]),
      ...(companyRoutes as AppRoute[]),
      ...grnRoutes,
      ...salesRoutes,
      ...hrRoutes,
      ...posRoutes,
    ],
    companyId
  );
}