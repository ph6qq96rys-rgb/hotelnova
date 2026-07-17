// src/features/organization/hooks/useStores.ts

import { useCallback, useEffect, useState } from "react";

import { orgApi } from "../api/orgApi";
import type { StoreDto } from "../types";

function getErrorMessage(error: unknown, fallback = "Failed to load stores."): string {
  if (error instanceof Error && error.message) return error.message;

  const e = error as {
    response?: { data?: { message?: string; title?: string } | string };
    message?: string;
  };

  if (typeof e?.response?.data === "string") return e.response.data;

  return e?.response?.data?.message ?? e?.response?.data?.title ?? e?.message ?? fallback;
}

export function useStores(companyId: string | null, branchId?: string | null) {
  const [items, setItems] = useState<StoreDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!companyId) {
      setItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await orgApi.listStores(companyId, branchId, {
        page: 1,
        pageSize: 500,
      });
      setItems((response.data.items ?? []) as StoreDto[]);
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
