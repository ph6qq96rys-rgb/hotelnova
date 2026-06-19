// src/routes/routeDefConfig.ts

import { routeConfig } from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { useGrnRoutes } from "./grnroutes";
import { useSalesRoutes } from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";
import { getPostRoutes } from "./posRoutes";
import { useAppScope } from "../app/useAppScope";
import { inventoryMasterRoutes } from "./inventoryMasterRoutes";

import type { AppRoute } from "./sales-cogsroute";

type RouteWithHref = AppRoute & {
  getHref?: (companyId: string) => string;
};

function cleanPath(path?: string | null): string | undefined {
  if (!path) return undefined;

  const clean = path
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return clean || undefined;
}

function stripCompanyPrefix(path?: string | null): string | undefined {
  const clean = cleanPath(path);

  if (!clean) return undefined;

  if (clean === "companies/:companyId") return undefined;

  if (clean.startsWith("companies/:companyId/")) {
    return clean.replace(/^companies\/:companyId\/?/, "");
  }

  if (clean.startsWith("companies/")) {
    const parts = clean.split("/");
    if (parts.length >= 3) {
      return parts.slice(2).join("/");
    }
  }

  return clean;
}

function companyHref(companyId: string, path?: string | null): string {
  const clean = stripCompanyPrefix(path);

  if (!clean) {
    return `/companies/${companyId}/dashboard`;
  }

  return `/companies/${companyId}/${clean}`;
}

function normalizeRoute(
  route: AppRoute,
  parentPath = ""
): RouteWithHref {
  const rawPath = cleanPath(route.path);
  const ownPath = stripCompanyPrefix(rawPath);

  const fullPath =
    ownPath && parentPath
      ? `${parentPath}/${ownPath}`.replace(/\/+/g, "/")
      : ownPath || parentPath;

  const normalized: RouteWithHref = {
    ...route,
    path: ownPath,
    getHref: (companyId: string) => companyHref(companyId, fullPath),
  };

  if (Array.isArray((route as any).children)) {
    normalized.children = ((route as any).children as AppRoute[]).map((child) =>
      normalizeRoute(child, fullPath)
    ) as any;
  }

  return normalized;
}

function flattenRoutes(routes: AppRoute[]): RouteWithHref[] {
  const result: RouteWithHref[] = [];

  function walk(items: AppRoute[], parentPath = "") {
    for (const route of items) {
      const normalized = normalizeRoute(route, parentPath);
      result.push(normalized);

      if (Array.isArray((route as any).children)) {
        const childParent =
          stripCompanyPrefix(route.path) ??
          parentPath;

        walk((route as any).children as AppRoute[], childParent);
      }
    }
  }

  walk(routes);

  return result;
}

export function useAppRoutes(): RouteWithHref[] {
  const { companyId } = useAppScope();

  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();

  const allRoutes: AppRoute[] = [
    ...(routeConfig as AppRoute[]),
    ...(companyRoutes as AppRoute[]),
    ...(inventoryMasterRoutes as AppRoute[]),
    ...grnRoutes,
    ...salesRoutes,
    ...(hrRoutes as AppRoute[]),
    ...(posRoutes as AppRoute[]),
  ];

  return flattenRoutes(allRoutes).map((route) => ({
    ...route,
    path: stripCompanyPrefix(route.path),
    getHref: companyId
      ? () => companyHref(companyId, route.path)
      : route.getHref,
  }));
}