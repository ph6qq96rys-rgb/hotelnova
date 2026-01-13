import { useState } from "react";
import type { CreateStockLocationDto, StockLocationDto, UpdateStockLocationDto } from "../types";

type Props = {
  mode: "create" | "edit";
  companyId: string;
  initial?: Partial<StockLocationDto>;
  onSubmit: (dto: CreateStockLocationDto | UpdateStockLocationDto) => Promise<void>;
  onCancel: () => void;
};

export default function StockLocationForm({ mode, companyId, initial, onSubmit, onCancel }: Props) {
  const isCreate = mode === "create";

  const [branchId, setBranchId] = useState(initial?.branchId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [isWarehouse, setIsWarehouse] = useState(initial?.isWarehouse ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Location name is required.");

    if (isCreate) {
      const dto: CreateStockLocationDto = {
        companyId,
        branchId: branchId || null,
        name,
        code: code || null,
        address: address || null,
        phone: phone || null,
        isWarehouse,
        isActive,
      };
      await onSubmit(dto);
    } else {
      const dto: UpdateStockLocationDto = {
        branchId: branchId || null,
        name,
        code: code || null,
        address: address || null,
        phone: phone || null,
        isWarehouse,
        isActive,
      };
      await onSubmit(dto);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-header">
        <h2>{isCreate ? "Create Stock Location" : "Edit Stock Location"}</h2>
      </div>

      <div className="card-body grid">
        <label>
          BranchId (optional)
          <input value={branchId ?? ""} onChange={e => setBranchId(e.target.value)} />
        </label>

        <label>
          Name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>

        <label>
          Code
          <input value={code ?? ""} onChange={e => setCode(e.target.value)} placeholder="e.g. WH-MAIN" />
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
          <input type="checkbox" checked={isWarehouse} onChange={e => setIsWarehouse(e.target.checked)} />
          Warehouse location
        </label>

        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Active
        </label>
      </div>

      <div className="card-footer actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary">{isCreate ? "Create" : "Save"}</button>
      </div>
    </form>
  );
}
