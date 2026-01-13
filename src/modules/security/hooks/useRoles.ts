import { useEffect, useMemo, useState } from "react";
import { securityApi } from "../api/securityApi";
import type{RoleDto}from "../api/securityApi"

export function useRoles() {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await securityApi.listRoles();
        if (!alive) return;
        setRoles(data);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load roles");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  return { roles, byId, loading, error, refresh: async () => setRoles(await securityApi.listRoles()) };
}
