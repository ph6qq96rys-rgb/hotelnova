import { useEffect, useMemo, useState } from "react";
import type {
  CreateInventoryItemDto,
  InventoryItemDto,
  UpdateInventoryItemDto,
} from "../types";
import { ITEM_TYPES, type ItemType } from "../constants/itemTypes";

type Props = {
  mode: "create" | "edit";
  initial?: InventoryItemDto | null;
  onSubmit: (dto: CreateInventoryItemDto | UpdateInventoryItemDto) => Promise<void>;
  onCancel: () => void;

  categories: { id: string; name: string }[];
  uoms: { id: string; name: string; code?: string | null }[];
};

export default function InventoryItemForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  categories,
  uoms,
}: Props) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");

  const [categoryId, setCategoryId] = useState<string>("");
  const [baseUomId, setBaseUomId] = useState<string>("");
  const [issueUomId, setIssueUomId] = useState<string>("");

  const [itemType, setItemType] = useState<ItemType>("RawMaterial");
  const [trackInventory, setTrackInventory] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const uomOptions = useMemo(() => uoms ?? [], [uoms]);
  const categoryOptions = useMemo(() => categories ?? [], [categories]);

  // sane default: service/non-stock shouldn't track inventory
  useEffect(() => {
    if (itemType === "Service" || itemType === "NonStock") setTrackInventory(false);
  }, [itemType]);

  useEffect(() => {
    if (!initial) {
      setName("");
      setSku("");
      setCategoryId("");
      setBaseUomId(uomOptions[0]?.id ?? "");
      setIssueUomId("");
      setItemType("RawMaterial");
      setTrackInventory(true);
      setIsActive(true);
      return;
    }

    setName(initial.name ?? "");
    setSku(initial.sku ?? "");
    setCategoryId(initial.categoryId ?? "");
    setBaseUomId(initial.baseUomId ?? "");
    setIssueUomId(initial.issueUomId ?? "");
    setItemType(initial.itemType ?? "RawMaterial");
    setTrackInventory(!!initial.trackInventory);
    setIsActive(!!initial.isActive);
  }, [initial, uomOptions]);

  async function submit() {
    setErr(null);

    if (!name.trim()) return setErr("Item name is required.");
    if (!baseUomId) return setErr("Base UoM is required.");
    if (!itemType) return setErr("Item Type is required.");

    const base: CreateInventoryItemDto = {
      name: name.trim(),
      sku: sku.trim() || null,
      categoryId: categoryId || null,
      baseUomId,
      issueUomId: issueUomId || null,
      itemType,
      trackInventory,
    };

    const dto =
      mode === "edit"
        ? ({ ...base, isActive } as UpdateInventoryItemDto)
        : base;

    setSaving(true);
    try {
      await onSubmit(dto);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{mode === "create" ? "New Item" : "Edit Item"}</h3>
        </div>

        {err && <div className="alert alert-error">{err}</div>}

        <div className="form-grid">
          <label className="field">
            <span>Name *</span>
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label className="field">
            <span>SKU</span>
            <input value={sku} onChange={e => setSku(e.target.value)} />
          </label>

          <label className="field">
            <span>Category</span>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categoryOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Item Type *</span>
            <select value={itemType} onChange={e => setItemType(e.target.value as ItemType)}>
              {ITEM_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <small className="muted">
              {ITEM_TYPES.find(x => x.value === itemType)?.help}
            </small>
          </label>

          <label className="field">
            <span>Base UoM *</span>
            <select value={baseUomId} onChange={e => setBaseUomId(e.target.value)}>
              <option value="">—</option>
              {uomOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.code ? `${u.name} (${u.code})` : u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Issue UoM</span>
            <select value={issueUomId} onChange={e => setIssueUomId(e.target.value)}>
              <option value="">—</option>
              {uomOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.code ? `${u.name} (${u.code})` : u.name}
                </option>
              ))}
            </select>
            <small className="muted">Optional. Leave blank to use Base UoM.</small>
          </label>

          <label className="field checkbox">
            <input
              type="checkbox"
              checked={trackInventory}
              onChange={e => setTrackInventory(e.target.checked)}
              disabled={itemType === "Service" || itemType === "NonStock"}
            />
            <span>Track inventory (FIFO / COGS)</span>
          </label>

          {mode === "edit" && (
            <label className="field checkbox">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
              <span>Active</span>
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
