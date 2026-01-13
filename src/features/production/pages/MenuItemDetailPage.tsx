import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { recipesApi } from "../../production/api/recipesApi";
import type {RecipeDto}from "../types"
import   { fetchInventoryItems, fetchUoms } from "../api/lookups";
import  type { InventoryItemLite, UomLite } from "../api/lookups";

type EditLine = {
  id?: string | null;
  itemId: string;
  uomId: string;
  qty: string; // keep as string for input
  wastePct?: string;
  isActive: boolean;
  notes?: string;
};

export default function MenuItemDetailPage() {
  const { companyId } = useAppScope();
  const { id: menuItemId } = useParams();
  const [sp] = useSearchParams();
  const tab = sp.get("tab") ?? "recipe";

  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [items, setItems] = useState<InventoryItemLite[]>([]);
  const [uoms, setUoms] = useState<UomLite[]>([]);
  const [qItem, setQItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !menuItemId) return;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [r, it, um] = await Promise.all([
          recipesApi.getByMenuItem(companyId, menuItemId),
          fetchInventoryItems(companyId, ""),
          fetchUoms(companyId),
        ]);
        setRecipe(r);
        setLines(
          (r.lines ?? []).map((x) => ({
            id: x.id,
            itemId: x.itemId,
            uomId: x.uomId,
            qty: String(x.qty ?? ""),
            wastePct: x.wastePct == null ? "" : String(x.wastePct),
            isActive: x.isActive ?? true,
            notes: x.notes ?? "",
          }))
        );
        setItems(it);
        setUoms(um);
      } catch (e: any) {
        setErr(e?.response?.data ?? e?.message ?? "Failed to load recipe.");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, menuItemId]);

  useEffect(() => {
    if (!companyId) return;
    const t = setTimeout(async () => {
      try {
        const it = await fetchInventoryItems(companyId, qItem);
        setItems(it);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [companyId, qItem]);

  const itemNameById = useMemo(() => new Map(items.map(i => [i.id, i.name])), [items]);
  const uomNameById = useMemo(() => new Map(uoms.map(u => [u.id, u.name ?? u.code])), [uoms]);

  function addLine() {
    setLines((p) => [
      {
        id: null,
        itemId: "",
        uomId: "",
        qty: "1",
        wastePct: "",
        isActive: true,
        notes: "",
      },
      ...p, // NEW on top (your preference)
    ]);
  }

  function removeLine(idx: number) {
    setLines((p) => p.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<EditLine>) {
    setLines((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function validate(): string | null {
    if (!lines.length) return "Add at least one ingredient line.";
    for (const [i, l] of lines.entries()) {
      if (!l.itemId) return `Line ${i + 1}: ingredient is required.`;
      if (!l.uomId) return `Line ${i + 1}: UOM is required.`;
      const qty = Number(l.qty);
      if (!Number.isFinite(qty) || qty <= 0) return `Line ${i + 1}: qty must be > 0.`;
      if (l.wastePct) {
        const w = Number(l.wastePct);
        if (!Number.isFinite(w) || w < 0 || w > 100) return `Line ${i + 1}: waste % must be 0..100.`;
      }
    }

    // prevent duplicates (itemId+uomId)
    const seen = new Set<string>();
    for (const [i, l] of lines.entries()) {
      const key = `${l.itemId}::${l.uomId}`;
      if (seen.has(key)) return `Line ${i + 1}: duplicate ingredient (same item & UOM).`;
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
      const dto = await recipesApi.upsertByMenuItem(companyId, menuItemId, {
        notes: recipe?.notes ?? null,
        isActive: recipe?.isActive ?? true,
        lines: lines.map((l) => ({
          id: l.id ?? null,
          itemId: l.itemId,
          uomId: l.uomId,
          qty: Number(l.qty),
          wastePct: l.wastePct ? Number(l.wastePct) : null,
          isActive: l.isActive,
          notes: l.notes ?? null,
        })),
      });
      setRecipe(dto);
      setOk("Recipe saved.");
      // reload lines from server (keeps ids consistent)
      setLines(dto.lines.map((x) => ({
        id: x.id,
        itemId: x.itemId,
        uomId: x.uomId,
        qty: String(x.qty ?? ""),
        wastePct: x.wastePct == null ? "" : String(x.wastePct),
        isActive: x.isActive ?? true,
        notes: x.notes ?? "",
      })));
    } catch (e: any) {
      setErr(e?.response?.data ?? e?.message ?? "Failed to save recipe.");
    } finally {
      setSaving(false);
    }
  }

  if (tab !== "recipe") return <div className="page">Other tab…</div>;

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recipe / Ingredients</div>
            <div className="card-subtitle">Assign ingredients for this menu item. New lines appear at the top.</div>
          </div>
          <div className="row gap">
            <input
              className="input"
              placeholder="Search ingredients…"
              value={qItem}
              onChange={(e) => setQItem(e.target.value)}
              style={{ width: 240 }}
            />
            <button className="btn" onClick={addLine}>+ Add Line</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save Recipe"}
            </button>
          </div>
        </div>

        <div className="card-body">
          {err && <div className="alert alert-danger">{String(err)}</div>}
          {ok && <div className="alert alert-success">{ok}</div>}

          {loading ? (
            <div style={{ padding: 12, opacity: 0.75 }}>Loading recipe…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 280 }}>Ingredient</th>
                  <th style={{ width: 160 }}>UOM</th>
                  <th style={{ width: 120, textAlign: "right" }}>Qty</th>
                  <th style={{ width: 120, textAlign: "right" }}>Waste %</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th>Notes</th>
                  <th style={{ width: 90, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 14, opacity: 0.75 }}>No ingredients yet. Click “Add Line”.</td></tr>
                ) : (
                  lines.map((l, idx) => (
                    <tr key={l.id ?? `new-${idx}`}>
                      <td>
                        <select
                          className="input"
                          value={l.itemId}
                          onChange={(e) => updateLine(idx, { itemId: e.target.value })}
                        >
                          <option value="">Select ingredient…</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                        {l.itemId && (
                          <div className="muted" style={{ marginTop: 4 }}>
                            {itemNameById.get(l.itemId) ?? ""}
                          </div>
                        )}
                      </td>

                      <td>
                        <select
                          className="input"
                          value={l.uomId}
                          onChange={(e) => updateLine(idx, { uomId: e.target.value })}
                        >
                          <option value="">Select UOM…</option>
                          {uoms.map(u => (
                            <option key={u.id} value={u.id}>{u.name ?? u.code}</option>
                          ))}
                        </select>
                        {l.uomId && (
                          <div className="muted" style={{ marginTop: 4 }}>
                            {uomNameById.get(l.uomId) ?? ""}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <input
                          className="input"
                          value={l.qty}
                          onChange={(e) => updateLine(idx, { qty: e.target.value })}
                          inputMode="decimal"
                          style={{ textAlign: "right" }}
                        />
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <input
                          className="input"
                          value={l.wastePct ?? ""}
                          onChange={(e) => updateLine(idx, { wastePct: e.target.value })}
                          inputMode="decimal"
                          placeholder="0"
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
                        <button className="btn btn-danger" onClick={() => removeLine(idx)}>Remove</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
