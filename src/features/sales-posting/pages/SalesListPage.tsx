import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../sales.types";
import { SALE_STATUS, PAYMENT_STATUS } from "../sales.types";
import { fmt, fmtDate, extractApiError } from "../utils/sales.utils";
import { Alert, StatusBadge, InventoryBadge, EmptyRow, LoadingRow } from "../components/sales.ui";

const PAGE_SIZE = 20;

export default function SalesListPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [items,        setItems]        = useState<SaleListItemDto[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [totalCount,   setTotalCount]   = useState(0);
  const [err,          setErr]          = useState<string | null>(null);
  const [bulkOk,       setBulkOk]       = useState<string | null>(null);
  const [bulkPosting,  setBulkPosting]  = useState(false);

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<number | "">("");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!companyId || !branchId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);

    salesApi
      .list(companyId, branchId, {
        page,
        pageSize: PAGE_SIZE,
        status:   statusFilter !== "" ? statusFilter : undefined,
        fromDate: fromDate || undefined,
        toDate:   toDate   || undefined,
        q:        search   || undefined,
      })
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        setTotalCount(d.totalCount ?? 0);
      })
      .catch((e) => { if (!cancelled) setErr(extractApiError(e, "Failed to load sales.")); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [companyId, branchId, page, statusFilter, fromDate, toDate, search]);

  // ── Bulk COGS ──────────────────────────────────────────────────────────────

  async function handleBulkPostCogs() {
    if (!companyId || !branchId) return;
    setBulkPosting(true);
    setBulkOk(null);
    setErr(null);
    try {
      const r = await salesApi.postCogsBulk(companyId, branchId, {
        fromDate: fromDate || undefined,
        toDate:   toDate   || undefined,
      });
      setBulkOk(`Posted: ${r.posted} · Skipped: ${r.skipped} · Failed: ${r.failed}`);
    } catch (e) {
      setErr(extractApiError(e, "Bulk COGS posting failed."));
    } finally {
      setBulkPosting(false);
    }
  }

  const clearFilters = () => {
    setSearch(""); setStatusFilter("");
    setFromDate(""); setToDate(""); setPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="page">
      <div className="card">

        {/* Header */}
        <div className="card-header" style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div className="card-title">Sales</div>
            <div className="card-subtitle">
              {totalCount} records · POS, back-office, and imported
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => nav("/sales/import")}>
              ↑ Import Excel
            </button>
            <button className="btn" onClick={handleBulkPostCogs} disabled={bulkPosting}>
              {bulkPosting ? "Posting…" : "Post COGS (Bulk)"}
            </button>
            <button className="btn btn-primary" onClick={() => nav("/sales/new")}>
              + New Sale
            </button>
          </div>
        </div>

        <div className="card-body">
          {err    && <Alert type="error"   message={err} />}
          {bulkOk && <Alert type="success" message={`Bulk COGS: ${bulkOk}`} />}

          {/* Filters */}
          <div style={{
            display: "flex", gap: 10, marginBottom: 16,
            flexWrap: "wrap", alignItems: "flex-end",
          }}>
            <div className="field" style={{ margin: 0, flex: "1 1 200px" }}>
              <label>Search</label>
              <input
                className="input"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Sale no, item…"
              />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label>Status</label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value === "" ? "" : Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {Object.entries(SALE_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label>From</label>
              <input className="input" type="date" value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label>To</label>
              <input className="input" type="date" value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
            </div>

            <button className="btn" onClick={clearFilters}>Clear</button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Sale No</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>COGS</th>
                  <th style={{ textAlign: "right" }}>Gross Profit</th>
                  <th style={{ textAlign: "center" }}>Inventory</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRow colSpan={9} />
                ) : items.length === 0 ? (
                  <EmptyRow colSpan={9} message="No sales match the current filters." />
                ) : items.map((s) => {
                  const ss = SALE_STATUS[s.status];
                  const ps = PAYMENT_STATUS[s.paymentStatus];
                  return (
                    <tr key={s.id} style={{ cursor: "pointer" }}
                      onClick={() => nav(`/sales/${s.id}`)}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.saleNo}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(s.soldAtUtc)}</td>
                      <td>{ss && <StatusBadge label={ss.label} color={ss.color} />}</td>
                      <td>{ps && <StatusBadge label={ps.label} color={ps.color} />}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>
                        ${fmt(s.totalAmount)}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>
                        ${fmt(s.totalCogs)}
                      </td>
                      <td style={{
                        textAlign: "right", fontFamily: "monospace", fontSize: 12,
                        color: s.grossProfit >= 0 ? "#10b981" : "#ef4444",
                      }}>
                        ${fmt(s.grossProfit)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <InventoryBadge posted={s.isInventoryPosted} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: "3px 10px" }}
                          onClick={(e) => { e.stopPropagation(); nav(`/sales/${s.id}`); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginTop: 16, fontSize: 13,
            }}>
              <span style={{ color: "#6b7280" }}>
                Page {page} of {totalPages} · {totalCount} records
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <button className="btn" disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}