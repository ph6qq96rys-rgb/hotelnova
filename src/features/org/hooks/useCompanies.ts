// src/features/organization/hooks/useCompanies.ts

import { useCallback, useEffect, useState } from "react";

import { orgApi } from "../api/orgApi";
import type { CompanyDto } from "../types";

function getErrorMessage(error: unknown, fallback = "Failed to load companies."): string {
  if (error instanceof Error && error.message) return error.message;

  const e = error as {
    response?: { data?: { message?: string; title?: string } | string };
    message?: string;
  };

  if (typeof e?.response?.data === "string") return e.response.data;

  return e?.response?.data?.message ?? e?.response?.data?.title ?? e?.message ?? fallback;
}

export function useCompanies() {
  const [items, setItems] = useState<CompanyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await orgApi.listCompanies({ page: 1, pageSize: 500 });
      setItems((response.data.items ?? []) as CompanyDto[]);
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
