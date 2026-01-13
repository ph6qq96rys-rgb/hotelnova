import { useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { useInventoryLedger } from "../hooks/useInventoryLedger";
import LedgerTable from "../components/LedgerTable";
import type { InventoryLedgerQuery } from "../api/inventoryLedgerApi";

export default function InventoryLedgerPage() {
  const { companyId } = useAppScope();

  const [locationId, setLocationId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");

  const query = useMemo<InventoryLedgerQuery>(() => {
    return {
      locationId: locationId.trim() ? locationId.trim() : null,
      itemId: itemId.trim() ? itemId.trim() : null,
      page: 1,
      pageSize: 50,
    };
  }, [locationId, itemId]);

  // ✅ HOOK RETURNS { data, paging, loading, error }
 const { data, paging, loading, error } = useInventoryLedger(companyId ?? null, query);
const items = data?.items ?? [];

  if (!companyId) return <div style={{ padding: 16 }}>Select company</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Inventory Ledger</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Real-time movements & costing trail by item and location.
          </div>
        </div>

        <div style={{ textAlign: "right", opacity: 0.85 }}>
          <div style={{ fontSize: 13 }}>Rows</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{items.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Filters</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>Paste IDs for now (wire dropdowns later).</div>
          </div>

          <button
            style={secondaryBtn}
            onClick={() => {
              setLocationId("");
              setItemId("");
            }}
            disabled={loading}
          >
            Clear
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12, marginTop: 14 }}>
          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>LocationId</label>
            <input
              style={inputStyle(false)}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Optional: paste location/warehouse/store id…"
              disabled={loading}
            />
            <div style={helpStyle}>Leave blank to see all locations.</div>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>ItemId</label>
            <input
              style={inputStyle(false)}
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="Optional: paste item id…"
              disabled={loading}
            />
            <div style={helpStyle}>Leave blank to see all items.</div>
          </div>
        </div>

        {loading ? <div style={{ marginTop: 10, opacity: 0.75 }}>Loading…</div> : null}

        {error ? (
          <div style={{ ...alertDanger, marginTop: 10 }}>
            <b>Error:</b> {String(error)}
          </div>
        ) : null}
      </div>

      {/* Table Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Ledger</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>Movements, quantities, and reference documents.</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <LedgerTable items={items} />
        </div>

        {/* Paging footer (optional, but useful) */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {paging.totalCount} records • Page {paging.page} / {paging.totalPages}
          </div>
        </div>
      </div>

      {/* Sticky Bar */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Filter by LocationId + ItemId to quickly debug FIFO, GRN, Sales, and Transfers.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={secondaryBtn}
            onClick={() => {
              setLocationId("");
              setItemId("");
            }}
            disabled={loading}
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- GRN-style inline styles ---------------- */

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: 14,
  background: "white",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.75,
  marginBottom: 6,
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  marginTop: 6,
  opacity: 0.65,
};

const inputStyle = (_invalid: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
});

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "black",
  fontWeight: 700,
  cursor: "pointer",
};

const stickyBar: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const alertDanger: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(220, 38, 38, 0.35)",
  background: "rgba(220, 38, 38, 0.08)",
  color: "rgb(220, 38, 38)",
  padding: "10px 12px",
};
