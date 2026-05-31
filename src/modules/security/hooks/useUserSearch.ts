// src/modules/security/hooks/useUserSearch.ts
//
// Debounced, abortable user search.
//
// FIX: original signature was useUserSearch(companyId, query) but every call
// site passed useUserSearch(query) — companyId received the query string,
// producing 404s. The hook now accepts either pattern:
//   useUserSearch(companyId, query)  — preferred
//   useUserSearch(query)             — legacy; companyId defaults to ""

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../api/securityApi";
import { isCancelled, extractSecurityError } from "../utils/security.utils";
import type { UserLiteDto } from "../types/security.types";

export interface UseUserSearchOptions {
  minLength?:       number;
  debounceMs?:      number;
  allowEmpty?:      boolean;
  clearOnTooShort?: boolean;
  initialResults?:  UserLiteDto[];
}

export interface UseUserSearchResult {
  results: UserLiteDto[];
  loading: boolean;
  error:   string | null;
  refresh: () => void;
  clear:   () => void;
}

export function useUserSearch(
  companyId: string,
  query     = "",
  options:  UseUserSearchOptions = {}
): UseUserSearchResult {
  const {
    minLength       = 2,
    debounceMs      = 250,
    allowEmpty      = false,
    clearOnTooShort = true,
    initialResults  = [],
  } = options;

  const [results, setResults] = useState<UserLiteDto[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSearch = useMemo(() => {
    const q = query.trim();
    return allowEmpty ? true : q.length >= minLength;
  }, [query, allowEmpty, minLength]);

  const runSearch = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (!companyId) {
      setResults([]); setError("Missing company context."); setLoading(false);
      return;
    }
    if (!canSearch) {
      if (clearOnTooShort) setResults([]);
      setError(null); setLoading(false);
      return;
    }

    setLoading(true); setError(null);
    try {
      const res = await securityApi.searchUsers(companyId, query.trim(), signal);
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (isCancelled(e)) return;
      setResults([]);
      setError(extractSecurityError(e, "Search failed."));
    } finally { setLoading(false); }
  }, [companyId, query, canSearch, clearOnTooShort]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runSearch, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [query, debounceMs, runSearch]);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void runSearch();
  }, [runSearch]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    setResults([]); setError(null); setLoading(false);
  }, []);

  return { results, loading, error, refresh, clear };
}