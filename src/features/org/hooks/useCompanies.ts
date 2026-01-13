import { useCallback, useEffect, useState } from "react";
import { orgApi } from "../api/orgApi";
import type { CompanyDto } from "../types";

export function useCompanies() {
  const [items, setItems] = useState<CompanyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orgApi.listCompanies({ page: 1, pageSize: 500 });
      setItems(res.data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load companies");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
