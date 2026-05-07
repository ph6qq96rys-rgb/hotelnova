import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import { STOCK_TRANSFER_STATUS, type StockTransferListDto, type StockTransferStatus } from "../types";


import {
  cardStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  tableStyle,
  thStyle,
  tdStyle,
  primaryBtn,
  secondaryBtn,
  stickyBar,
  // dangerBtn, // if you add actions like reverse later
} from "../../../../shared/inventoryStyles";

/* -------------------- Utilities -------------------- */

function money(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function safeNum(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(v?: string | null) {
  const s = (v ?? "").toString().trim();
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

const ALL_STATUSES: StockTransferStatus[] = [
  STOCK_TRANSFER_STATUS.Draft,
  STOCK_TRANSFER_STATUS.Submitted,
  STOCK_TRANSFER_STATUS.Approved,
  STOCK_TRANSFER_STATUS.Rejected,
  STOCK_TRANSFER_STATUS.Posted,
  STOCK_TRANSFER_STATUS.Reversed,
];


function getApiError(e: any) {
  const data = e?.response?.data;

  if (data && typeof data === "object") {
    const title = data.title || data.error || "Request failed";
    const detail = data.detail || data.message || "";
    const traceId = data.traceId ? ` (traceId: ${data.traceId})` : "";
    const errors =
      data.errors && typeof data.errors === "object"
        ? " " +
          Object.entries(data.errors)
            .map(([k, v]) => `${k}: ${(v as any[]).join(", ")}`)
            .join(" | ")
        : "";

    return `${title}${traceId}${detail ? ` — ${detail}` : ""}${errors}`;
  }

  return e?.message ?? "Request failed";
}

/* -------------------- KPI box (GRN-ish) -------------------- */

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

/* -------------------- Page -------------------- */

export default function StockTransfersPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<StockTransferListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"" | StockTransferStatus>("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await stockTransfersApi.list(companyId, status || undefined);
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

  const stats = useMemo(() => {
    const count = (s: StockTransferStatus) => rows.filter((r) => r.status === s).length;

    return {
      total: rows.length,
      draft: count(STOCK_TRANSFER_STATUS.Draft),
      submitted: count(STOCK_TRANSFER_STATUS.Submitted),
      approved: count(STOCK_TRANSFER_STATUS.Approved),
      posted: count(STOCK_TRANSFER_STATUS.Posted),
      totalQty: rows.reduce((a, r) => a + safeNum((r as any).totalQuantity), 0),
      totalValue: rows.reduce((a, r) => a + safeNum((r as any).totalValue), 0),
    };
  }, [rows]);

  if (!companyId) return <div style={{ padding: 16 }}>Select company first</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header (GRN style) */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Stock Transfers</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            HQ warehouse distributes inventory to branches via controlled transfers.
          </div>

          {error && <div style={{ marginTop: 10, ...errorStyle }}>{error}</div>}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Total Value</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(stats.totalValue)}</div>
        </div>
      </div>

      {/* KPI card (using GRN cardStyle) */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12 }}>
          <Kpi label="Total" value={stats.total} />
          <Kpi label="Draft" value={stats.draft} />
          <Kpi label="Submitted" value={stats.submitted} />
          <Kpi label="Approved" value={stats.approved} />
          <Kpi label="Posted" value={stats.posted} />
          <Kpi label="Total Qty" value={stats.totalQty} />
        </div>
      </div>

      {/* Filters (GRN style card + label/inputStyle) */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Transfers</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Filter by status or search, then open a transfer.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
            <input
              style={{ ...inputStyle(false), width: 260 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search transfer, route, reference…"
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>Status</label>
              <select
                style={{ ...inputStyle(false), width: 220 }}
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
            </div>

            <button style={secondaryBtn} onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button style={primaryBtn} onClick={() => nav("/inventory/stock-transfers/new")}>
              + New Transfer
            </button>
          </div>
        </div>

        {/* Table (GRN style tableStyle) */}
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 18, opacity: 0.75 }}>
                    No transfers found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const anyR: any = r;
                  return (
                    <tr
                      key={r.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => nav(`/inventory/stock-transfers/${r.id}`)}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800 }}>{anyR.transferNumber ?? "—"}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{anyR.reference ?? ""}</div>
                      </td>

                      <td style={tdStyle}>
                        {r.fromLocationName} → {r.toLocationName}
                      </td>

                      <td style={tdStyle}>{fmtDateTime(anyR.transferDateUtc)}</td>

                      <td style={tdStyle}>{r.status}</td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>{safeNum(anyR.totalQuantity)}</td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {anyR.totalValue == null ? "—" : money(anyR.totalValue)}
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          style={secondaryBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            nav(`/inventory/stock-transfers/${r.id}`);
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Action Bar (GRN stickyBar) */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Workflow:</b> Draft → Submit → Approve → Post
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button style={primaryBtn} onClick={() => nav("/inventory/stock-transfers/new")}>
            + New Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
