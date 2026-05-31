// src/modules/security/hooks/useRoles.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { securityApi } from "../api/securityApi";
import { isCancelled, extractSecurityError } from "../utils/security.utils";
import { useAbortable } from "./useAbortable";
import type { RoleDto } from "../types/security.types";

export function useRoles(companyId: string | null) {
  const [roles,   setRoles]   = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const { begin, abort } = useAbortable();

  const load = useCallback(async () => {
    if (!companyId) { setRoles([]); setError(null); return; }
    const signal = begin();
    setLoading(true); setError(null);
    try {
      const res = await securityApi.listRoles(companyId, signal);
      setRoles(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (isCancelled(e)) return;
      setRoles([]);
      setError(extractSecurityError(e, "Failed to load roles."));
    } finally { setLoading(false); }
  }, [companyId, begin]);

  useEffect(() => { void load(); return abort; }, [load, abort]);

  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  return { roles, byId, loading, error, refresh: load };
}