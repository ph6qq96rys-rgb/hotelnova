// src/modules/security/hooks/useEffectivePermissions.ts

import { useEffect, useMemo, useRef, useState } from "react";

import { securityApi } from "../api/securityApi";
import {
  extractSecurityError,
  isCancelled,
  uniqSorted,
} from "../utils/security.utils";

import type {
  EffectivePermissionsState,
  RoleAssignment,
} from "../types/security.types";

type RolePermissionCache = Map<string, string[]>;

function cacheKey(companyId: string, roleId: string): string {
  return `${companyId}:${roleId}`;
}

function roleDetailId(detail: any): string | null {
  return detail?.id ?? detail?.role?.id ?? null;
}

function roleDetailPermissionKeys(detail: any): string[] {
  return uniqSorted([
    ...((detail?.permissionKeys ?? []) as string[]),
    ...(((detail?.role as any)?.permissionKeys ?? []) as string[]),
  ]);
}

export function useEffectivePermissions(
  companyId: string | null | undefined,
  roleAssignments: RoleAssignment[] = [],
  directPermissionKeys: string[] = []
) {
  const [state, setState] = useState<EffectivePermissionsState>({
    status: "idle",
  });

  const cache = useRef<RolePermissionCache>(new Map());

  const roleIds = useMemo(
    () =>
      uniqSorted(
        roleAssignments
          .map((assignment) => assignment.roleId)
          .filter(Boolean)
      ),
    [roleAssignments]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!companyId) {
        setState({
          status: "loaded",
          rolePermissionKeys: [],
        });
        return;
      }

      if (roleIds.length === 0) {
        setState({
          status: "loaded",
          rolePermissionKeys: [],
        });
        return;
      }

      setState({ status: "loading" });

      try {
        const missingRoleIds = roleIds.filter(
          (roleId) => !cache.current.has(cacheKey(companyId, roleId))
        );

        if (missingRoleIds.length > 0) {
          const roleDetails = await Promise.all(
            missingRoleIds.map((roleId) =>
              securityApi.getRole(companyId, roleId, controller.signal)
            )
          );

          for (let i = 0; i < roleDetails.length; i += 1) {
            const detail = roleDetails[i] as any;
            const fallbackRoleId = missingRoleIds[i];
            const resolvedRoleId = roleDetailId(detail) ?? fallbackRoleId;

            cache.current.set(
              cacheKey(companyId, resolvedRoleId),
              roleDetailPermissionKeys(detail)
            );
          }
        }

        if (controller.signal.aborted) return;

        const collectedPermissionKeys = roleIds.flatMap(
          (roleId) => cache.current.get(cacheKey(companyId, roleId)) ?? []
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
    loading: state.status === "loading",
    error: state.status === "error" ? state.message : null,
  };
}