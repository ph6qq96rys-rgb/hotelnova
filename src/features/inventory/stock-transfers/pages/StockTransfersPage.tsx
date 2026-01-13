import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import  {type StockTransferListDto, StockTransferStatus } from "../types";

/* -------------------- Utilities -------------------- */

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function safeNum(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

const ALL_STATUSES: StockTransferStatus[] = [
 StockTransferStatus.Draft,
 StockTransferStatus.Submitted,
  StockTransferStatus.Approved,
  StockTransferStatus.Rejected,
  StockTransferStatus.Posted,
  StockTransferStatus.Reversed,
];
  

/* -------------------- Status Badge -------------------- */

const pill = (bg: string, fg: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background: bg,
  color: fg,
  border: "1px solid rgba(0,0,0,0.10)",
});

const statusBadge = (s: StockTransferStatus): React.CSSProperties => {
  switch (s) {
    case StockTransferStatus.Draft:
      return pill("rgba(15,23,42,.08)", "#334155");
    case StockTransferStatus.Submitted:
      return pill("rgba(245,158,11,.18)", "#92400e");
    case StockTransferStatus.Approved:
      return pill("rgba(59,130,246,.14)", "#1e40af");
    case StockTransferStatus.Rejected:
      return pill("rgba(244,63,94,.14)", "#9f1239");
    case StockTransferStatus.Posted:
      return pill("rgba(16,185,129,.14)", "#065f46");
    case StockTransferStatus.Reversed:
      return pill("rgba(168,85,247,.14)", "#581c87");
    default:
      return pill("rgba(0,0,0,.06)", "#334155");
  }
};
function getApiError(e: any) {
  const data = e?.response?.data;

  // ASP.NET ProblemDetails
  if (data && typeof data === "object") {
    const title = data.title || data.error || "Request failed";
    const detail = data.detail || data.message || "";
    const traceId = data.traceId ? ` (traceId: ${data.traceId})` : "";
    const errors =
      data.errors && typeof data.errors === "object"
        ? " " + Object.entries(data.errors)
            .map(([k, v]) => `${k}: ${(v as any[]).join(", ")}`)
            .join(" | ")
        : "";

    return `${title}${traceId}${detail ? ` — ${detail}` : ""}${errors}`;
  }

  // fallback
  return e?.message ?? "Request failed";
}

/* -------------------- Page -------------------- */

export default function StockTransfersPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<StockTransferListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"" | StockTransferStatus>("");
  const [q, setQ] = useState("");

  /* -------------------- Data Load -------------------- */

  const load = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await stockTransfersApi.list(
        companyId,
        status || undefined
      );
      setRows(data ?? []);
    } catch (e: any) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, status]);

  useEffect(() => {
    load();
  }, [load]);

  /* -------------------- Client Filtering -------------------- */

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) => {
      const anyR: any = r;
      const hay = [
        anyR.transferNumber,
        anyR.reference,
        anyR.fromLocationName,
        anyR.toLocationName,
        r.status,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(term);
    });
  }, [rows, q]);

  /* -------------------- KPIs -------------------- */

  const stats = useMemo(() => {
    const count = (s: StockTransferStatus) =>
      rows.filter((r) => r.status === s).length;

    return {
      total: rows.length,
      draft: count(StockTransferStatus.Draft),
      submitted: count(StockTransferStatus.Submitted),
      approved: count(StockTransferStatus.Approved),
      posted: count(StockTransferStatus.Posted),
      totalQty: rows.reduce(
        (a, r) => a + safeNum((r as any).totalQuantity),
        0
      ),
      totalValue: rows.reduce(
        (a, r) => a + safeNum((r as any).totalValue),
        0
      ),
    };
  }, [rows]);

  if (!companyId) {
    return <div style={{ padding: 16 }}>Select company first</div>;
  }

  /* -------------------- Render -------------------- */

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div>
          <div style={headerTitle}>Stock Transfers</div>
          <div style={headerSub}>
            HQ warehouse distributes inventory to branches via controlled
            transfers.
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13 }}>Total Value</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {money(stats.totalValue)}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div style={card}>
        <div style={kpiGrid}>
          <Kpi label="Total" value={stats.total} />
          <Kpi label="Draft" value={stats.draft} />
          <Kpi label="Submitted" value={stats.submitted} />
          <Kpi label="Approved" value={stats.approved} />
          <Kpi label="Posted" value={stats.posted} />
          <Kpi label="Total Qty" value={stats.totalQty} />
        </div>
      </div>

      {/* Filters */}
      <div style={card}>
        <div style={toolbar}>
          <div>
            <div style={{ fontWeight: 700 }}>Transfers</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              Filter by status or search, then open a transfer.
            </div>
          </div>

          <div style={toolbarRight}>
            <input
              style={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search transfer, route, reference…"
            />

            <select
                    style={input}
                    value={status ?? ""}
                    onChange={(e) => setStatus(e.target.value as StockTransferStatus | "")}
                  >
                    <option value="">All statuses</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>


            <button style={secondaryBtn} onClick={load} disabled={loading}>
              Refresh
            </button>

            <button
              style={primaryBtn}
              onClick={() => nav("/inventory/stock-transfers/new")}
            >
              + New Transfer
            </button>
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        {/* Table */}
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Transfer</th>
                <th style={th}>Route</th>
                <th style={th}>Date</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Value</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={empty}>
                    Loading transfers…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={empty}>
                    No transfers found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    style={row}
                    onClick={() =>
                      nav(`/inventory/stock-transfers/${r.id}`)
                    }
                  >
                    <td style={td}>
                      <b>{(r as any).transferNumber ?? "—"}</b>
                      <div style={muted}>
                        {(r as any).reference ?? ""}
                      </div>
                    </td>

                    <td style={td}>
                      {r.fromLocationName} → {r.toLocationName}
                    </td>

                    <td style={td}>
                      {r.transferDateUtc
                        ? new Date(r.transferDateUtc).toLocaleString()
                        : "—"}
                    </td>

                    <td style={td}>
                      <span style={statusBadge(r.status)}>
                        {r.status}
                      </span>
                    </td>

                    <td style={{ ...td, textAlign: "right" }}>
                      {safeNum((r as any).totalQuantity)}
                    </td>

                    <td style={{ ...td, textAlign: "right" }}>
                      {(r as any).totalValue == null
                        ? "—"
                        : money((r as any).totalValue)}
                    </td>

                    <td style={{ ...td, textAlign: "right" }}>
                      <button
                        style={secondaryBtnSm}
                        onClick={(e) => {
                          e.stopPropagation();
                          nav(`/inventory/stock-transfers/${r.id}`);
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Footer */}
      <div style={sticky}>
        <div>
          <b>Workflow:</b> Draft → Submit → Approve → Post
        </div>
        <button
          style={primaryBtn}
          onClick={() => nav("/inventory/stock-transfers/new")}
        >
          + New Transfer
        </button>
      </div>
    </div>
  );
}

