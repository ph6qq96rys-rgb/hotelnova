// src/modules/security/hooks/useUserSearch.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { securityApi } from "../api/securityApi";
import type { UserLiteDto } from "../../../features/security/api/securityApi";

type UseUserSearchOptions = {
  /** Don’t search until query has at least this many chars (default 2) */
  minLength?: number;
  /** Debounce delay in ms (default 250) */
  debounceMs?: number;
  /** If true, will search even when query is empty (default false) */
  allowEmpty?: boolean;
  /** Provide initial results if desired */
  initialResults?: UserLiteDto[];
  /** If true, clears results when query is too short (default true) */
  clearOnTooShort?: boolean;
};

type UseUserSearchState = {
  query: string;
  setQuery: (q: string) => void;

  results: UserLiteDto[];
  loading: boolean;
  error: string | null;

  /** Re-run search immediately with current query */
  refresh: () => void;
  /** Reset query + results */
  clear: () => void;

  /** Expose for debugging / conditional UI */
  companyId: string;
};

function normalize(q: string) {
  return q.trim();
}



/**
 * useUserSearch (company-scoped)
 * - debounced search
 * - aborts in-flight requests on new query/unmount
 * - safe cleanup
 */
export function useUserSearch(companyId: string,
  initialQuery = "",
  options: UseUserSearchOptions = {}
): UseUserSearchState {

  const {
    minLength = 2,
    debounceMs = 250,
    allowEmpty = false,
    initialResults = [],
    clearOnTooShort = true,
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<UserLiteDto[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSearch = useMemo(() => {
    const q = normalize(query);
    return allowEmpty ? true : q.length >= minLength;
  }, [query, allowEmpty, minLength]);

  const runSearch = useCallback(async () => {
    const q = normalize(query);

    // cancel in-flight
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!companyId) {
      setResults([]);
      setError("Missing companyId in route.");
      setLoading(false);
      return;
    }

    if (!canSearch) {
      if (clearOnTooShort) setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ company-scoped API call
      const data = await securityApi.searchUsers(companyId, q, abortRef.current.signal);
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setResults([]);
      setError(e instanceof Error ? e.message : "Failed to search users.");
    } finally {
      setLoading(false);
    }
  }, [companyId, query, canSearch, clearOnTooShort]);

  useEffect(() => {
    // clear debounce timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // debounce
    timerRef.current = window.setTimeout(() => {
      runSearch();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [query, debounceMs, runSearch]);

  const refresh = useCallback(() => {
    // cancel debounce and run immediately
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    runSearch();
  }, [runSearch]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return { query, setQuery, results, loading, error, refresh, clear, companyId };
}
