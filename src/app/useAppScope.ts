import { useMemo } from "react";
import { loadAuth } from "../auth/auth.storage"; // adjust path if different

export type AppScope = {
  companyId: string;
  branchId: string;
  userId?: string | null;
};

export function useAppScope(): AppScope {
  const auth = loadAuth();

  return useMemo(() => {
    const companyId = auth?.companyId ?? "";
    const branchId = auth?.branchId ?? "";
    const userId = auth?.user?.id ?? null;

    return { companyId, branchId, userId };
  }, [auth?.companyId, auth?.branchId, auth?.user?.id]);
}
