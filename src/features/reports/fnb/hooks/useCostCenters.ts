import { useEffect, useState } from "react";

import { orgStructureApi } from "../../../hr/api/hrApi";
import type { DepartmentDto } from "../../../hr/types";
import { requestErrorMessage } from "../utils/fnbRequest";

/**
 * Active departments of a branch, loaded only while the selected report
 * supports department (cost center) attribution.
 */
export function useCostCenters(companyId: string | null | undefined, branchId: string, enabled: boolean) {
  const [items, setItems] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems([]);
    setError(null);
    if (!companyId || !branchId || !enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    orgStructureApi
      .listDepartments(companyId, { branchId, activeOnly: true })
      .then((rows) => {
        if (cancelled) return;
        // The server filters with activeOnly; older servers may still return inactive rows.
        const active = rows.filter((row) => (row as DepartmentDto & { isActive?: boolean }).isActive !== false);
        setItems(active.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(requestErrorMessage(err, "Failed to load departments."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, enabled]);

  return { items, loading, error };
}
