// src/hooks/useAppScope.ts

import { useEffect, useMemo } from "react";
import { useAppContext } from "./AppContext";
import { loadAuth } from "../auth/auth.storage";
import { hasCompanyAdminRole, hasSystemAdminRole } from "../auth/erpAccess";
import { branchesApi } from "../features/company/api/branchesApi";

export type AppScope = {
  companyId: string;
  companyName: string | null;

  branchId: string;
  branchName: string | null;

  storeId: string | null;
  storeName: string | null;

  currentLocationId: string | null;
  currentLocationName: string | null;

  userId: string | null;
  departmentId: string | null;

  hasCompany: boolean;
  hasBranch: boolean;
  hasOperationalScope: boolean;
};

function normalizeId(value?: string | null): string {
  const text = String(value ?? "").trim();
  return text.length > 0 && !text.startsWith(":") ? text : "";
}

let branchHydrationKey: string | null = null;

function getBranchName(branch: unknown): string | null {
  const row = branch as Record<string, unknown>;
  const value =
    row?.name ??
    row?.branchName ??
    row?.tradeName ??
    row?.code;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export function useAppScope(): AppScope {
  const scope = useAppContext();
  const auth = loadAuth();

  const authCompanyId = normalizeId(
    auth?.companyId ??
    auth?.user?.companyId
  );

  const authBranchId = normalizeId(
    auth?.branchId ??
    auth?.user?.branchId
  );

  const roles = auth?.roles ?? auth?.user?.roles ?? [];
  const canUseAnyBranch =
    hasCompanyAdminRole(roles) || hasSystemAdminRole(roles);

  const resolvedScope = useMemo(() => {
    const companyId = authCompanyId || normalizeId(scope.companyId);
    const branchId = normalizeId(scope.branchId) || authBranchId;

    return {
      companyId,
      companyName: scope.companyName,

      branchId,
      branchName: scope.branchName,

      storeId: scope.storeId,
      storeName: scope.storeName,

      currentLocationId: scope.stockLocationId,
      currentLocationName: scope.stockLocationName,

      userId: auth?.user?.id ?? null,
      departmentId: auth?.departmentId ?? null,

      hasCompany: Boolean(companyId),
      hasBranch: Boolean(branchId),
      hasOperationalScope: Boolean(companyId && branchId),
    };
  }, [
    authCompanyId,
    authBranchId,
    auth?.user?.id,
    auth?.departmentId,
    scope.companyId,
    scope.companyName,
    scope.branchId,
    scope.branchName,
    scope.storeId,
    scope.storeName,
    scope.stockLocationId,
    scope.stockLocationName,
  ]);

  useEffect(() => {
    if (!canUseAnyBranch) return;
    if (!resolvedScope.companyId || resolvedScope.branchId) return;

    const key = `${resolvedScope.companyId}:company-admin-branch`;
    if (branchHydrationKey === key) return;

    branchHydrationKey = key;

    let cancelled = false;

    branchesApi
      .list(resolvedScope.companyId, { page: 1, pageSize: 1, activeOnly: true })
      .then((branches) => {
        if (cancelled) return;

        const branch = branches[0] as any;
        const id = normalizeId(branch?.id ?? branch?.branchId);

        if (!id) return;

        scope.setBranch({
          id,
          name: getBranchName(branch),
        });
      })
      .catch(() => {
        branchHydrationKey = null;
      });

    return () => {
      cancelled = true;
    };
  }, [
    canUseAnyBranch,
    resolvedScope.companyId,
    resolvedScope.branchId,
    scope,
  ]);

  return resolvedScope;
}
