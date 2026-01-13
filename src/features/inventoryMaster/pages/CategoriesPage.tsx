import { useEffect, useMemo, useState } from "react";
import { inventoryItemsApi } from "../items/api/inventoryItemsApi";
import type { CategoryDto } from "../items/types";
import { useAppScope } from "../../../app/useAppScope";

export default function CategoriesPage() {
  const { companyId } = useAppScope();

  const [items, setItems] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const canAdd = useMemo(() => name.trim().length > 0, [name]);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await inventoryItemsApi.getCategories(companyId);
      setItems(res ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const add = async () => {
    if (!companyId) return;
    if (!canAdd) return;

    setLoading(true);
    setErr(null);
    try {
      await inventoryItemsApi.createCategory(companyId, {
        name: name.trim(),
        description: desc.trim() ? desc.trim() : null,
      });

      setName("");
      setDesc("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create category");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Item Categories</h2>
          <div style={{ opacity: 0.75, marginTop: 4 }}>Manage item grouping for reporting & menus</div>
        </div>
        <button onClick={load} disabled={loading || !companyId}>
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {err && (
          <div style={{ marginBottom: 10, padding: 10, border: "1px solid #f5c2c7", background: "#f8d7da" }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
          <input
            style={{ minWidth: 240, padding: 8 }}
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            style={{ minWidth: 320, padding: 8 }}
            placeholder="Description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <button onClick={add} disabled={!canAdd || loading || !companyId}>
            {loading ? "Saving..." : "Add"}
          </button>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f6f6f6" }}>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Name</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Description</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
                    No categories yet.
                  </td>
                </tr>
              )}

              {items.map((x) => (
                <tr key={x.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{x.name}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{x.description ?? ""}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {"isActive" in x ? ((x as any).isActive ? "Active" : "Inactive") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>}
      </div>
    </div>
  );
}
