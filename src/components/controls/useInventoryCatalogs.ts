import { useEffect, useMemo, useState } from "react";
import { inventoryCatalogsApi } from "./inventoryCatalogsApi";
import type { InventoryCatalogsDto } from "./types";

type State = {
  data: InventoryCatalogsDto | null;
  loading: boolean;
  error: string | null;
};

export function useInventoryCatalogs(companyId: string | null, activeOnly: boolean = true) {
  const [state, setState] = useState<State>({
    data: null,
    loading: false,
    error: null,
  });

  const key = useMemo(() => `${companyId ?? ""}:${activeOnly}`, [companyId, activeOnly]);

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    (async () => {
      try {
        setState(s => ({ ...s, loading: true, error: null }));
        const dto = await inventoryCatalogsApi.getCatalogs(companyId, activeOnly);
        if (!cancelled) setState({ data: dto, loading: false, error: null });
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load inventory catalogs.";
        if (!cancelled) setState(s => ({ ...s, loading: false, error: msg }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, companyId, activeOnly]);

  return state; // { data, loading, error }
}
