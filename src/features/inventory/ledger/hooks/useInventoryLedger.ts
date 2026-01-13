import { useEffect, useMemo, useState } from "react";
import { inventoryLedgerApi } from "../api/inventoryLedgerApi";
import type { InventoryLedgerQuery, InventoryLedgerDto, PagedResult } from "../types";

export function useInventoryLedger(companyId: string | null, query: InventoryLedgerQuery) {
  const [data, setData] = useState<PagedResult<InventoryLedgerDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const stableQuery = useMemo(
    () => ({
      ...query,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 50,
    }),
    [
      query.fromUtc,
      query.toUtc,
      query.itemId,
      query.locationId,
      query.item,
      query.location,
      query.referenceNo,
      query.page,
      query.pageSize,
    ]
  );

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await inventoryLedgerApi.list(companyId, stableQuery);
        if (!cancelled) setData(res);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load inventory ledger.";

        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // ✅ cleanup function
    return () => {
      cancelled = true;
    };
  }, [companyId, stableQuery]);

  const paging = useMemo(() => {
    const page = data?.page ?? stableQuery.page ?? 1;
    const pageSize = data?.pageSize ?? stableQuery.pageSize ?? 50;
    const totalPages = data?.totalPages ?? 1;
    const totalCount = data?.totalCount ?? 0;

    return {
      page,
      pageSize,
      totalPages,
      totalCount,
      canPrev: page > 1,
      canNext: page < totalPages,
    };
  }, [data, stableQuery.page, stableQuery.pageSize]);

  return { data, paging, loading, error };
}
