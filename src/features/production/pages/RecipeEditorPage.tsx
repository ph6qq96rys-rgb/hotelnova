import { useEffect, useMemo, useState } from "react";
import { useAppScope } from "../../../app/useAppScope";
import { http } from "../../../api/http";
import type {MenuItemForRecipeDto, SaveRecipeEditorRequest,EditLine} from "../types";

// ---- Lookups ----
type InventoryItemLite = { id: string; name: string; sku?: string | null; isActive: boolean };
type UomLite = { id: string; code: string; name?: string | null; isActive: boolean };
type MenuItemLite = { id: string; name: string; code?: string | null; isActive: boolean };

async function fetchMenuItems(companyId: string): Promise<MenuItemLite[]> {
  const r = await http.get<MenuItemLite[]>(`/companies/${companyId}/menu/items`, { params: { activeOnly: true } });
  return r.data;
}

async function fetchInventoryItems(companyId: string, q = ""): Promise<InventoryItemLite[]> {
  const r = await http.get<InventoryItemLite[]>(`/companies/${companyId}/inventory/items`, {
    params: { activeOnly: true, q },
  });
  return r.data;
}

async function fetchUoms(companyId: string): Promise<UomLite[]> {
  const r = await http.get<UomLite[]>(`/companies/${companyId}/uoms`, { params: { activeOnly: true } });
  return r.data;
}



