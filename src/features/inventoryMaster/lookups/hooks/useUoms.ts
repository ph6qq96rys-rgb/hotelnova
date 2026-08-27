import { useEffect, useMemo, useState } from "react";
import { toUserFriendlyError } from "../../../../shared/errors/errorMessage.utils";
import { lookupsApi } from "../api/lookupsApi";
import type { UomDto } from "../types";

export function useUoms(companyId: string) {
  const [uoms, setUoms] = useState<UomDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    lookupsApi
      .uoms(companyId)
      .then(r => setUoms((r.data ?? []).filter(x => x.isActive)))
      .catch(err => setError(toUserFriendlyError(
        err,
        "Units of measure could not be loaded. Please try again."
      )))
      .finally(() => setLoading(false));
  }, [companyId]);

  const uomMap = useMemo(() => {
    const m = new Map<string, UomDto>();
    uoms.forEach(u => m.set(u.id, u));
    return m;
  }, [uoms]);

  return { uoms, uomMap, loading, error };
}
