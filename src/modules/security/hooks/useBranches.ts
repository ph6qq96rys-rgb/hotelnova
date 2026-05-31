// src/modules/security/hooks/useBranches.ts

import { useCallback, useEffect } from "react";
import { useState } from "react";
import { http } from "../../../api/http";
import { isCancelled, extractSecurityError } from "../utils/security.utils";
import { useAbortable } from "./useAbortable";
import type { BranchLite } from "../types/security.types";

async function listBranches(cid: string, signal: AbortSignal): Promise<BranchLite[]> {
  const res = await http.get<BranchLite[]>(`/companies/${cid}/branches`, { signal });
  return Array.isArray(res.data) ? res.data : [];
}

export function useBranches(companyId: string | null) {
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const { begin, abort } = useAbortable();

  const load = useCallback(async () => {
    if (!companyId) { setBranches([]); setError(null); return; }
    const signal = begin();
    setLoading(true); setError(null);
    try {
      setBranches(await listBranches(companyId, signal));
    } catch (e) {
      if (isCancelled(e)) return;
      setBranches([]);
      setError(extractSecurityError(e, "Failed to load branches."));
    } finally { setLoading(false); }
  }, [companyId, begin]);

  useEffect(() => { void load(); return abort; }, [load, abort]);

  return { branches, loading, error, refresh: load };
}