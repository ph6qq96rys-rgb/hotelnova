// src/hooks/useAppScope.ts

import { useMemo } from "react";
import { useAppContext } from "./AppContext";
import { loadAuth } from "../auth/auth.storage";

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
  return text.length > 0 ? text : "";
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

  return useMemo(() => {
    const companyId = authCompanyId || normalizeId(scope.companyId);
    const branchId = authBranchId || normalizeId(scope.branchId);

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
}