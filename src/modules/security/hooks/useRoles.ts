// src/modules/security/hooks/useRoles.ts

import { useCallback, useEffect, useMemo, useState } from "react";

import { securityApi } from "../api/securityApi";
import { extractSecurityError, isCancelled } from "../utils/security.utils";

import type { RoleDto } from "../types/security.types";

export function getRoleValue(role: RoleDto): string {
  return String(
    (role as any).value ??
      role.normalizedName ??
      role.name ??
      ""
  )
    .trim()
    .toUpperCase();
}

export function getRoleLabel(role: RoleDto): string {
  return String(
    role.displayName ??
      role.name ??
      role.normalizedName ??
      (role as any).value ??
      "Role"
  ).trim();
}

function sortRoles(roles: RoleDto[]): RoleDto[] {
  return [...roles].sort(
    (a, b) =>
      Number(Boolean(b.isSystem)) - Number(Boolean(a.isSystem)) ||
      getRoleLabel(a).localeCompare(getRoleLabel(b))
  );
}

function normalizeRoles(roles: RoleDto[]): RoleDto[] {
  const map = new Map<string, RoleDto>();

  for (const role of roles) {
    const value = getRoleValue(role);
    if (!value) continue;

    map.set(value, {
      ...role,
      value,
      normalizedName: value,
      displayName: getRoleLabel(role),
    } as RoleDto);
  }

  return sortRoles([...map.values()]);
}

export function useRoles(companyId?: string | null) {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) {
        setRoles([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await securityApi.listRoles(companyId, signal);

        if (signal?.aborted) return;

        setRoles(normalizeRoles(Array.isArray(result) ? result : []));
      } catch (e) {
        if (signal?.aborted || isCancelled(e)) return;

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

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  const byId = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles]
  );

  const byValue = useMemo(
    () => new Map(roles.map((role) => [getRoleValue(role), role])),
    [roles]
  );

  const byName = useMemo(
    () =>
      new Map(
        roles.map((role) => [
          String(role.name ?? "").trim().toUpperCase(),
          role,
        ])
      ),
    [roles]
  );

  const companyRoles = useMemo(
    () => roles.filter((role) => !role.isSystem),
    [roles]
  );

  const systemRoles = useMemo(
    () => roles.filter((role) => role.isSystem),
    [roles]
  );

  return {
    roles,
    companyRoles,
    systemRoles,

    byId,
    byName,
    byValue,

    loading,
    error,
    refresh,
    reload: refresh,

    getRoleValue,
    getRoleLabel,
  };
}