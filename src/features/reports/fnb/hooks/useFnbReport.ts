import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFnbReport,
  type FnbReportDto,
  type FnbReportQuery,
} from "../api/fnbReportsApi";

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "CanceledError") return true;

  return false;
}

export function useFnbReport(query: FnbReportQuery) {
  const [data, setData] = useState<FnbReportDto | null>(null);
  const [appliedQuery, setAppliedQuery] = useState<FnbReportQuery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!query.companyId || !query.branchId || !query.reportKey) return;

    abortRef.current?.abort();

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const report = await getFnbReport(query, controller.signal);
      if (requestIdRef.current === requestId) {
        setData(report);
        setAppliedQuery({ ...query });
      }
    } catch (err) {
      if (requestIdRef.current !== requestId || isAbortError(err)) return;
      setError(err instanceof Error ? err.message : "Failed to run report.");
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [query]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
    setData(null);
    setAppliedQuery(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    clear();
    return () => {
      abortRef.current?.abort();
      requestIdRef.current += 1;
    };
  }, [query.companyId, query.branchId, clear]);

  return { data, appliedQuery, loading, error, run, clear };
}
