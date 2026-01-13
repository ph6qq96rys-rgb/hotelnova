import { useCallback, useEffect, useMemo, useState } from "react";
import { stockLocationsApi } from "../api/stockLocationsApi";
import type { StockLocationDto, StockLocationFilter } from "../types";

type ApiError = {
  message: string;
  status?: number;
};

function toApiError(err: unknown): ApiError {
  // Axios-style (if your http wrapper uses axios)
  const anyErr = err as any;
  const status = anyErr?.response?.status ?? anyErr?.status;
  const message =
    anyErr?.response?.data?.message ??
    anyErr?.message ??
    "Request failed";

  return { message, status };
}

export function useStockLocations(filter: StockLocationFilter) {
  const [items, setItems] = useState<StockLocationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // stable deps (avoid re-fetch loops if caller passes new object each render)
  const key = useMemo(
    () => `${filter.companyId ?? ""}|${filter.branchId ?? ""}|${filter.q ?? ""}`,
    [filter.companyId, filter.branchId, filter.q]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await stockLocationsApi.list(filter); // AxiosResponse<StockLocationDto[]>
      setItems(res.data ?? []);
    } catch (e) {
      setItems([]);
      setError(toApiError(e));
    } finally {
      setLoading(false);
    }
  }, [key]); // uses key for stability

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await stockLocationsApi.list(filter);
        if (!cancelled) setItems(res.data ?? []);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(toApiError(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { items, loading, error, refresh };
}
