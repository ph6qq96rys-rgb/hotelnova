// src/features/inventory/stockTransfers/hooks/useWarehouseBranch.ts

import { useMemo } from "react";
import { useBranches } from "./useStockTransferCatalogs";

export function useWarehouseBranch(companyId: string | null) {
  const { branches, loading, error } = useBranches(companyId);

  const warehouseBranch = useMemo(() => {
    return (
      branches.find((branch: any) => branch.isMain) ??
      branches.find((branch) => branch.code === "HQ") ??
      branches[0] ??
      null
    );
  }, [branches]);

  return {
    hqBranchId: warehouseBranch?.id ?? null,
    warehouseBranch,
    loading,
    error,
  };
}
