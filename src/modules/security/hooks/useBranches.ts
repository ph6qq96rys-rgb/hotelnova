import { useEffect, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";

export type BranchLite = { id: string; name: string };

// ⬇️ Replace with your real endpoint if different
async function listBranches(companyId: string): Promise<BranchLite[]> {
  const res = await fetch(`/api/companies/${companyId}/branches`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include"
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export function useBranches() {
  const { companyId } = useAppScope();
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await listBranches(companyId);
        if (!alive) return;
        setBranches(data);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load branches");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [companyId]);

  return { branches, loading, error };
}
