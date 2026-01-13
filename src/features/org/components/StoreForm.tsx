import { useState } from "react";
import type { CreateStoreDto, StoreDto, UpdateStoreDto } from "../types";

type Props = {
  companyId: string;
  branchId: string;
  mode: "create" | "edit";
  initial?: Partial<StoreDto>;
  onSubmit: (dto: CreateStoreDto | UpdateStoreDto) => Promise<void>;
  onCancel: () => void;
};

export default function StoreForm({ companyId, branchId, mode, initial, onSubmit, onCancel }: Props) {
  const isCreate = mode === "create";
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [isWarehouse, setIsWarehouse] = useState(initial?.isWarehouse ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("Store name is required."); return; }

    const dto: any = isCreate
      ? { companyId, branchId, name, code: code || null, address: address || null, phone: phone || null, isWarehouse, isActive }
      : { name, code: code || null, address: address || null, phone: phone || null, isWarehouse, isActive };

    await onSubmit(dto);
  };

  return (
    <form onSubmit={submit} className="card">
      <div className="card-header"><h2>{isCreate ? "Create Store / Warehouse" : "Edit Store / Warehouse"}</h2></div>
      <div className="card-body grid">
        <label>Name<input value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Code<input value={code ?? ""} onChange={e => setCode(e.target.value)} placeholder="e.g. AA-01" /></label>
        <label>Address<input value={address ?? ""} onChange={e => setAddress(e.target.value)} /></label>
        <label>Phone<input value={phone ?? ""} onChange={e => setPhone(e.target.value)} /></label>
        <label className="row">
          <input type="checkbox" checked={isWarehouse} onChange={e => setIsWarehouse(e.target.checked)} />
          Warehouse location
        </label>
        <label className="row">
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
