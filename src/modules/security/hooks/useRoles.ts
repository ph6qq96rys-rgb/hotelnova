import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../api/securityApi";
import type { RoleDto } from "../../../features/security/api/securityApi";

export function useRoles(companyId: string) {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState<boolean>(!!companyId);
  const [error, setError] = useState<string | null>(null);

  // request sequencing to ignore stale responses
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!companyId) {
      setRoles([]);
      setLoading(false);
      setError("Missing companyId in route.");
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await securityApi.listRoles(companyId);
      if (seq !== seqRef.current) return;

      // axios response: res.data
      const list = res ?? [];
      setRoles(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      if (seq !== seqRef.current) return;
      setRoles([]);
      setError(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
    return () => {
      seqRef.current++;
    };
  }, [load]);

  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  return { roles, byId, loading, error, refresh: load };
}