export default function RecipeEditorPage() {
  const { companyId } = useAppScope();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItemLite[]>([]);
  const [menuItemId, setMenuItemId] = useState<string>("");

  const [items, setItems] = useState<InventoryItemLite[]>([]);
  const [uoms, setUoms] = useState<UomLite[]>([]);
  const [qItem, setQItem] = useState("");

  const [header, setHeader] = useState<{ name: string; code?: string | null } | null>(null);
  const [outputItemId, setOutputItemId] = useState<string>("");
  const [outputUomId, setOutputUomId] = useState<string>("");
  const [lines, setLines] = useState<EditLine[]>([]);

  const itemNameById = useMemo(() => new Map(items.map((x) => [x.id, x.name])), [items]);
  const uomNameById = useMemo(() => new Map(uoms.map((x) => [x.id, x.name ?? x.code])), [uoms]);

  // Load base lookups + menu list
  useEffect(() => {
    if (!companyId) return;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [mis, inv, um] = await Promise.all([
          fetchMenuItems(companyId),
          fetchInventoryItems(companyId, ""),
          fetchUoms(companyId),
        ]);
        setMenuItems(mis);
        setItems(inv);
        setUoms(um);

        if (mis.length) setMenuItemId(mis[0].id);
      } catch (e: any) {
        setErr(e?.response?.data ?? e?.message ?? "Failed to load catalogs.");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  // Search inventory items
  useEffect(() => {
    if (!companyId) return;
    const t = setTimeout(async () => {
      try {
        const inv = await fetchInventoryItems(companyId, qItem);
        setItems(inv);
      } catch {
        // ignore search errors
      }
    }, 250);
    return () => clearTimeout(t);
  }, [companyId, qItem]);

  // Load selected menu item recipe editor DTO
  useEffect(() => {
    if (!companyId || !menuItemId) return;

    (async () => {
      setErr(null);
      setOk(null);
      try {
        const r = await http.get<MenuItemForRecipeDto>(
          `/api/companies/${companyId}/menu/items/${menuItemId}/recipe-editor`
        );

        const dto = r.data;

        setHeader({ name: dto.name, code: dto.code ?? null });
        setOutputItemId(dto.outputItemId ?? "");
        setOutputUomId(dto.outputUomId ?? "");

        setLines(
          (dto.lines ?? []).map((l) => ({
            id: l.id ?? null,
            itemId: l.itemId,
            uomId: l.uomId,
            qty: Number(l.qty ?? 0),
            wastePct: l.wastePct ?? null,
            isActive: l.isActive ?? true,
            notes: l.notes ?? null,
          }))
        );
      } catch (e: any) {
        setHeader(null);
        setOutputItemId("");
        setOutputUomId("");
        setLines([]);
        setErr(e?.response?.data ?? e?.message ?? "Failed to load menu item recipe.");
      }
    })();
  }, [companyId, menuItemId]);

  function addLineTop() {
    setLines((prev) => [
      { id: null, itemId: "", uomId: "", qty: 1, wastePct: 0, isActive: true, notes: null },
      ...(prev ?? []),
    ]);
  }

  function updateLine(idx: number, patch: Partial<EditLine>) {
    setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function validate(): string | null {
    if (!menuItemId) return "Menu item is required.";
    if (!outputItemId) return "Output item is required.";
    if (!outputUomId) return "Output UOM is required.";
    if (!lines.length) return "Add at least one ingredient line.";

    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.itemId) return `Line ${i + 1}: ingredient is required.`;
      if (!l.uomId) return `Line ${i + 1}: UOM is required.`;
      if (!(Number(l.qty) > 0)) return `Line ${i + 1}: qty must be > 0.`;

      const w = l.wastePct ?? 0;
      if (w < 0 || w > 100) return `Line ${i + 1}: waste % must be 0..100.`;

      const key = `${l.itemId}::${l.uomId}`;
      if (seen.has(key)) return `Line ${i + 1}: duplicate ingredient (same item + UOM).`;
      seen.add(key);
    }
    return null;
  }

  async function save() {
    if (!companyId || !menuItemId) return;

    setOk(null);
    const v = validate();
    if (v) return setErr(v);

    setSaving(true);
    setErr(null);
    try {
      const body: SaveRecipeEditorRequest = {
        outputItemId: outputItemId || null,
        outputUomId: outputUomId || null,
        lines: lines.map((l) => ({
          id: l.id ?? null,
          itemId: l.itemId,
          uomId: l.uomId,
          qty: Number(l.qty),
          wastePct: l.wastePct ?? null,
          isActive: l.isActive ?? true,
          notes: l.notes ?? null,
        })),
      };

      await http.put(`/api/companies/${companyId}/menu/items/${menuItemId}/recipe-editor`, body);

      setOk("Saved successfully.");
    } catch (e: any) {
      setErr(e?.response?.data ?? e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="card-title">Recipe Editor</div>
            <div className="card-subtitle">
              {header ? (
                <>
                  {header.name} {header.code ? <span style={{ opacity: 0.7 }}>• {header.code}</span> : null}
                </>
              ) : (
                "Select a menu item"
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={addLineTop} disabled={loading || saving}>
              + Add line
            </button>
            <button className="btn btn-primary" onClick={save} disabled={loading || saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="card-body">
          {err && <div className="alert alert-danger">{String(err)}</div>}
          {ok && <div className="alert alert-success">{String(ok)}</div>}

          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Menu Item</label>
              <select className="input" value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)} disabled={loading}>
                <option value="">Select menu item…</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.code ? `(${m.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Search ingredients</label>
              <input className="input" value={qItem} onChange={(e) => setQItem(e.target.value)} placeholder="Type to search inventory…" />
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Output Inventory Item</label>
              <select className="input" value={outputItemId} onChange={(e) => setOutputItemId(e.target.value)}>
                <option value="">Select output item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}{it.sku ? ` • ${it.sku}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Output UOM</label>
              <select className="input" value={outputUomId} onChange={(e) => setOutputUomId(e.target.value)}>
                <option value="">Select UOM…</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 320 }}>Ingredient</th>
                <th style={{ width: 180 }}>UOM</th>
                <th style={{ width: 130, textAlign: "right" }}>Qty</th>
                <th style={{ width: 130, textAlign: "right" }}>Waste %</th>
                <th style={{ width: 120 }}>Active</th>
                <th>Notes</th>
                <th style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 14, opacity: 0.75 }}>
                    No ingredients yet. Click “Add line”.
                  </td>
                </tr>
              ) : (
                lines.map((l, idx) => (
                  <tr key={l.id ?? `new-${idx}`}>
                    <td>
                      <select className="input" value={l.itemId} onChange={(e) => updateLine(idx, { itemId: e.target.value })}>
                        <option value="">Select ingredient…</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}{it.sku ? ` • ${it.sku}` : ""}
                          </option>
                        ))}
                      </select>
                      {l.itemId ? <div className="muted" style={{ marginTop: 4 }}>{itemNameById.get(l.itemId) ?? ""}</div> : null}
                    </td>

                    <td>
                      <select className="input" value={l.uomId} onChange={(e) => updateLine(idx, { uomId: e.target.value })}>
                        <option value="">Select UOM…</option>
                        {uoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name ?? u.code}
                          </option>
                        ))}
                      </select>
                      {l.uomId ? <div className="muted" style={{ marginTop: 4 }}>{uomNameById.get(l.uomId) ?? ""}</div> : null}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <input
                        className="input"
                        value={String(l.qty ?? "")}
                        onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                        inputMode="decimal"
                        style={{ textAlign: "right" }}
                      />
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <input
                        className="input"
                        value={String(l.wastePct ?? 0)}
                        onChange={(e) => updateLine(idx, { wastePct: Number(e.target.value) })}
                        inputMode="decimal"
                        style={{ textAlign: "right" }}
                      />
                    </td>

                    <td>
                      <label className="chk">
                        <input
                          type="checkbox"
                          checked={l.isActive}
                          onChange={(e) => updateLine(idx, { isActive: e.target.checked })}
                        />
                        Active
                      </label>
                    </td>

                    <td>
                      <input
                        className="input"
                        value={l.notes ?? ""}
                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                        placeholder="optional"
                      />
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-danger" onClick={() => removeLine(idx)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="muted" style={{ marginTop: 10 }}>
            Tip: New lines appear at the top. Use Output Item/UOM for production posting.
          </div>
        </div>
      </div>
    </div>
  );
}
