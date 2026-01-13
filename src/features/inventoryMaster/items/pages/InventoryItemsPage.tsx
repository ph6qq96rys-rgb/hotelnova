import React, { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "../../../../hooks/usePageMeta";
import { useAppScope } from "../../../../app/useAppScope";

import { inventoryItemsApi } from "../api/inventoryItemsApi";
import type {
  InventoryItemDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CategoryDto,
  UomDto,
} from "../types";

import { ITEM_TYPES } from "../constants/itemTypes";
import type { ItemType } from "../constants/itemTypes";

/** If your constants file does not export a label helper, we build it from ITEM_TYPES */
function itemTypeLabel(t: ItemType): string {
  return ITEM_TYPES.find(x => String(x.value) === String(t))?.label ?? String(t);
}

/** Numeric-enum safe parsing (avoids TS warning) */
function parseItemType(v: string): ItemType {
  // If your ItemType is actually string-union, this still works because NaN won't match and you can swap to: return v as ItemType;
  const n = Number.parseInt(v, 10);
  return (Number.isFinite(n) ? (n as unknown as ItemType) : (v as unknown as ItemType));
}

type FieldErrors = {
  name?: string;
  baseUomId?: string;
};

export default function ItemInventoryPage() {
  usePageMeta({
    title: "Inventory Items",
    subtitle: "Create and maintain item master data",
  });

  const { companyId } = useAppScope();

  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [cats, setCats] = useState<CategoryDto[]>([]);
  const [uoms, setUoms] = useState<UomDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [q, setQ] = useState("");

  // edit/create form state (same “header card” idea as GRN)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateInventoryItemDto>({
    name: "",
    sku: null,
    categoryId: null,
    baseUomId: "",
    issueUomId: null,
    itemType: ITEM_TYPES[0].value as ItemType,
    trackInventory: true,
  });
  const [isActive, setIsActive] = useState(true); // only used when editing

  const catById = useMemo(() => new Map(cats.map(c => [c.id, c.name])), [cats]);
  const uomById = useMemo(
    () => new Map(uoms.map(u => [u.id, `${u.name}${u.symbol ? ` (${u.symbol})` : ""}`])),
    [uoms]
  );

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter(x => x.isActive).length;
    const inactive = total - active;
    const tracked = items.filter(x => x.trackInventory).length;
    return { total, active, inactive, tracked };
  }, [items]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(x => {
      const name = (x.name ?? "").toLowerCase();
      const sku = (x.sku ?? "").toLowerCase();
      return name.includes(t) || sku.includes(t);
    });
  }, [items, q]);

  const resetForm = () => {
    setEditingId(null);
    setIsActive(true);
    setForm({
      name: "",
      sku: null,
      categoryId: null,
      baseUomId: "",
      issueUomId: null,
      itemType: ITEM_TYPES[0].value as ItemType,
      trackInventory: true,
    });
    setErrors({});
    setError(null);
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, catsRes, uomsRes] = await Promise.all([
        inventoryItemsApi.list(companyId),
        inventoryItemsApi.getCategories(companyId),
        inventoryItemsApi.getUoms(companyId),
      ]);

      // Your http returns AxiosResponse -> use .data (same as your GRN page) :contentReference[oaicite:7]{index=7}
      setItems(itemsRes ?? []);
      setCats(catsRes ?? []);
      setUoms(uomsRes ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.name?.trim()) e.name = "Item name is required.";
    if (!form.baseUomId?.trim()) e.baseUomId = "Base UOM is required.";
    return e;
  };

  const hasErrors = (e: FieldErrors) => !!(e.name || e.baseUomId);

  const saveItem = async () => {
    const e = validate();
    setErrors(e);
    if (hasErrors(e)) return;

    setSaving(true);
    setError(null);

    try {
      if (!editingId) {
        await inventoryItemsApi.create(companyId, form);
        alert("Item created.");
      } else {
        const dto: UpdateInventoryItemDto = { ...form, isActive };
        await inventoryItemsApi.update(companyId, editingId, dto);
        alert("Item updated.");
      }

      resetForm();
      await loadAll();
    } catch (ex: any) {
      setError(ex?.message ?? "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const edit = (it: InventoryItemDto) => {
    setEditingId(it.id);
    setIsActive(it.isActive);
    setForm({
      name: it.name ?? "",
      sku: it.sku ?? null,
      categoryId: it.categoryId ?? null,
      baseUomId: it.baseUomId ?? "",
      issueUomId: it.issueUomId ?? null,
      itemType: it.itemType,
      trackInventory: it.trackInventory,
    });
    setErrors({});
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleActive = async (it: InventoryItemDto) => {
    const next = !it.isActive;
    if (!window.confirm(next ? "Activate this item?" : "Deactivate this item?")) return;

    setError(null);
    try {
      await inventoryItemsApi.setActive(companyId, it.id, next);
      await loadAll();
    } catch (ex: any) {
      setError(ex?.message ?? "Failed to change status");
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header (match GRN pattern) :contentReference[oaicite:8]{index=8} */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Inventory Items</div>
          <div style={{  opacity: 0.75, marginTop: 4 }}>
            Manage item master data (type, UOM, tracking, and status).
          </div>
        </div>

        <div style={{ textAlign: "right", opacity: 0.85 }}>
          <div style={{ fontSize: 13 }}>Totals</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {stats.total} items • {stats.active} active • {stats.inactive} inactive
          </div>
        </div>
      </div>

      {/* Create/Edit Card (same grid style as GRN header card) :contentReference[oaicite:9]{index=9} */}
      <div style={cardStyle}>
        <div style={{color:"#181822ff", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {editingId ? "Edit Item" : "New Item"}
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Base UOM is required. Issue UOM is optional.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={secondaryBtn} onClick={resetForm} disabled={saving}>
              Clear
            </button>
            <button style={primaryBtn} onClick={saveItem} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Item"}
            </button>
          </div>
        </div>

        <div style={{ font:"#181822ff", display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12, marginTop: 14 }}>
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Item Name *</label>
            <input
              style={inputStyle(!!errors.name)}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Tomato, Olive Oil, Packaging Box"
            />
            {errors.name && <div style={errorStyle}>{errors.name}</div>}
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>SKU</label>
            <input
              style={inputStyle(false)}
              value={form.sku ?? ""}
              onChange={e => setForm(f => ({ ...f, sku: e.target.value || null }))}
              placeholder="Optional"
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Category</label>
            <select
              style={inputStyle(false)}
              value={form.categoryId ?? ""}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value || null }))}
            >
              <option value="">None</option>
              {cats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Item Type</label>
            <select
              style={inputStyle(false)}
              value={String(form.itemType)}
              onChange={e => setForm(f => ({ ...f, itemType: parseItemType(e.target.value) }))}
            >
              {ITEM_TYPES.map(t => (
                <option key={String(t.value)} value={String(t.value)}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Base UOM *</label>
            <select
              style={inputStyle(!!errors.baseUomId)}
              value={form.baseUomId}
              onChange={e => setForm(f => ({ ...f, baseUomId: e.target.value }))}
            >
              <option value="">Select base UOM…</option>
              {uoms.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.symbol ? ` (${u.symbol})` : ""}
                </option>
              ))}
            </select>
            {errors.baseUomId && <div style={errorStyle}>{errors.baseUomId}</div>}
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Issue UOM</label>
            <select
              style={inputStyle(false)}
              value={form.issueUomId ?? ""}
              onChange={e => setForm(f => ({ ...f, issueUomId: e.target.value || null }))}
            >
              <option value="">Same / None</option>
              {uoms.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.symbol ? ` (${u.symbol})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Track Inventory</label>
            <select
              style={inputStyle(false)}
              value={form.trackInventory ? "yes" : "no"}
              onChange={e => setForm(f => ({ ...f, trackInventory: e.target.value === "yes" }))}
            >
              <option value="yes">Yes (stocked)</option>
              <option value="no">No (non-stock)</option>
            </select>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Status</label>
            <select
              style={inputStyle(false)}
              value={editingId ? (isActive ? "active" : "inactive") : "active"}
              disabled={!editingId}
              onChange={e => setIsActive(e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {!editingId && (
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
                Status can be changed after the item is created.
              </div>
            )}
          </div>
        </div>

        {error && <div style={{ ...errorStyle, marginTop: 10 }}>{error}</div>}
      </div>

      {/* List Card */}
      <div style={cardStyle}>
        <div style={{ color:"#181822ff",display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Items</div>
            Tracked items: <b>{stats.tracked}</b>
          </div>

          <div style={{ minWidth: 340 }}>
           <div style={{ opacity: 0.75, marginTop: 4 }}>
              Search by name or SKU. 
            </div>
            <input
              style={inputStyle(false)}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type to filter…"
            />
          </div>
        </div>

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Base UOM</th>
                <th style={thStyle}>Issue UOM</th>
                <th style={thStyle}>Track</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 18, opacity: 0.75 }}>
                    Loading items…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 18, opacity: 0.75 }}>
                    No items found.
                  </td>
                </tr>
              ) : (
                filtered.map((it, idx) => (
                   <tr key={it.id} style={{ background: idx % 2 === 0 ? "#ffffff" : "rgba(0,0,0,0.02)" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>{it.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{it.id}</div>
                    </td>
                    <td style={tdStyle}>{it.sku ?? ""}</td>
                    <td style={tdStyle}>{itemTypeLabel(it.itemType)}</td>
                    <td style={tdStyle}>{it.categoryId ? catById.get(it.categoryId) ?? it.categoryId : ""}</td>
                    <td style={tdStyle}>{uomById.get(it.baseUomId) ?? it.baseUomId}</td>
                    <td style={tdStyle}>{it.issueUomId ? uomById.get(it.issueUomId) ?? it.issueUomId : ""}</td>
                    <td style={tdStyle}>{it.trackInventory ? "Yes" : "No"}</td>
                    <td style={tdStyle}>{it.isActive ? "Active" : "Inactive"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 10 }}>
                        <button style={secondaryBtnSm} onClick={() => edit(it)}>
                          Edit
                        </button>
                        <button
                          style={it.isActive ? dangerBtn : primaryBtnSm}
                          onClick={() => toggleActive(it)}
                        >
                          {it.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Action Bar (same pattern as GRN) :contentReference[oaicite:10]{index=10} */}
      <div style={stickyBar}>
        <div style={{ color:"#181822ff", opacity: 0.85 }}>
          <b>Tip:</b> Use <b>Edit</b> to adjust UOM/Type/Tracking, and <b>Activate/Deactivate</b> to control availability.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={resetForm} disabled={saving}>
            Clear Form
          </button>
          <button style={primaryBtn} onClick={saveItem} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles (copied to match GRN look & feel) ----------------
   These mirror your GRN page style objects. :contentReference[oaicite:11]{index=11}
*/

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
  color:"#181822ff",
  opacity: 0.75,
  marginBottom: 6,
};

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: invalid ? "1px solid rgba(220, 38, 38, 0.9)" : "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
});

const errorStyle: React.CSSProperties = {
  color: "rgb(220, 38, 38)",
  fontSize: 12,
  marginTop: 6,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  overflow: "hidden",
  //background: "#fafafa",        // ✅ subtle contrast vs rows
};


const thStyle: React.CSSProperties = {
  padding: "12px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#F8FAFC",            // slate-600 (READABLE)
  background: "#373738ff",       // slate-50 (HEADER BG)
  borderBottom: "1px solid #E2E8F0", // slate-200
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  verticalAlign: "top",
  //background: "",        // ✅ ensure visible background
  color: "#0f172a",              // ✅ dark readable text
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

const primaryBtnSm: React.CSSProperties = {
  ...primaryBtn,
  padding: "8px 10px",
  borderRadius: 10,
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

const secondaryBtnSm: React.CSSProperties = {
  ...secondaryBtn,
  padding: "8px 10px",
  borderRadius: 10,
};

const dangerBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(220, 38, 38, 0.35)",
  background: "rgba(220, 38, 38, 0.08)",
  color: "rgb(220, 38, 38)",
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
