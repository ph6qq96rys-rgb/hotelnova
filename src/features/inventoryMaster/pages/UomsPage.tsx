import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { inventoryItemsApi } from "../items/api/inventoryItemsApi";
import type { UomDto } from "../items/types";

/** normalize mixed DTO shapes (code vs symbol) into display fields */
function uomCode(u: UomDto): string {
  // prefer code if your DTO has it; fallback to symbol
  const anyU = u as any;
  return (anyU.code ?? anyU.symbol ?? "").toString();
}

export default function UomsPage() {
  const { companyId } = useAppScope();

  const [rows, setRows] = useState<UomDto[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // UI fields
  const [code, setCode] = useState(""); // e.g., KG
  const [name, setName] = useState(""); // e.g., Kilogram

  const canAdd = useMemo(() => name.trim().length > 0, [name]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoadingList(true);
    setErr(null);
    try {
      const res = await inventoryItemsApi.getUoms(companyId);
      setRows(res ?? []);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to load UOMs");
    } finally {
      setLoadingList(false);
    }
  }, [companyId]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
  }, [load]);

  const add = useCallback(async () => {
    if (!companyId) return;
    if (!canAdd) return;

    setSaving(true);
    setErr(null);
    try {
      await inventoryItemsApi.createUom(companyId, {
        name: name.trim(),
        symbol: code.trim() ? code.trim().toUpperCase() : null, // UI code -> API symbol
        isBase: false,
      });

      setCode("");
      setName("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to create UOM");
    } finally {
      setSaving(false);
    }
  }, [companyId, canAdd, name, code, load]);

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, color: "#0f172a" }}>
            Units of Measure
          </div>
          <div style={{ opacity: 0.75, marginTop: 4, color: "#0f172a" }}>
            Define UOMs for purchasing, recipes, and stock.
          </div>
        </div>

        <button style={secondaryBtn} onClick={load} disabled={loadingList || saving}>
          {loadingList ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Add card */}
      <div style={cardStyle}>
        {err && (
          <div
            style={{
              marginBottom: 10,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(220,38,38,0.35)",
              background: "rgba(220,38,38,0.06)",
              color: "rgb(220,38,38)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {String(err)}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Code</label>
            <input
              style={inputStyle(false)}
              placeholder="KG"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={saving}
            />
            <div style={noteStyle}>Optional short code (saved as symbol).</div>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>
              Name <span style={{ color: "rgb(220,38,38)" }}>*</span>
            </label>
            <input
              style={inputStyle(!canAdd && name.length > 0)}
              placeholder="Kilogram"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div style={{ gridColumn: "span 3", display: "flex", alignItems: "flex-end", gap: 10 }}>
            <button style={secondaryBtn} onClick={() => { setCode(""); setName(""); setErr(null); }} disabled={saving}>
              Clear
            </button>
            <button style={primaryBtn} onClick={add} disabled={!canAdd || saving}>
              {saving ? "Saving…" : "Add UOM"}
            </button>
          </div>
        </div>
      </div>

      {/* List card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>UOMs</div>
          <div style={{ fontSize: 12, opacity: 0.75, color: "#0f172a" }}>{rows.length} total</div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={3} style={{ padding: 18, opacity: 0.75 }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 18, opacity: 0.75 }}>
                    No UOMs yet.
                  </td>
                </tr>
              ) : (
                rows.map((u, idx) => {
                  const anyU = u as any;
                  const active =
                    typeof anyU.isActive === "boolean" ? anyU.isActive : true;

                  return (
                    <tr key={u.id} style={{ background: idx % 2 === 0 ? "#ffffff" : "rgba(0,0,0,0.02)" }}>
                      <td style={tdStyle}>{uomCode(u)}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{u.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{u.id}</div>
                      </td>
                      <td style={tdStyle}>{active ? "Active" : "Inactive"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {loadingList && <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>}
      </div>
    </div>
  );
}

/* ---------------- GRN-ish styles ---------------- */

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
  color: "#181822ff",
  opacity: 0.75,
  marginBottom: 6,
};

const noteStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11.5,
  opacity: 0.7,
  color: "#0f172a",
};

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: invalid ? "1px solid rgba(220, 38, 38, 0.9)" : "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
});

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  overflow: "hidden",
};

const thStyle: React.CSSProperties = {
  padding: "12px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#F8FAFC",
  background: "#373738ff",
  borderBottom: "1px solid #E2E8F0",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  verticalAlign: "top",
  color: "#0f172a",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "black",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "black",
  fontWeight: 700,
  cursor: "pointer",
};
