import { useMemo, useState } from "react";
import type {
  CreateStockLocationDto,
  StockLocationDto,
  StockLocationType,
  UpdateStockLocationDto
} from "../types";

type Props = {
  mode: "create" | "edit";
  companyId: string;
  branchId?: string | null;
  initial?: Partial<StockLocationDto>;
  onSubmit: (dto: CreateStockLocationDto | UpdateStockLocationDto) => Promise<void>;
  onCancel: () => void;
};

const TYPES: StockLocationType[] = ["Warehouse", "Store"];

function normalizeCode(x: string) {
  return x
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9\-]/g, "");
}

export default function StockLocationForm({ mode, companyId, branchId, initial, onSubmit, onCancel }: Props) {
  const isCreate = mode === "create";

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [type, setType] = useState<StockLocationType>(initial?.type ?? "Warehouse");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const codeHint = useMemo(() => normalizeCode(code || name), [code, name]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Location name is required.");

    setSaving(true);
    try {
      if (isCreate) {
        const dto: CreateStockLocationDto = {
          companyId,
          branchId: branchId ?? null,
          name: name.trim(),
          code: code ? normalizeCode(code) : normalizeCode(name),
          type,
          address: address || null,
          phone: phone || null,
          isActive,
        };
        await onSubmit(dto);
      } else {
        const dto: UpdateStockLocationDto = {
          branchId: branchId ?? null,
          name: name.trim(),
          code: code ? normalizeCode(code) : initial?.code ?? null,
          type,
          address: address || null,
          phone: phone || null,
          isActive,
        };
        await onSubmit(dto);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-header">
        <h2>{isCreate ? "Create Stock Location" : "Edit Stock Location"}</h2>
      </div>

      <div className="card-body grid">
        <label>
          Name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>

        <label>
          Code (auto from name if empty)
          <input value={code ?? ""} onChange={e => setCode(e.target.value)} placeholder="e.g. WH-MAIN" />
          <div className="muted">Suggested: {codeHint}</div>
        </label>

        <label>
          Type
          <select value={type} onChange={e => setType(e.target.value as StockLocationType)}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label>
          Address
          <input value={address ?? ""} onChange={e => setAddress(e.target.value)} />
        </label>

        <label>
          Phone
          <input value={phone ?? ""} onChange={e => setPhone(e.target.value)} />
        </label>

        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>

      <div className="card-footer actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving..." : (isCreate ? "Create" : "Save")}</button>
      </div>
    </form>
  );
}
