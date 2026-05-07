// src/modules/security/hooks/useEffectivePermissions.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../api/securityApi";
type RoleAssignment = { roleId: string; branchId?: string | null };
type State =
  | { status: "idle" | "loading" }
  | { status: "loaded"; rolePermissionKeys: string[] }
  | { status: "error"; message: string };

function uniqSorted(list: string[]) {
  return Array.from(new Set(list.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
/**
 * Effective permissions = (union of permissions from assigned roles) + (direct user permissions)
 * - Caches role permissionKeys by roleId so we don't refetch constantly.
 */
export function useEffectivePermissions( companyId: string,
  roleAssignments: RoleAssignment[],
  directPermissionKeys: string[]
) {
  const [state, setState] = useState<State>({ status: "idle" });

  const cacheRef = useRef<Map<string, string[]>>(new Map());


  const roleIds = useMemo(
    () => uniqSorted(roleAssignments.map(a => a.roleId)),
    [roleAssignments]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      if (roleIds.length === 0) {
        setState({ status: "loaded", rolePermissionKeys: [] });
        return;
      }

      setState({ status: "loading" });

      try {
        const missing = roleIds.filter(id => !cacheRef.current.has(id));
        if (missing.length) {
          const details = await Promise.all(missing.map(id => securityApi.getRole(companyId, id)));
          for (const d of details) {
            cacheRef.current.set(d.data.role.id, d.data.permissionKeys ?? []);
          }
        }

        const collected = roleIds.flatMap(id => cacheRef.current.get(id) ?? []);
        if (!alive) return;
        setState({ status: "loaded", rolePermissionKeys: uniqSorted(collected) });
      } catch (e: unknown) {
        if (!alive) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to compute effective permissions.",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [roleIds]);

  const effective = useMemo(() => {
    const rolePerms =
      state.status === "loaded" ? state.rolePermissionKeys : [];
    return uniqSorted([...(rolePerms ?? []), ...(directPermissionKeys ?? [])]);
  }, [state, directPermissionKeys]);

  return { state, effective };
}
