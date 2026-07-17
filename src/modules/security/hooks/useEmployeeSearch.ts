import { useEffect, useState } from "react";
import { securityApi } from "../api/securityApi";
import type { EmployeeOption } from "../api/securityApi";

export function useEmployeeSearch(
  enabled: boolean,
  companyId: string,
  query: string,
) {
  const [items, setItems] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !companyId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load(): Promise<void> {
      setLoading(true);
      try {
        const rows = await securityApi.searchEmployees(
          companyId,
          { q: query || undefined, page: 1, pageSize: 100 },
          controller.signal,
        );
        if (!controller.signal.aborted) setItems(rows);
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [companyId, enabled, query]);

  return { items, loading };
}
