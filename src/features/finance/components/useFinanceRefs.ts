import { useCallback, useEffect, useState } from "react";

import { financeApi, type Branch, type CostCenter, type GlAccount } from "../api/financeApi";

/** Accounts, cost centers and branches every finance screen needs for pickers and names. */
export function useFinanceRefs(companyId: string) {
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!companyId) return;
    const [a, c, b] = await Promise.all([
      financeApi.accounts(companyId).catch(() => [] as GlAccount[]),
      financeApi.costCenters(companyId).catch(() => [] as CostCenter[]),
      financeApi.branches(companyId),
    ]);
    setAccounts(a); setCostCenters(c); setBranches(b); setLoaded(true);
  }, [companyId]);
  useEffect(() => { void reload(); }, [reload]);
  return { accounts, costCenters, branches, loaded, reload };
}
