import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api/orgApi";
import type { BranchDto } from "../types";

export function useBranches(companyId: string | null) {
  const [items, setItems] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await orgApi.listBranches(companyId, { page: 1, pageSize: 500 });
      setItems(res.data.items ?? []);
    } catch (e: any) {
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
