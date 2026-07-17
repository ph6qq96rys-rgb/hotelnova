import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_STATUS,
  type StockTransferListDto,
} from "../types";

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

type ApprovalPaths = {
  list: string;
  detail: (id: string) => string;
};

export default function StockTransferApprovalsPage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<StockTransferListDto[]>([]);
  const [pageState, setPageState] = useState<PageState>({
    status: "idle",
  });

  const requestIdRef = useRef(0);

  const paths = useMemo<ApprovalPaths | null>(() => {
    if (!companyId) return null;

    const base =
      `/companies/${companyId}/inventory/stock-transfers`;

    return {
      list: base,
      detail: (id: string) => `${base}/${id}`,
    };
  }, [companyId]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setPageState({
        status: "error",
        message: "Company scope is required.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;

    setPageState({ status: "loading" });

    try {
      const data = await stockTransfersApi.list(
        companyId,
        STOCK_TRANSFER_STATUS.Submitted
      );

      if (requestId !== requestIdRef.current) return;

      setRows(Array.isArray(data) ? data : []);
      setPageState({ status: "loaded" });
    } catch (error: any) {
      if (requestId !== requestIdRef.current) return;

      setRows([]);

      setPageState({
        status: "error",
        message:
          error?.message ??
          "Failed to load approval inbox.",
      });
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loading =
    pageState.status === "loading";

  const errorMessage =
    pageState.status === "error"
      ? pageState.message
      : null;

  const stats = useMemo(
    () => ({
      pending: rows.length,
      totalQty: rows.reduce(
        (sum, row) =>
          sum + Number(row.totalQuantity ?? 0),
        0
      ),
      totalValue: rows.reduce(
        (sum, row) =>
          sum + Number(row.totalValue ?? 0),
        0
      ),
    }),
    [rows]
  );

  if (!companyId || !paths) {
    return (
      <div className="page">
        Company scope is required.
      </div>
    );
  }

  return (
    <div className="page space-y-4">
      <DocHeader
        title="Approval Inbox"
        subtitle="Submitted transfers awaiting approval."
        right={
          <button
            className="btn btn-secondary"
            onClick={() => go(paths.list)}
          >
            Back
          </button>
        }
      />

      <KpiRow>
        <Kpi
          label="Pending"
          value={stats.pending}
        />
        <Kpi
          label="Total Qty"
          value={stats.totalQty}
        />
        <Kpi
          label="Total Value"
          value={stats.totalValue.toFixed(2)}
        />
        <Kpi
          label="Policy"
          value="HQ → Branch"
        />
        <Kpi
          label="Action"
          value="Approve / Reject"
        />
      </KpiRow>

      <Card
        title="Submitted Transfers"
        subtitle="Review transfers awaiting approval."
      >
        {loading && (
          <div className="text-sm text-slate-500">
            Loading...
          </div>
        )}

        {errorMessage && (
          <div className="text-sm text-rose-600">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>Route</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">
                    Qty
                  </th>
                  <th className="text-right">
                    Value
                  </th>
                  <th className="text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center p-6"
                    >
                      Nothing pending approval.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() =>
                        go(paths.detail(row.id))
                      }
                      style={{
                        cursor: "pointer",
                      }}
                    >
                      <td>
                        <div className="font-semibold">
                          {row.transferNumber}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.reference ?? "—"}
                        </div>
                      </td>

                      <td>
                        {row.fromLocationName}
                        {" → "}
                        {row.toLocationName}
                      </td>

                      <td>
                        {new Date(
                          row.transferDateUtc
                        ).toLocaleString()}
                      </td>

                      <td>
                        <StatusPill
                          text={row.status}
                          tone="bg-amber-100 text-amber-800"
                        />
                      </td>

                      <td className="text-right">
                        {row.totalQuantity}
                      </td>

                      <td className="text-right">
                        {row.totalValue?.toFixed(
                          2
                        ) ?? "—"}
                      </td>

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
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}