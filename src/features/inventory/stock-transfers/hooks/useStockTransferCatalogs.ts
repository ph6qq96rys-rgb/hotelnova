import { useEffect, useMemo, useState } from "react";
import { http } from "../../../../api/http";
import type { BranchOptionDto, ItemOptionDto } from "../types";

type UseLookupState<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
};

function isGuid(value?: string | null): value is string {
  return Boolean(value && value.trim().length > 0);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Failed to load lookup data.";
}

function normalizeBranch(x: any): BranchOptionDto {
  return {
    id: x.id ?? x.branchId,
    name: x.name ?? x.branchName ?? "",
    code: x.code ?? x.branchCode ?? null,
    label:
      x.label ??
      `${x.code ?? x.branchCode ?? ""} ${x.name ?? x.branchName ?? ""}`.trim(),
  };
}

function normalizeItem(x: any): ItemOptionDto {
  const itemId = x.id ?? x.itemId ?? x.inventoryItemId;
  const baseUomId = x.defaultUomId ?? x.baseUomId ?? x.uomId ?? x.unitId ?? "";

  const baseUom = x.baseUom ?? {
    id: baseUomId,
    code: x.baseUomCode ?? x.uomCode ?? x.unitCode ?? "",
    name:
      x.baseUomName ??
      x.uomName ??
      x.unitName ??
      x.baseUomCode ??
      x.uomCode ??
      x.unitCode ??
      "",
  };

  return {
    id: itemId,
    itemId,

    code: x.code ?? x.sku ?? x.itemCode ?? "",
    name: x.name ?? x.itemName ?? "",
    label:
      x.label ??
      `${x.code ?? x.sku ?? x.itemCode ?? ""} ${
        x.name ?? x.itemName ?? ""
      }`.trim(),

    defaultUomId: baseUomId || null,
    baseUom,
  };
}

function useLookup<T>(
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T[]>
): UseLookupState<T> {
  const [state, setState] = useState<UseLookupState<T>>({
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
            error: getErrorMessage(error),
          });
        }
      });

    return () => controller.abort();
  }, [enabled, load]);

  return state;
}

export function useBranches(companyId?: string) {
  const enabled = isGuid(companyId);

  const load = useMemo(
    () => async (signal: AbortSignal): Promise<BranchOptionDto[]> => {
      if (!companyId) return [];

      const response = await http.get<BranchOptionDto[]>(
        `/onboarding/companies/${companyId}/branches`,
        { signal }
      );

      return (response.data ?? []).map(normalizeBranch);
    },
    [companyId]
  );

  const { data, loading, error } = useLookup(enabled, load);

  return {
    branches: data,
    loading,
    error,
  };
}

export function useItems(companyId?: string, branchId?: string) {
  const enabled = isGuid(companyId) && isGuid(branchId);

  const load = useMemo(
    () => async (signal: AbortSignal): Promise<ItemOptionDto[]> => {
      if (!companyId || !branchId) return [];

      const response = await http.get<any[]>(
        `/companies/${companyId}/branches/${branchId}/inventory/items`,
        { signal }
      );

      return (response.data ?? [])
        .map(normalizeItem)
        .filter((x) => isGuid(x.itemId));
    },
    [companyId, branchId]
  );

  const { data, loading, error } = useLookup(enabled, load);

  return {
    items: data,
    loading,
    error,
  };
}