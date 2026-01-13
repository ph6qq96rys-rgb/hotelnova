import { useCallback, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import type { CreateSaleDto, CreateSaleInput } from "../types";

export function usePostSale(locationId: string) {
  const { companyId } = useAppScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postSale = useCallback(
    async (input: CreateSaleInput, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const dto: CreateSaleDto = {
          companyId,
          ...input,
        };
        return await salesApi.postSale(dto, signal);
      } catch (e: any) {
        setError(e?.message ?? "Failed to post sale.");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [companyId, locationId]
  );

  return { postSale, loading, error };
}
