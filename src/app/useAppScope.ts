import { useMemo } from "react";
import { loadAuth } from "../auth/auth.storage"; // adjust path if different

export type AppScope = {
  companyId: string;
  branchId: string;
  userId?: string | null;
  departmentId?: string | null;
  currentLocationId?: string | null;
};

export function useAppScope(): AppScope {
  const auth = loadAuth();

  return useMemo(() => {
    const companyId = auth?.companyId ?? "";
    const branchId = auth?.branchId ?? "";
    const userId = auth?.user?.id ?? null;
    const departmentId = auth?.departmentId ?? null;
    const currentLocationId = auth?.currentLocationId ?? null;

    return { companyId, branchId, userId, departmentId, currentLocationId };
  }, [auth?.companyId, auth?.branchId, auth?.user?.id, auth?.departmentId, auth?.currentLocationId]);
}
