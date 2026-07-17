// src/features/inventory/stockTransfers/hooks/useStockTransferCatalogs.ts

import { useMemo } from "react";
import { http } from "../../../../api/http";
import type { BranchOptionDto, ItemOptionDto } from "../types";
import { stockTransfersApi, type ItemLookupDto, type UomLookupDto } from "../api/stockTransfersApi";
import { locationsApi } from "../api/locationsApi";
import {
  normalizeBranch,
  normalizeItem,
  type NormalizedStockLocation,
} from "../mapping/stockTransferMappers";
import { unwrapArray } from "../utils/apiUtils";
import { useAsyncLookup } from "./useAsyncLookup";

function isId(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0);
}

export function useBranches(companyId?: string | null) {
  const enabled = isId(companyId);

  const load = useMemo(
    () => async (signal: AbortSignal): Promise<BranchOptionDto[]> => {
      if (!companyId) return [];

      const response = await http.get(
        `/onboarding/companies/${companyId}/branches`,
        { signal }
      );

      return unwrapArray<BranchOptionDto>(response)
        .map(normalizeBranch)
        .filter((branch) => Boolean(branch.id));
    },
    [companyId]
  );

  const { data, loading, error } = useAsyncLookup(enabled, load);

  return {
    branches: data,
    loading,
    error,
  };
}

export function useItems(companyId?: string | null, branchId?: string | null) {
  const enabled = isId(companyId) && isId(branchId);

  const load = useMemo(
    () => async (signal: AbortSignal): Promise<ItemOptionDto[]> => {
      if (!companyId || !branchId) return [];

      const response = await http.get(
        `/companies/${companyId}/branches/${branchId}/inventory/items`,
        { signal }
      );

      return unwrapArray<ItemOptionDto>(response)
        .map(normalizeItem)
        .filter((item): item is ItemOptionDto => Boolean(item?.itemId));
    },
    [companyId, branchId]
  );

  const { data, loading, error } = useAsyncLookup(enabled, load);

  return {
    items: data,
    loading,
    error,
  };
}

export function useStockTransferCatalogs(
  companyId?: string | null,
  branchId?: string | null
) {
  const enabled = isId(companyId) && isId(branchId);

  const branchesLoad = useMemo(
    () => async (signal: AbortSignal) => {
      if (!companyId) return [];

      const response = await http.get(
        `/onboarding/companies/${companyId}/branches`,
        { signal }
      );

      return unwrapArray<BranchOptionDto>(response).map(normalizeBranch);
    },
    [companyId]
  );

  const locationsFromLoad = useMemo(
    () => async (signal: AbortSignal): Promise<NormalizedStockLocation[]> => {
      if (!companyId || !branchId) return [];

      return locationsApi.list({
        companyId,
        branchId,
        activeOnly: true,
        capability: "TransferFrom",
        signal,
      });
    },
    [companyId, branchId]
  );

  const locationsToLoad = useMemo(
    () => async (signal: AbortSignal): Promise<NormalizedStockLocation[]> => {
      if (!companyId || !branchId) return [];

      return locationsApi.list({
        companyId,
        branchId,
        activeOnly: true,
        capability: "TransferTo",
        signal,
      });
    },
    [companyId, branchId]
  );

  const itemsLoad = useMemo(
    () => async (): Promise<ItemLookupDto[]> => {
      if (!companyId) return [];
      return stockTransfersApi.catalog.items(companyId);
    },
    [companyId]
  );

  const uomsLoad = useMemo(
    () => async (): Promise<UomLookupDto[]> => {
      if (!companyId) return [];
      return stockTransfersApi.catalog.uoms(companyId);
    },
    [companyId]
  );

  const branchesState = useAsyncLookup(isId(companyId), branchesLoad);
  const fromLocationsState = useAsyncLookup(enabled, locationsFromLoad);
  const toLocationsState = useAsyncLookup(enabled, locationsToLoad);
  const itemsState = useAsyncLookup(isId(companyId), itemsLoad);
  const uomsState = useAsyncLookup(isId(companyId), uomsLoad);

  const warehouseBranch = useMemo(() => {
    return (
      branchesState.data.find((branch: any) => branch.isMain) ??
      branchesState.data.find((branch) => branch.code === "HQ") ??
      branchesState.data[0] ??
      null
    );
  }, [branchesState.data]);

  const loading =
    branchesState.loading ||
    fromLocationsState.loading ||
    toLocationsState.loading ||
    itemsState.loading ||
    uomsState.loading;

  const error =
    branchesState.error ||
    fromLocationsState.error ||
    toLocationsState.error ||
    itemsState.error ||
    uomsState.error ||
    null;

  return {
    branches: branchesState.data,
    warehouseBranch,
    fromLocations: fromLocationsState.data,
    toLocations: toLocationsState.data,
    items: itemsState.data,
    uoms: uomsState.data,
    loading,
    error,
  };
}