/* -------------------- Small Components -------------------- */

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={kpiBox}>
      <div style={kpiLabel}>{label}</div>
      <div style={kpiValue}>{value}</div>
    </div>
  );
}

/* -------------------- Styles -------------------- */

const page = { padding: 16, maxWidth: 1200, margin: "0 auto" };
const header = { display: "flex", justifyContent: "space-between" };
const headerTitle = { fontSize: 22, fontWeight: 700 };
const headerSub = { fontSize: 13, opacity: 0.7 };

const card = {
  marginTop: 14,
  padding: 14,
  border: "1px solid rgba(0,0,0,.1)",
  borderRadius: 12,
  background: "white",
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
  gap: 12,
};

const kpiBox = {
  padding: 12,
  borderRadius: 12,
  background: "rgba(0,0,0,.03)",
  border: "1px solid rgba(0,0,0,.08)",
};

const kpiLabel = { fontSize: 12, fontWeight: 800, opacity: 0.7 };
const kpiValue = { marginTop: 6, fontSize: 22, fontWeight: 800 };

const toolbar = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap" as const,
};

const toolbarRight = { display: "flex", gap: 10, alignItems: "center" };

const input = {
  width: 260,
  padding: "10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.15)",
};

const table = {
  width: "100%",
  borderCollapse: "separate" as const,
  borderSpacing: 0,
  border: "1px solid rgba(0,0,0,.1)",
  borderRadius: 12,
};

const th = {
  padding: 10,
  fontSize: 12,
  background: "rgba(0,0,0,.03)",
  borderBottom: "1px solid rgba(0,0,0,.1)",
};

const td = {
  padding: 10,
  borderBottom: "1px solid rgba(0,0,0,.06)",
};

const row = { cursor: "pointer" };
const empty = { padding: 18, opacity: 0.75 };
const muted = { fontSize: 12, opacity: 0.75 };

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "black",
  color: "white",
  fontWeight: 700,
};

const secondaryBtn = {
  ...primaryBtn,
  background: "white",
  color: "#0f172a",
  border: "1px solid rgba(0,0,0,.15)",
};

const secondaryBtnSm = { ...secondaryBtn, padding: "8px 10px" };

const sticky = {
  position: "sticky" as const,
  bottom: 0,
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,.95)",
  border: "1px solid rgba(0,0,0,.12)",
  display: "flex",
  justifyContent: "space-between",
};

const errorBox = {
  marginTop: 10,
  color: "#7f1d1d",
};
