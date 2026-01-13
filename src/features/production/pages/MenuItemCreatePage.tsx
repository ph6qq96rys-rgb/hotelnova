import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";

export default function MenuItemCreatePage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSave() {
    if (!companyId) return;
    if (!name.trim()) return setErr("Name is required.");

    setSaving(true);
    setErr(null);
    try {
      const res = await menuItemsApi.create(companyId, branchId, {
        name: name.trim(),
        code: code.trim() || null,
        isActive,
      });
      nav(`/menu/items/${res.id}?tab=recipe`);
    } catch (e: any) {
      setErr(e?.response?.data ?? e?.message ?? "Failed to create menu item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">New Menu Item</div>
            <div className="card-subtitle">Create the menu item first, then assign ingredients.</div>
          </div>
        </div>

        <div className="card-body">
          {err && <div className="alert alert-danger">{String(err)}</div>}

          <div className="grid-2">
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Chicken Shawarma Wrap" />
            </div>
            <div className="field">
              <label>Code / SKU</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <div className="row">
            <label className="chk">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>
        </div>

        <div className="card-footer">
          <button className="btn" onClick={() => nav(-1)}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Create & Add Recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
