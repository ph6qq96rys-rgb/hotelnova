// src/features/inventory/stockTransfers/hooks/useAsyncLookup.ts

import { useEffect, useState } from "react";
import { getApiError } from "../utils/apiUtils";

export type LookupState<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
};

export function useAsyncLookup<T>(
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T[]>
): LookupState<T> {
  const [state, setState] = useState<LookupState<T>>({
    data: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({
            data,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            data: [],
            loading: false,
            error: getApiError(error, "Failed to load lookup data."),
          });
        }
      });

    return () => controller.abort();
  }, [enabled, load]);

  return state;
}
