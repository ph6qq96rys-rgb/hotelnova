// src/features/organization/components/StoreForm.tsx

import { useMemo, useState } from "react";
import type { CreateStoreDto, StoreDto, UpdateStoreDto } from "../types";

type Props =
  | {
      mode: "create";
      companyId: string;
      branchId: string;
      initial?: Partial<StoreDto>;
      saving?: boolean;
      onSubmit: (dto: CreateStoreDto) => Promise<void>;
      onCancel: () => void;
    }
  | {
      mode: "edit";
      companyId: string;
      branchId: string;
      initial?: Partial<StoreDto>;
      saving?: boolean;
      onSubmit: (dto: UpdateStoreDto) => Promise<void>;
      onCancel: () => void;
    };

function clean(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

export default function StoreForm(props: Props) {
  const { companyId, branchId, mode, initial, saving = false, onCancel } = props;
  const isCreate = mode === "create";

  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [isWarehouse, setIsWarehouse] = useState(initial?.isWarehouse ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => Boolean(companyId && branchId && name.trim()),
    [companyId, branchId, name]
  );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!companyId || !branchId) {
      setError("Company and branch are required.");
      return;
    }

    if (!name.trim()) {
      setError("Store name is required.");
      return;
    }

    setError(null);

    if (props.mode === "create") {
      await props.onSubmit({
        companyId,
        branchId,
        name: name.trim(),
        code: clean(code),
        address: clean(address),
        phone: clean(phone),
        isWarehouse,
        isActive,
      });
      return;
    }

    await props.onSubmit({
      name: name.trim(),
      code: clean(code),
      address: clean(address),
      phone: clean(phone),
      isWarehouse,
      isActive,
    });
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="card-header">
        <h2>{isCreate ? "Create Store / Warehouse" : "Edit Store / Warehouse"}</h2>
      </div>

      <div className="card-body grid">
        {error && <div className="alert alert-danger">{error}</div>}

        <label>
          Name <span className="req">*</span>
          <input value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Code
          <input
            value={code}
            disabled={saving}
            placeholder="e.g. AA-01"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
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
            checked={isWarehouse}
            disabled={saving}
            onChange={(e) => setIsWarehouse(e.target.checked)}
          />
          Warehouse location
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