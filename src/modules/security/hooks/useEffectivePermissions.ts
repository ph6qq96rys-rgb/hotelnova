// src/modules/security/hooks/useEffectivePermissions.ts
//
// Computes effective permissions = union of all role permission keys + direct.
// Role details are cached per companyId+roleId to avoid redundant API calls.

import { useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../api/securityApi";
import { uniqSorted } from "../utils/security.utils";
import type { RoleAssignment, EffectivePermissionsState } from "../types/security.types";

export function useEffectivePermissions(
  companyId:            string | null,
  roleAssignments:      RoleAssignment[],
  directPermissionKeys: string[]
) {
  const [state, setState] = useState<EffectivePermissionsState>({ status: "idle" });

  // Cache keyed by `${companyId}:${roleId}` — prevents cross-company hits
  const cache = useRef<Map<string, string[]>>(new Map());

  const roleIds = useMemo(
    () => uniqSorted(roleAssignments.map((a) => a.roleId)),
    [roleAssignments]
  );

  useEffect(() => {
    let alive = true;

    if (!companyId || roleIds.length === 0) {
      setState({ status: "loaded", rolePermissionKeys: [] });
      return;
    }

    setState({ status: "loading" });

    (async () => {
      try {
        const missing = roleIds.filter((id) => !cache.current.has(`${companyId}:${id}`));

        if (missing.length > 0) {
          const details = await Promise.all(
            missing.map((id) => securityApi.getRole(companyId, id))
          );
          for (const d of details) {
            const key = `${companyId}:${d.data.role.id}`;
            cache.current.set(key, d.data.permissionKeys ?? []);
          }
        }

        if (!alive) return;

        const collected = roleIds.flatMap(
          (id) => cache.current.get(`${companyId}:${id}`) ?? []
        );
        setState({ status: "loaded", rolePermissionKeys: uniqSorted(collected) });
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Failed to compute effective permissions.";
        setState({ status: "error", message: msg });
      }
    })();

    return () => { alive = false; };
  }, [companyId, roleIds]);

  const effective = useMemo<string[]>(() => {
    const rolePerms = state.status === "loaded" ? state.rolePermissionKeys : [];
    return uniqSorted([...rolePerms, ...(directPermissionKeys ?? [])]);
  }, [state, directPermissionKeys]);

  return { state, effective };
}