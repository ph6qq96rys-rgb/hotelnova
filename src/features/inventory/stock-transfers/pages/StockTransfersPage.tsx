import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_STATUS,
  type StockTransferListDto,
  type StockTransferStatus,
} from "../types";

import {
  cardStyle,
  errorStyle,
  inputStyle,
  labelStyle,
  primaryBtn,
  secondaryBtn,
  stickyBar,
  tableStyle,
  tdStyle,
  thStyle,
} from "../../../../shared/inventoryStyles";

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; message: string };

type StockTransferPaths = {
  list: string;
  newTransfer: string;
  detail: (id: string) => string;
};

const ALL_STATUSES: StockTransferStatus[] = [
  STOCK_TRANSFER_STATUS.Draft,
  STOCK_TRANSFER_STATUS.Submitted,
  STOCK_TRANSFER_STATUS.Approved,
  STOCK_TRANSFER_STATUS.Rejected,
  STOCK_TRANSFER_STATUS.Posted,
  STOCK_TRANSFER_STATUS.Reversed,
];

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function safeNum(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function fmtDateTime(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
}

function getApiError(error: any) {
  const data = error?.response?.data;

  if (data && typeof data === "object") {
    const title = data.title || data.error || "Request failed";
    const detail = data.detail || data.message || "";
    const traceId = data.traceId ? ` (traceId: ${data.traceId})` : "";

    const errors =
      data.errors && typeof data.errors === "object"
        ? " " +
          Object.entries(data.errors)
            .map(([key, value]) => `${key}: ${(value as any[]).join(", ")}`)
            .join(" | ")
        : "";

    return `${title}${traceId}${detail ? ` — ${detail}` : ""}${errors}`;
  }

  return error?.message ?? "Request failed";
}

export default function StockTransfersPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [rows, setRows] = useState<StockTransferListDto[]>([]);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [status, setStatus] = useState<"" | StockTransferStatus>("");
  const [query, setQuery] = useState("");

  const requestIdRef = useRef(0);

  const loading = pageState.status === "loading";
  const errorMessage = pageState.status === "error" ? pageState.message : null;

  const paths = useMemo<StockTransferPaths | null>(() => {
    if (!companyId) return null;

    const base = `/companies/${companyId}/inventory/stock-transfers`;

    return {
      list: base,
      newTransfer: `${base}/new`,
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
        message: "Company scope is required before viewing stock transfers.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;

    setPageState({ status: "loading" });

    try {
      const data = await stockTransfersApi.list(
        companyId,
        branchId,
        status || undefined
      );

      if (requestId !== requestIdRef.current) return;

      setRows(Array.isArray(data) ? data : []);
      setPageState({ status: "loaded" });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setRows([]);
      setPageState({
        status: "error",
        message: getApiError(error),
      });
    }
  }, [companyId, branchId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const anyRow = row as any;

      const haystack = [
        anyRow.transferNumber,
        anyRow.reference,
        anyRow.fromLocationName,
        anyRow.toLocationName,
        row.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [rows, query]);

  const stats = useMemo(() => {
    const count = (nextStatus: StockTransferStatus) =>
      rows.filter((row) => row.status === nextStatus).length;

    return {
      total: rows.length,
      draft: count(STOCK_TRANSFER_STATUS.Draft),
      submitted: count(STOCK_TRANSFER_STATUS.Submitted),
      approved: count(STOCK_TRANSFER_STATUS.Approved),
      posted: count(STOCK_TRANSFER_STATUS.Posted),
      totalQty: rows.reduce(
        (sum, row) => sum + safeNum((row as any).totalQuantity),
        0
      ),
      totalValue: rows.reduce(
        (sum, row) => sum + safeNum((row as any).totalValue),
        0
      ),
    };
  }, [rows]);

  if (!companyId || !paths) {
    return (
      <div style={{ padding: 16 }}>
        <div style={cardStyle}>
          Company scope is required before viewing stock transfers.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        totalValue={stats.totalValue}
        errorMessage={errorMessage}
      />

      <StatsCard stats={stats} />

      <div style={cardStyle}>
        <TransfersToolbar
          query={query}
          status={status}
          loading={loading}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
          onRefresh={() => void load()}
          onNew={() => go(paths.newTransfer)}
        />

        <TransfersTable
          rows={filteredRows}
          loading={loading}
          onOpen={(id) => go(paths.detail(id))}
        />
      </div>

      <StickyActions
        loading={loading}
        onRefresh={() => void load()}
        onNew={() => go(paths.newTransfer)}
      />
    </div>
  );
}

function PageHeader({
  totalValue,
  errorMessage,
}: {
  totalValue: number;
  errorMessage: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Stock Transfers</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Warehouse and branch inventory movement with controlled approval and
          posting workflow.
        </div>

        {errorMessage ? (
          <div style={{ marginTop: 10, ...errorStyle }}>{errorMessage}</div>
        ) : null}
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Total Value</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{money(totalValue)}</div>
      </div>
    </div>
  );
}

function StatsCard({
  stats,
}: {
  stats: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    posted: number;
    totalQty: number;
  };
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
          gap: 12,
        }}
      >
        <Kpi label="Total" value={stats.total} />
        <Kpi label="Draft" value={stats.draft} />
        <Kpi label="Submitted" value={stats.submitted} />
        <Kpi label="Approved" value={stats.approved} />
        <Kpi label="Posted" value={stats.posted} />
        <Kpi label="Total Qty" value={stats.totalQty} />
      </div>
    </div>
  );
}

function TransfersToolbar({
  query,
  status,
  loading,
  onQueryChange,
  onStatusChange,
  onRefresh,
  onNew,
}: {
  query: string;
  status: "" | StockTransferStatus;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: "" | StockTransferStatus) => void;
  onRefresh: () => void;
  onNew: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Transfers</div>
        <div style={{ opacity: 0.75, marginTop: 4 }}>
          Filter by status or search, then open a transfer.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          style={{ ...inputStyle(false), width: 260 }}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search transfer, route, reference…"
          disabled={loading}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={labelStyle}>Status</label>
          <select
            style={{ ...inputStyle(false), width: 220 }}
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as "" | StockTransferStatus)
            }
            disabled={loading}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>
                {nextStatus}
              </option>
            ))}
          </select>
        </div>

        <button type="button" style={secondaryBtn} onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button type="button" style={primaryBtn} onClick={onNew} disabled={loading}>
          + New Transfer
        </button>
      </div>
    </div>
  );
}

