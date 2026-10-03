import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFnbReportCatalog,
  type FnbReportCatalogDto,
} from "../api/fnbReportsApi";

export function useFnbReportCatalog(
  companyId?: string | null,
  branchId?: string | null,
) {
  const [catalog, setCatalog] = useState<(FnbReportCatalogDto & { scope: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scope = `${companyId ?? ""}/${branchId ?? ""}`;

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setCatalog(null);
    setError(null);
    if (!companyId || !branchId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await getFnbReportCatalog(companyId, branchId, controller.signal);
      if (controller.signal.aborted) return;
      setCatalog({ ...data, scope });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to load F&B catalog.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [companyId, branchId, scope]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Hide the prior tenant's catalog immediately, before effect cleanup runs.
  const current = catalog?.scope === scope ? catalog : null;
  return {
    items: current?.reports ?? [],
    timeZone: current?.timeZone ?? null,
    defaultDate: current?.defaultDate ?? null,
    loading, error, reload: load,
  };
}
