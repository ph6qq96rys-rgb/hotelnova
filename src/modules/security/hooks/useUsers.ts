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

export function useUsers(companyId?: string | null) {
  const [users, setUsers] = useState<UserRowDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!companyId) {
        setUsers([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const rows = await securityApi.listUsers(companyId, signal);

        if (signal?.aborted) return;

        setUsers(rows.map(toUserRow));
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

  return {
    users,
    loading,
    error,
    refresh: () => load(),
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
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await securityApi.getUserById(
          companyId,
          userId,
          signal
        );

        if (signal?.aborted) return;

        setUser(toUserDetail(data));
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

  return {
    user,
    loading,
    error,
    refresh: () => load(),
  };
}