import { useState } from "react";
import { inventoryAdjustmentsApi } from "../inventory-adjustments/api/inventoryAdjustmentsApi"
import type { CreateInventoryAdjustmentDto } from "../inventory-adjustments/types"

function extractApiError(err: any): string {
  const data = err?.response?.data;

  // Common API patterns
  if (typeof data === "string" && data.trim()) return data;

  if (data?.message) return data.message;

  // ASP.NET validation problem details: { title, errors: { Field: ["msg"] } }
  if (data?.errors && typeof data.errors === "object") {
    const firstKey = Object.keys(data.errors)[0];
    const firstMsg = data.errors[firstKey]?.[0];
    if (firstMsg) return firstMsg;
  }

  return err?.message ?? "Request failed";
}

export function useInventoryAdjustment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //  Return the created adjustment id so UI can navigate to detail page
  const submit = async (payload: CreateInventoryAdjustmentDto): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const res = await inventoryAdjustmentsApi.create(payload);
      // Expecting { id: string }
      return res.id;
    } catch (e: any) {
      const message = extractApiError(e);
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}
