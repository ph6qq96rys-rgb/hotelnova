import { useEffect, useState } from "react";
import { branchesApi } from "../../../company/api/branchesApi";
import type { BranchDto } from "../../../company/types";

export function useWarehouseBranch(companyId: string | null) {
  const [hqBranchId, setHqBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    branchesApi
      .list(companyId)
      .then((branches: BranchDto[]) => {
        const hq =
          branches.find((b) => b.isMain) ||
          branches.find((b) => b.code === "HQ") ||
          branches[0]; // safe fallback

        setHqBranchId(hq?.id ?? null);
      })
      .catch((e) => setError(e?.message ?? "Failed to load branches"))
      .finally(() => setLoading(false));
  }, [companyId]);

  return { hqBranchId, loading, error };
}
