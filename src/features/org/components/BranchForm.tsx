import { useState } from "react";
import type { BranchDto, CreateBranchDto, UpdateBranchDto } from "../types";

type Props = {
  companyId: string;
  mode: "create" | "edit";
  initial?: Partial<BranchDto>;
  onSubmit: (dto: CreateBranchDto | UpdateBranchDto) => Promise<void>;
  onCancel: () => void;
};

export default function BranchForm({ companyId, mode, initial, onSubmit, onCancel }: Props) {
  const isCreate = mode === "create";
  const [name, setName] = useState(initial?.name ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("Branch name is required."); return; }

    const dto: any = isCreate
      ? { companyId, name, region: region || null, city: city || null, address: address || null, phone: phone || null, isActive }
      : { name, region: region || null, city: city || null, address: address || null, phone: phone || null, isActive };

    await onSubmit(dto);
  };

  return (
    <form onSubmit={submit} className="card">
      <div className="card-header"><h2>{isCreate ? "Create Branch" : "Edit Branch"}</h2></div>
      <div className="card-body grid">
        <label>Branch Name<input value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Region<input value={region ?? ""} onChange={e => setRegion(e.target.value)} /></label>
        <label>City<input value={city ?? ""} onChange={e => setCity(e.target.value)} /></label>
        <label>Address<input value={address ?? ""} onChange={e => setAddress(e.target.value)} /></label>
        <label>Phone<input value={phone ?? ""} onChange={e => setPhone(e.target.value)} /></label>
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
