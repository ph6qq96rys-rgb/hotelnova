import { useCallback, useEffect, useRef, useState } from "react";

import {
  getFnbReportDrilldown,
  type FnbReportDrilldownDto,
  type FnbReportQuery,
  type FnbReportRow,
} from "../api/fnbReportsApi";
import { MOVEMENT_PAGE_SIZE } from "../utils/fnbReportMeta";
import { requestErrorMessage } from "../utils/fnbRequest";

/**
 * Paged posted-movement drilldown for one report row. The drilldown always uses
 * the applied (last completed) report query, never pending filter edits, and is
 * discarded whenever that applied scope changes.
 */
export function useFnbDrilldown(appliedQuery: FnbReportQuery | null) {
  const [data, setData] = useState<FnbReportDrilldownDto | null>(null);
  const [row, setRow] = useState<FnbReportRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setData(null);
    setRow(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    close();
    return () => abortRef.current?.abort();
  }, [appliedQuery, close]);

  const open = useCallback(async (target: FnbReportRow, page = 1) => {
    if (!target.itemId || !appliedQuery) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const result = await getFnbReportDrilldown({
        ...appliedQuery,
        itemId: target.itemId,
        locationId: typeof target.locationId === "string" ? target.locationId : null,
        consumptionType: target.consumptionType || null,
        uomName: typeof target.uomName === "string" ? target.uomName : null,
        page,
        pageSize: MOVEMENT_PAGE_SIZE,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setData({
        ...result,
        itemName: result.itemName || target.itemName,
        uomName: result.uomName || String(target.uomName || ""),
        locationName: result.locationName || (typeof target.locationName === "string" ? target.locationName : null),
      });
      setRow(target);
    } catch (err) {
      if (!controller.signal.aborted) setError(requestErrorMessage(err, "Failed to load movement drilldown."));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [appliedQuery]);

  const page = data?.pagination?.page ?? 1;
  const totalRows = data?.pagination?.totalRows ?? data?.ledger.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRows / (data?.pagination?.pageSize ?? MOVEMENT_PAGE_SIZE)));
  const goToPage = useCallback((next: number) => {
    if (row) void open(row, next);
  }, [open, row]);

  return { data, loading, error, page, pageCount, totalRows, open, close, goToPage };
}
