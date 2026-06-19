// src/features/organization/components/CompanyForm.tsx

import { useMemo, useState } from "react";
import type { CompanyDto, CreateCompanyDto, UpdateCompanyDto } from "../types";

type Props =
  | {
      mode: "create";
      initial?: Partial<CompanyDto>;
      saving?: boolean;
      onSubmit: (dto: CreateCompanyDto) => Promise<void>;
      
      onCancel: () => void;
    }
  | {
      mode: "edit";
      initial?: Partial<CompanyDto>;
      saving?: boolean;
      onSubmit: (dto: UpdateCompanyDto) => Promise<void>;
      onCancel: () => void;
    };

function clean(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

export default function CompanyForm(props: Props) {
  const { mode, initial, saving = false, onCancel } = props;
  const isCreate = mode === "create";

  const [name, setName] = useState(initial?.name ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [tin, setTin] = useState(initial?.tin ?? "");
  const [country, setCountry] = useState(initial?.country ?? "Ethiopia");
  const [currency, setCurrency] = useState(initial?.currency ?? "ETB");
  const [timeZone, setTimeZone] = useState(initial?.timeZone ?? "Africa/Addis_Ababa");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(name.trim()), [name]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Company name is required.");
      return;
    }

    setError(null);

    const dto = {
      name: name.trim(),
      legalName: clean(legalName),
      tin: clean(tin),
      country: clean(country),
      currency: clean(currency),
      timeZone: clean(timeZone),
      isActive,
    };

    if (props.mode === "create") {
      await props.onSubmit(dto);
    } else {
      await props.onSubmit(dto);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="card-header">
        <h2>{isCreate ? "Create Company" : "Edit Company"}</h2>
      </div>

      <div className="card-body grid">
        {error && <div className="alert alert-danger">{error}</div>}

        <label>
          Company Name <span className="req">*</span>
          <input value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Legal Name
          <input value={legalName} disabled={saving} onChange={(e) => setLegalName(e.target.value)} />
        </label>

        <label>
          TIN
          <input value={tin} disabled={saving} onChange={(e) => setTin(e.target.value)} />
        </label>

        <label>
          Country
          <input value={country} disabled={saving} onChange={(e) => setCountry(e.target.value)} />
        </label>

        <label>
          Currency
          <input
            value={currency}
            disabled={saving}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </label>

        <label>
          Time Zone
          <input value={timeZone} disabled={saving} onChange={(e) => setTimeZone(e.target.value)} />
        </label>

        <label className="row">
          <input
            type="checkbox"
            checked={isActive}
            disabled={saving}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="card-footer actions">
        <button type="button" className="btn" disabled={saving} onClick={onCancel}>
          Cancel
        </button>

        <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
          {saving ? "Saving…" : isCreate ? "Create" : "Save"}
        </button>
      </div>
    </form>
  );
}