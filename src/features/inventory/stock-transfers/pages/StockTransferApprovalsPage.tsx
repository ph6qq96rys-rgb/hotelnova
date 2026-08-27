import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import { STOCK_TRANSFER_STATUS, type StockTransferListDto } from "../types";
import { buildStockTransferPaths } from "../routing/stockTransferRoutes";
import { fmtDateTime, getApiError, money, safeNum } from "../utils/apiUtils";
import { normalizeStockTransferStatus } from "../utils/stockTransferStatus";

import {
  Card,
  DocHeader,
  Kpi,
  KpiRow,
  StatusPill,
} from "../../../../shared/ui/DocUI";

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; message: string };

export default function StockTransferApprovalsPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [rows, setRows] = useState<StockTransferListDto[]>([]);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const requestIdRef = useRef(0);

  const paths = useMemo(() => buildStockTransferPaths(companyId), [companyId]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const load = useCallback(async () => {
    if (!companyId || !branchId) {
      setRows([]);
      setPageState({
        status: "error",
        message: "Company and branch scope are required.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;
    setPageState({ status: "loading" });

    try {
      const data = await stockTransfersApi.list(
        companyId,
        branchId,
        STOCK_TRANSFER_STATUS.Submitted
      );

      if (requestId !== requestIdRef.current) return;

      setRows(Array.isArray(data) ? data : []);
      setPageState({ status: "loaded" });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setRows([]);
      setPageState({
        status: "error",
        message: getApiError(error, "Failed to load approval inbox."),
      });
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loading = pageState.status === "loading";
  const errorMessage = pageState.status === "error" ? pageState.message : null;

  const stats = useMemo(
    () => ({
      pending: rows.length,
      totalQty: rows.reduce((sum, row) => sum + safeNum((row as any).totalQuantity), 0),
      totalValue: rows.reduce((sum, row) => sum + safeNum((row as any).totalValue), 0),
    }),
    [rows]
  );

  if (!companyId || !branchId || !paths) {
    return <div className="page">Company and branch scope are required.</div>;
  }

  return (
    <div className="page space-y-4">
      <DocHeader
        title="Approval Inbox"
        subtitle="Submitted transfers awaiting approval."
        right={
          <button className="btn btn-secondary" onClick={() => go(paths.list)}>
            Back
          </button>
        }
      />

      <KpiRow>
        <Kpi label="Pending" value={stats.pending} />
        <Kpi label="Total Qty" value={stats.totalQty} />
        <Kpi label="Total Value" value={money(stats.totalValue)} />
        <Kpi label="Policy" value="Controlled transfer" />
        <Kpi label="Action" value="Approve / Reject" />
      </KpiRow>

      <Card title="Submitted Transfers" subtitle="Review transfers awaiting approval.">
        {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
        {errorMessage ? <div className="text-sm text-rose-600">{errorMessage}</div> : null}

        {!loading && !errorMessage ? (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>Route</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-6">
                      Nothing pending approval.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const status = normalizeStockTransferStatus(row.status);

                    return (
                      <tr
                        key={row.id}
                        onClick={() => go(paths.detail(row.id))}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div className="font-semibold">{row.transferNumber}</div>
                          <div className="text-xs text-slate-500">
                            {(row as any).reference ?? "-"}
                          </div>
                        </td>

                        <td>
                          {row.fromLocationName} {" to "} {row.toLocationName}
                        </td>

                        <td>{fmtDateTime((row as any).transferDateUtc)}</td>

                        <td>
                          <StatusPill text={status} tone="bg-amber-100 text-amber-800" />
                        </td>

                        <td className="text-right">{safeNum((row as any).totalQuantity)}</td>
                        <td className="text-right">{money((row as any).totalValue)}</td>

                        <td className="text-right">
                          <button
                            className="btn btn-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              go(paths.detail(row.id));
                            }}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
