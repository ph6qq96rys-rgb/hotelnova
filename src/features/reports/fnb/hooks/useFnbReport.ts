import { useCallback, useState } from "react";
import {
  getFnbReport,
  type FnbReportDto,
  type FnbReportQuery,
} from "../api/fnbReportsApi";

export function useFnbReport(query: FnbReportQuery) {
  const [data, setData] = useState<FnbReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!query.companyId || !query.branchId || !query.reportKey) return;

    setLoading(true);
    setError(null);

    try {
      const report = await getFnbReport(query);
      setData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run report.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, run, clear };
}