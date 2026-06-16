// src/modules/security/hooks/useRoles.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { securityApi } from "../api/securityApi";
import { extractSecurityError, isCancelled } from "../utils/security.utils";
import type { RoleDto } from "../types/security.types";

export function useRoles(companyId?: string | null) {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) {
        setRoles([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await securityApi.listRoles(companyId, signal);
        setRoles(Array.isArray(result) ? result : []);
      } catch (e) {
        if (isCancelled(e)) return;

        setRoles([]);
        setError(extractSecurityError(e, "Failed to load roles."));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [companyId]
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const byId = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles]
  );

  return {
    roles,
    byId,
    loading,
    error,
    refresh: () => load(),
  };
}