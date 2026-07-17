import { useEffect, useMemo, useRef, useState } from "react";
import { inventoryLedgerApi, type InventoryLedgerQuery } from "../api/inventoryLedgerApi";
import type { InventoryLedgerDto, PagedResult } from "../types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

type State = {
  data: PagedResult<InventoryLedgerDto> | null;
  loading: boolean;
  error: string | null;
};

export function useInventoryLedger(
  companyId: string | null,
  branchId: string | null,
  query: InventoryLedgerQuery,
) {
  const requestId = useRef(0);
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  const stableQuery = useMemo<InventoryLedgerQuery>(() => ({
    fromUtc: query.fromUtc ?? null,
    toUtc: query.toUtc ?? null,
    itemId: query.itemId ?? null,
    locationId: query.locationId ?? null,
    item: query.item ?? null,
    location: query.location ?? null,
    referenceNo: query.referenceNo ?? null,
    movementType: query.movementType ?? null,
    batchNo: query.batchNo ?? null,
    page: query.page ?? DEFAULT_PAGE,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
  }), [
    query.fromUtc, query.toUtc, query.itemId, query.locationId,
    query.item, query.location, query.referenceNo, query.movementType,
    query.batchNo, query.page, query.pageSize,
  ]);

  useEffect(() => {
    if (!companyId || !branchId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const currentId = ++requestId.current;
    const controller = new AbortController();

    setState((previous) => ({ ...previous, loading: true, error: null }));

    void inventoryLedgerApi.list(companyId, branchId, stableQuery, controller.signal)
      .then((data) => {
        if (requestId.current !== currentId) return;
        setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId.current !== currentId) return;
        setState((previous) => ({ ...previous, loading: false, error: getErrorMessage(error) }));
      });

    return () => controller.abort();
  }, [companyId, branchId, stableQuery]);

  const paging = useMemo(() => {
    const page = state.data?.page ?? stableQuery.page ?? DEFAULT_PAGE;
    const pageSize = state.data?.pageSize ?? stableQuery.pageSize ?? DEFAULT_PAGE_SIZE;
    const totalPages = Math.max(state.data?.totalPages ?? 1, 1);
    const totalCount = state.data?.totalCount ?? 0;
    return { page, pageSize, totalPages, totalCount, canPrev: page > 1, canNext: page < totalPages };
  }, [state.data, stableQuery.page, stableQuery.pageSize]);

  return { ...state, paging };
}

function getErrorMessage(error: unknown): string {
  const apiError = error as {
    message?: string;
    response?: { data?: { detail?: string; message?: string; title?: string } };
  };
  return apiError.response?.data?.detail
    ?? apiError.response?.data?.message
    ?? apiError.response?.data?.title
    ?? apiError.message
    ?? "Failed to load inventory ledger.";
}
