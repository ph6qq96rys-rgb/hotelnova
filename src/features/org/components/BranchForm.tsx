// src/features/organization/components/BranchForm.tsx

import { useMemo, useState } from "react";
import type { BranchDto, CreateBranchDto, UpdateBranchDto } from "../types";

type Props =
  | {
      mode: "create";
      companyId: string;
      initial?: Partial<BranchDto>;
      saving?: boolean;
      onSubmit: (dto: CreateBranchDto) => Promise<void>;
      onCancel: () => void;
    }
  | {
      mode: "edit";
      companyId: string;
      initial?: Partial<BranchDto>;
      saving?: boolean;
      onSubmit: (dto: UpdateBranchDto) => Promise<void>;
      onCancel: () => void;
    };

function clean(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

export default function BranchForm(props: Props) {
  const { companyId, mode, initial, saving = false, onCancel } = props;
  const isCreate = mode === "create";

  const [name, setName] = useState(initial?.name ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(companyId && name.trim()), [companyId, name]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!companyId) {
      setError("Company is required.");
      return;
    }

    if (!name.trim()) {
      setError("Branch name is required.");
      return;
    }

    setError(null);

    if (props.mode === "create") {
      await props.onSubmit({
        companyId,
        name: name.trim(),
        region: clean(region),
        city: clean(city),
        address: clean(address),
        phone: clean(phone),
        isActive,
      });
      return;
    }

    await props.onSubmit({
      name: name.trim(),
      region: clean(region),
      city: clean(city),
      address: clean(address),
      phone: clean(phone),
      isActive,
    });
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="card-header">
        <h2>{isCreate ? "Create Branch" : "Edit Branch"}</h2>
      </div>

      <div className="card-body grid">
        {error && <div className="alert alert-danger">{error}</div>}

        <label>
          Branch Name <span className="req">*</span>
          <input value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Region
          <input value={region} disabled={saving} onChange={(e) => setRegion(e.target.value)} />
        </label>

        <label>
          City
          <input value={city} disabled={saving} onChange={(e) => setCity(e.target.value)} />
        </label>

        <label>
          Address
          <input value={address} disabled={saving} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <label>
          Phone
          <input value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
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