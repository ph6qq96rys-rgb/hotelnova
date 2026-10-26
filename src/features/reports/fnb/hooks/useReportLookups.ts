import { useEffect, useState } from "react";

import { http } from "../../../../api/http";
import { requestErrorMessage } from "../utils/fnbRequest";

export type ReportOption = { id: string; label: string };

type RawItem = { id?: string; itemId?: string; sku?: string | null; code?: string | null; name?: string | null; isActive?: boolean };
type RawCategory = { id?: string; code?: string | null; name?: string | null; isActive?: boolean };

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const value = data as { items?: T[]; data?: T[] } | null;
  return value?.items ?? value?.data ?? [];
}

function label(code?: string | null, name?: string | null): string {
  const c = (code ?? "").trim();
  const n = (name ?? "").trim();
  return c && n ? `${c} - ${n}` : n || c;
}

/** Items and categories for the report filters (company master data). */
export function useReportLookups(companyId?: string | null) {
  const [items, setItems] = useState<ReportOption[]>([]);
  const [categories, setCategories] = useState<ReportOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems([]);
    setCategories([]);
    setError(null);
    if (!companyId) return;
    const controller = new AbortController();

    Promise.all([
      http.get(`/companies/${companyId}/inventory-master/items`, { signal: controller.signal }),
      http.get(`/companies/${companyId}/inventory-categories`, { signal: controller.signal }),
    ])
      .then(([itemResponse, categoryResponse]) => {
        setItems(unwrap<RawItem>(itemResponse.data)
          .map((x) => ({ id: x.itemId || x.id || "", label: label(x.sku || x.code, x.name) }))
          .filter((x) => x.id && x.label)
          .sort((a, b) => a.label.localeCompare(b.label)));
        setCategories(unwrap<RawCategory>(categoryResponse.data)
          .filter((x) => x.isActive !== false)
          .map((x) => ({ id: x.id || "", label: label(x.code, x.name) }))
          .filter((x) => x.id && x.label)
          .sort((a, b) => a.label.localeCompare(b.label)));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(requestErrorMessage(err, "Items and categories could not be loaded."));
      });

    return () => controller.abort();
  }, [companyId]);

  return { items, categories, error };
}