function TransfersTable({
  rows,
  loading,
  onOpen,
}: {
  rows: StockTransferListDto[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Transfer</th>
            <th style={thStyle}>Route</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} style={{ padding: 18, opacity: 0.75 }}>
                Loading transfers…
              </td>
            </tr>
          ) : null}

          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: 18, opacity: 0.75 }}>
                No transfers found.
              </td>
            </tr>
          ) : null}

          {!loading
            ? rows.map((row) => {
                const anyRow = row as any;

                return (
                  <tr
                    key={row.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => onOpen(row.id)}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800 }}>
                        {anyRow.transferNumber ?? "—"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {anyRow.reference ?? ""}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      {row.fromLocationName} → {row.toLocationName}
                    </td>

                    <td style={tdStyle}>
                      {fmtDateTime(anyRow.transferDateUtc)}
                    </td>

                    <td style={tdStyle}>{row.status}</td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {safeNum(anyRow.totalQuantity)}
                    </td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {anyRow.totalValue == null ? "—" : money(anyRow.totalValue)}
                    </td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        type="button"
                        style={secondaryBtn}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row.id);
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}

function StickyActions({
  loading,
  onRefresh,
  onNew,
}: {
  loading: boolean;
  onRefresh: () => void;
  onNew: () => void;
}) {
  return (
    <div style={stickyBar}>
      <div style={{ opacity: 0.85 }}>
        <b>Workflow:</b> Draft → Submit → Approve → Post
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" style={secondaryBtn} onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>

        <button type="button" style={primaryBtn} onClick={onNew} disabled={loading}>
          + New Transfer
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(0,0,0,.03)",
        border: "1px solid rgba(0,0,0,.08)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}