// src/features/organization/hooks/useBranches.ts

import { useCallback, useEffect, useState } from "react";

import { orgApi } from "../api/orgApi";
import type { BranchDto } from "../types";

export function useBranches(companyId: string | null) {
  const [items, setItems] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await orgApi.listBranches(companyId, {
        page: 1,
        pageSize: 500,
      });

      setItems((response.data.items ?? []) as BranchDto[]);
    } catch (err) {
      setError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}