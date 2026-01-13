import { useState } from "react";
import type { CompanyDto, CreateCompanyDto, UpdateCompanyDto } from "../types";

type Props = {
  mode: "create" | "edit";
  initial?: Partial<CompanyDto>;
  onSubmit: (dto: CreateCompanyDto | UpdateCompanyDto) => Promise<void>;
  onCancel: () => void;
};

export default function CompanyForm({ mode, initial, onSubmit, onCancel }: Props) {
  const isCreate = mode === "create";
  const [name, setName] = useState(initial?.name ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [tin, setTin] = useState(initial?.tin ?? "");
  const [country, setCountry] = useState(initial?.country ?? "Ethiopia");
  const [currency, setCurrency] = useState(initial?.currency ?? "ETB");
  const [timeZone, setTimeZone] = useState(initial?.timeZone ?? "Africa/Addis_Ababa");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("Company name is required."); return; }

    const dto = {
      name,
      legalName: legalName || null,
      tin: tin || null,
      country: country || null,
      currency: currency || null,
      timeZone: timeZone || null,
      isActive,
    };

    await onSubmit(dto as any);
  };

  return (
    <form onSubmit={submit} className="card">
      <div className="card-header"><h2>{isCreate ? "Create Company" : "Edit Company"}</h2></div>

      <div className="card-body grid">
        <label>Company Name<input value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Legal Name<input value={legalName ?? ""} onChange={e => setLegalName(e.target.value)} /></label>
        <label>TIN<input value={tin ?? ""} onChange={e => setTin(e.target.value)} /></label>
        <label>Country<input value={country ?? ""} onChange={e => setCountry(e.target.value)} /></label>
        <label>Currency<input value={currency ?? ""} onChange={e => setCurrency(e.target.value)} /></label>
        <label>Time Zone<input value={timeZone ?? ""} onChange={e => setTimeZone(e.target.value)} /></label>
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
