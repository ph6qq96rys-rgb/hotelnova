import { useCallback, useEffect, useState } from "react";
import {
  getFnbReportCatalog,
  type FnbReportCatalogItemDto,
} from "../api/fnbReportsApi";

export function useFnbReportCatalog(
  companyId?: string | null,
  branchId?: string | null,
) {
  const [items, setItems] = useState<FnbReportCatalogItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !branchId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getFnbReportCatalog(companyId, branchId);
      setItems(data.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load F&B catalog.");
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}