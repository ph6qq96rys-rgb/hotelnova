// src/routes/useErpNavigation.ts

import { useCallback } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  type NavigateOptions,
  type To,
} from "react-router-dom";

import { useAppScope } from "../app/useAppScope";

const SAFE_ABSOLUTE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/platform",
  "/system-admin",
  "/companies/onboarding",
];

function cleanPath(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function isExternalUrl(path: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(path);
}

function isSafeAbsolutePath(path: string): boolean {
  return SAFE_ABSOLUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function getCompanyIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/companies\/([^/]+)/i);
  return match?.[1] ?? null;
}

function toCompanyPath(companyId: string, to: string): string {
  const clean = cleanPath(to);

  if (!clean) {
    return `/companies/${companyId}/dashboard`;
  }

  if (clean.startsWith("companies/")) {
    return `/${clean}`;
  }

  return `/companies/${companyId}/${clean}`;
}

export function useErpNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const scope = useAppScope();

  const resolvedCompanyId =
    scope.companyId ??
    params.companyId ??
    getCompanyIdFromPath(location.pathname);

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
        return;
      }

      if (typeof to !== "string") {
        navigate(to, options);
        return;
      }

      if (isExternalUrl(to)) {
        window.location.href = to;
        return;
      }

      if (to.startsWith("/") && isSafeAbsolutePath(to)) {
        navigate(to, options);
        return;
      }

      if (!resolvedCompanyId) {
        navigate("/companies/onboarding", { replace: true });
        return;
      }

      navigate(toCompanyPath(resolvedCompanyId, to), options);
    },
    [navigate, resolvedCompanyId]
  );
}