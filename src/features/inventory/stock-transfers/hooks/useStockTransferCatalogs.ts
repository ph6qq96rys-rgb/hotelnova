import { useEffect, useState } from "react";
import { http } from "../../../../api/http";
import type { BranchOptionDto, ItemOptionDto } from "../types";

export function useBranches(companyId?: string) {
  const [branches, setBranches] = useState<BranchOptionDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    http
      .get<BranchOptionDto[]>(`/onboarding/companies/${companyId}/branches`, { params: { companyId } })
      .then((r) => setBranches(r.data))
      .finally(() => setLoading(false));
  }, [companyId]);

  return { branches, loading };
}

export function useItems(companyId?: string) {
  const [items, setItems] = useState<ItemOptionDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    http
      .get<ItemOptionDto[]>(`/onboarding/companies/${companyId}/items`)
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, [companyId]);

  return { items, loading };
}
