// src/modules/security/hooks/useBranches.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "../../../api/http";

export type BranchLite = { id: string; name: string };

async function listBranches(companyId: string, signal?: AbortSignal): Promise<BranchLite[]> {
  const res = await http.get<BranchLite[]>(`/companies/${companyId}/branches`, { signal });
  return Array.isArray(res.data) ? res.data : [];
}

export function useBranches(companyId: string) {
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [loading, setLoading] = useState<boolean>(!!companyId);
  const [error, setError] = useState<string | null>(null);

  // sequencing to ignore stale responses
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!companyId) {
      setBranches([]);
      setLoading(false);
      setError("Missing companyId in route.");
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    try {
      const data = await listBranches(companyId, controller.signal);
      if (seq !== seqRef.current) return;
      setBranches(data);
    } catch (e: unknown) {
      if (seq !== seqRef.current) return;

      // axios errors often have response.data as string/html
      const message =
        e instanceof Error ? e.message : "Failed to load branches";

      setBranches([]);
      setError(message);
    } finally {
      controller.abort();
      if (seq === seqRef.current) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
    return () => {
      seqRef.current++;
    };
  }, [load]);

  return { branches, loading, error, refresh: load };
}
