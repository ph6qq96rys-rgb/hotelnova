// src/modules/security/hooks/useUsers.ts

import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../api/usersApi";
import { toUserRow, toUserDetail, isCancelled, extractSecurityError } from "../utils/security.utils";
import { useAbortable } from "./useAbortable";
import type { UserRowDto, UserDetailDto } from "../types/security.types";

export function useUsers(companyId: string | null) {
  const [users,   setUsers]   = useState<UserRowDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const { begin, abort } = useAbortable();

  const load = useCallback(async () => {
    if (!companyId) { setUsers([]); setError(null); return; }
    const signal = begin();
    setLoading(true); setError(null);
    try {
      const rows = await usersApi.listUsers(companyId, signal);
      setUsers(rows.map(toUserRow));
    } catch (e) {
      if (isCancelled(e)) return;
      setUsers([]);
      setError(extractSecurityError(e, "Failed to load users."));
    } finally { setLoading(false); }
  }, [companyId, begin]);

  useEffect(() => { void load(); return abort; }, [load, abort]);

  return { users, loading, error, refresh: load };
}

export function useUser(companyId: string | null, userId: string | null) {
  const [user,    setUser]    = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const { begin, abort } = useAbortable();

  const load = useCallback(async () => {
    if (!companyId || !userId) { setUser(null); setError(null); return; }
    const signal = begin();
    setLoading(true); setError(null);
    try {
      const data = await usersApi.getUserById(companyId, userId, signal);
      setUser(toUserDetail(data));
    } catch (e) {
      if (isCancelled(e)) return;
      setUser(null);
      setError(extractSecurityError(e, "Failed to load user."));
    } finally { setLoading(false); }
  }, [companyId, userId, begin]);

  useEffect(() => { void load(); return abort; }, [load, abort]);

  return { user, loading, error, refresh: load };
}