import { useEffect, useMemo, useState } from "react";
import { lookupsApi } from "../api/lookupsApi";
import type { CategoryDto } from "../types";

export function useCategories(companyId: string) {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    lookupsApi
      .categories(companyId)
      .then(r => setCategories((r.data ?? []).filter(x => x.isActive)))
      .catch(err => setError(err?.message ?? "Failed to load categories"))
      .finally(() => setLoading(false));
  }, [companyId]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, CategoryDto>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  return { categories, categoryMap, loading, error };
}
