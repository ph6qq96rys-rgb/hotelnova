import { useEffect, useState } from "react";
import { inventoryItemsApi } from "../api/inventoryItemsApi";
import type { InventoryItemDto } from "../types";

export function useInventoryItems(companyId: string, q: string) {
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    inventoryItemsApi
      .list(companyId, { q: q } as any)
      .then(r => setItems(r ?? []))
      .catch(err => setError(err?.message ?? "Failed to load items"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, q]);

  return { items, loading, error, refresh };
}
