// src/modules/security/hooks/useEffectivePermissions.ts

import { useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../api/securityApi";
import { extractSecurityError, isCancelled, uniqSorted } from "../utils/security.utils";
import type {
  EffectivePermissionsState,
  RoleAssignment,
} from "../types/security.types";

export function useEffectivePermissions(
  companyId: string | null | undefined,
  roleAssignments: RoleAssignment[],
  directPermissionKeys: string[]
) {
  const [state, setState] = useState<EffectivePermissionsState>({
    status: "idle",
  });

  const cache = useRef<Map<string, string[]>>(new Map());

  const roleIds = useMemo(
    () => uniqSorted(roleAssignments.map((assignment) => assignment.roleId)),
    [roleAssignments]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!companyId || roleIds.length === 0) {
        setState({
          status: "loaded",
          rolePermissionKeys: [],
        });
        return;
      }

      setState({ status: "loading" });

      try {
        const missingRoleIds = roleIds.filter(
          (roleId) => !cache.current.has(`${companyId}:${roleId}`)
        );

        if (missingRoleIds.length > 0) {
          const roleDetails = await Promise.all(
            missingRoleIds.map((roleId) =>
              securityApi.getRole(companyId, roleId, controller.signal)
            )
          );

          for (const detail of roleDetails) {
            const cacheKey = `${companyId}:${detail.role.id}`;
            cache.current.set(cacheKey, detail.permissionKeys ?? []);
          }
        }

        if (controller.signal.aborted) return;

        const collectedPermissionKeys = roleIds.flatMap(
          (roleId) => cache.current.get(`${companyId}:${roleId}`) ?? []
        );

        setState({
          status: "loaded",
          rolePermissionKeys: uniqSorted(collectedPermissionKeys),
        });
      } catch (error) {
        if (controller.signal.aborted || isCancelled(error)) return;

        setState({
          status: "error",
          message: extractSecurityError(
            error,
            "Failed to compute effective permissions."
          ),
        });
      }
    }

    void load();

    return () => controller.abort();
  }, [companyId, roleIds]);

  const effective = useMemo(() => {
    const rolePermissionKeys =
      state.status === "loaded" ? state.rolePermissionKeys : [];

    return uniqSorted([
      ...rolePermissionKeys,
      ...(directPermissionKeys ?? []),
    ]);
  }, [state, directPermissionKeys]);

  return {
    state,
    effective,
  };
}