// src/routes/routeDefConfig.ts

import { useMemo } from "react";
import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import { routeConfig } from "./routeConfig";
import { companyRoutes } from "./companyRoutes";
import { useGrnRoutes } from "./grnroutes";
import { useSalesRoutes } from "./sales-cogsroute";
import { getHrRoutes } from "./hrRoutes";
import { getPostRoutes } from "./posRoutes";
import { inventoryMasterRoutes } from "./inventoryMasterRoutes";
import { useAppScope } from "../app/useAppScope";

export type AppRouteLike = RouteObject & {
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
  getHref?: (companyId: string) => string;
  children?: AppRouteLike[];
};

export type RouteWithHref = AppRouteLike & {
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

function joinPaths(parentPath?: string, childPath?: string): string | undefined {
  const parent = cleanPath(parentPath);
  const child = cleanPath(childPath);

  if (!parent && !child) return undefined;
  if (!parent) return child;
  if (!child) return parent;

  return `${parent}/${child}`.replace(/\/+/g, "/");
}

function companyHref(companyId: string, path?: string | null): string {
  const clean = stripCompanyPrefix(path);

  if (!clean) {
    return `/companies/${companyId}/dashboard`;
  }

  return `/companies/${companyId}/${clean}`;
}

function getChildren(route: AppRouteLike): AppRouteLike[] {
  return Array.isArray(route.children)
    ? (route.children as AppRouteLike[])
    : [];
}

function normalizeRoute(
  route: AppRouteLike,
  parentPath?: string
): RouteWithHref {
  const ownPath = stripCompanyPrefix(route.path);
  const fullPath = joinPaths(parentPath, ownPath);

  const normalized: RouteWithHref = {
    ...route,
    path: ownPath,
    getHref: (companyId: string) => companyHref(companyId, fullPath),
  };

  const children = getChildren(route);

  if (children.length > 0) {
    normalized.children = children.map((child) =>
      normalizeRoute(child, fullPath)
    );
  }

  return normalized;
}

function flattenRoutes(routes: AppRouteLike[]): RouteWithHref[] {
  const result: RouteWithHref[] = [];

  function walk(items: AppRouteLike[], parentPath?: string) {
    for (const route of items) {
      const normalized = normalizeRoute(route, parentPath);
      result.push(normalized);

      const children = getChildren(route);

      if (children.length > 0) {
        const childParent = joinPaths(
          parentPath,
          stripCompanyPrefix(route.path)
        );

        walk(children, childParent);
      }
    }
  }

  walk(routes);
  return result;
}

function withCompanyHref(
  route: RouteWithHref,
  companyId: string | null | undefined
): RouteWithHref {
  const clean = stripCompanyPrefix(route.path);

  return {
    ...route,
    path: clean,
    getHref: companyId
      ? () => companyHref(companyId, route.path)
      : route.getHref,
  };
}

export function useAppRoutes(): RouteWithHref[] {
  const { companyId } = useAppScope();

  const grnRoutes = useGrnRoutes();
  const salesRoutes = useSalesRoutes();
  const hrRoutes = getHrRoutes();
  const posRoutes = getPostRoutes();

  const allRoutes = useMemo<AppRouteLike[]>(
    () => [
      ...(routeConfig as AppRouteLike[]),
      ...(companyRoutes as AppRouteLike[]),
      ...(inventoryMasterRoutes as AppRouteLike[]),
      ...(grnRoutes as AppRouteLike[]),
      ...(salesRoutes as AppRouteLike[]),
      ...(hrRoutes as AppRouteLike[]),
      ...(posRoutes as AppRouteLike[]),
    ],
    [grnRoutes, salesRoutes, hrRoutes, posRoutes]
  );

  return useMemo(
    () =>
      flattenRoutes(allRoutes).map((route) =>
        withCompanyHref(route, companyId)
      ),
    [allRoutes, companyId]
  );
}