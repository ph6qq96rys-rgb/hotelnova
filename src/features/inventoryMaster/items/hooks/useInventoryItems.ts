// src/features/inventory/items/hooks/useInventoryItems.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { toUserFriendlyError } from "../../../../shared/errors/errorMessage.utils";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
import type { InventoryItemDto } from "../types";

interface UseInventoryItemsResult {
  items:   InventoryItemDto[];
  loading: boolean;
  error:   string | null;
  refresh: () => void;
}

export function useInventoryItems(companyId: string, q = ""): UseInventoryItemsResult {
  const [items,   setItems]   = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Stable ref so `refresh` identity doesn't change on every render.
  const paramsRef = useRef({ companyId, q });
  paramsRef.current = { companyId, q };

  const load = useCallback(() => {
    const { companyId: cid, q: query } = paramsRef.current;
    if (!cid) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    inventoryItemsApi
      .list(cid, query || undefined)
      .then((data) => { if (!cancelled) setItems(data ?? []); })
      .catch((err) => {
        if (!cancelled) {
          setError(toUserFriendlyError(
            err,
            "Inventory items could not be loaded. Please try again."
          ));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []); // no deps - reads from ref

  // Re-run whenever companyId or q changes.
  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [companyId, q, load]);

  return { items, loading, error, refresh: load };
}
