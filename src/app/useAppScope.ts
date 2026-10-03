// src/hooks/useAppScope.ts

import { useMemo } from "react";
import { useAppContext } from "./AppContext";
import { loadAuth } from "../auth/auth.storage";
import { loadWorkspaceAuth } from "../auth/workspace-auth.storage";
import { hasCompanyAdminRole, hasSystemAdminRole } from "../auth/erpAccess";

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

export function useAppScope(): AppScope {
  const scope = useAppContext();
  const auth = loadAuth();
  const workspace = loadWorkspaceAuth();

  const authCompanyId = normalizeId(
    workspace?.companyId ??
    auth?.companyId ??
    auth?.user?.companyId
  );

  const authCompanyName =
    typeof workspace?.companyName === "string" && workspace.companyName.trim()
      ? workspace.companyName.trim()
      : typeof auth?.companyName === "string" && auth.companyName.trim()
      ? auth.companyName.trim()
      : null;

  const authBranchId = normalizeId(
    workspace?.branchId ??
    auth?.branchId ??
    auth?.user?.branchId
  );

  const authBranchName =
    typeof workspace?.branchName === "string" && workspace.branchName.trim()
      ? workspace.branchName.trim()
      : typeof auth?.branchName === "string" && auth.branchName.trim()
      ? auth.branchName.trim()
      : null;

  const roles =
    workspace?.roles?.length
      ? workspace.roles
      : auth?.roles ?? auth?.user?.roles ?? [];
  const canUseAnyBranch =
    auth?.isCompanyScoped === true ||
    hasCompanyAdminRole(roles) || hasSystemAdminRole(roles);

  const resolvedScope = useMemo(() => {
    const companyId = normalizeId(scope.companyId) || authCompanyId;
    const scopedBranchId = normalizeId(scope.branchId);
    const branchId = canUseAnyBranch
      ? scopedBranchId
      : authBranchId || scopedBranchId;
    const branchName = branchId && scopedBranchId === branchId
      ? scope.branchName || authBranchName
      : branchId === authBranchId
        ? authBranchName
        : null;

    return {
      companyId,
      companyName: scope.companyName || authCompanyName,

      branchId,
      branchName,

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
    authCompanyName,
    authBranchId,
    auth?.user?.id,
    auth?.departmentId,
    authBranchName,
    canUseAnyBranch,
    scope.companyId,
    scope.companyName,
    scope.branchId,
    scope.branchName,
    scope.storeId,
    scope.storeName,
    scope.stockLocationId,
    scope.stockLocationName,
  ]);

  return resolvedScope;
}
