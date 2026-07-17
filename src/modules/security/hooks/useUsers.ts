// src/modules/security/hooks/useUsers.ts

import { useCallback, useEffect, useState } from "react";

import { securityApi } from "../api/securityApi";
import {
  extractSecurityError,
  isCancelled,
  toUserDetail,
  toUserRow,
} from "../utils/security.utils";

import type { UserDetailDto, UserRowDto } from "../types/security.types";

function normalizeRoleValue(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeUserRoles<T extends any>(user: T): T {
  const rawRoles = (user as any)?.roles ?? [];

  if (!Array.isArray(rawRoles)) return user;

  return {
    ...(user as any),
    roles: rawRoles
      .map((role) => {
        if (typeof role === "string") return normalizeRoleValue(role);

        return {
          ...role,
          value: normalizeRoleValue(
            role.value ?? role.normalizedName ?? role.name
          ),
          normalizedName: normalizeRoleValue(
            role.normalizedName ?? role.value ?? role.name
          ),
        };
      })
      .filter(Boolean),
  };
}

export function useUsers(companyId?: string | null) {
  const [users, setUsers] = useState<UserRowDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) {
        setUsers([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const rows = await securityApi.listUsers(companyId, signal);

        if (signal?.aborted) return;

        setUsers(rows.map(normalizeUserRoles).map(toUserRow));
      } catch (e) {
        if (signal?.aborted || isCancelled(e)) return;

        setUsers([]);
        setError(extractSecurityError(e, "Failed to load users."));
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

  return {
    users,
    loading,
    error,
    refresh,
    reload: refresh,
  };
}

export function useUser(companyId?: string | null, userId?: string | null) {
  const [user, setUser] = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId || !userId) {
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await securityApi.getUserById(companyId, userId, signal);

        if (signal?.aborted) return;

        setUser(toUserDetail(normalizeUserRoles(data)));
      } catch (e) {
        if (signal?.aborted || isCancelled(e)) return;

        setUser(null);
        setError(extractSecurityError(e, "Failed to load user."));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [companyId, userId]
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return {
    user,
    loading,
    error,
    refresh,
    reload: refresh,
  };
}