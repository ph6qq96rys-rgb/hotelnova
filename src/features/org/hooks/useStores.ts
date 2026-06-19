import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api/orgApi";
import type { StoreDto } from "../types";

export function useStores(
  companyId: string | null,
  branchId?: string | null
) {
  const [items, setItems] = useState<StoreDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await orgApi.listStores(
        companyId,
        branchId,
        {
          page: 1,
          pageSize: 500,
        }
      );

      setItems((res.data.items ?? []) as StoreDto[]);
    } catch (err) {
      setError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

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