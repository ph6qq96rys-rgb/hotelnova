import { useMemo } from "react";
import { loadAuth } from "../auth/auth.storage";

export type AppScope = {
  companyId: string;
  companyName: string | null;
  branchId: string;
  branchName: string | null;
  userId?: string | null;
  departmentId?: string | null;
  currentLocationId?: string | null;
};

export function useAppScope(): AppScope {
  const auth = loadAuth();

  return useMemo(() => {
    const companyId       = auth?.companyId       ?? "";
    const companyName     = auth?.companyName ?? null;
    const branchId        = auth?.branchId   ?? "";
    const branchName      = auth?.branchName ?? null;
    const userId          = auth?.user?.id         ?? null;
    const departmentId    = auth?.departmentId     ?? null;
    const currentLocationId = auth?.currentLocationId ?? null;

    return { companyId, companyName, branchId, branchName, userId, departmentId, currentLocationId };
  }, [
    auth?.companyId,
    auth?.companyName,
    auth?.branchId,
    auth?.branchName,
    auth?.user?.id,
    auth?.departmentId,
    auth?.currentLocationId,
  ]);
}