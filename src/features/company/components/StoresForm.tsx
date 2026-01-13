import { useMemo, useState } from "react";
import type { BranchVm, CreateStoreDto, StoreVm } from "../types";

type Props = {
  companyId: string;
  branches: BranchVm[];
  stores: StoreVm[];
  onAdd: (dto: CreateStoreDto) => Promise<void>;
};

export default function StoresForm({ branches, stores, onAdd }: Props) {
  const firstBranch = branches[0]?.id ?? "";
  const [dto, setDto] = useState<CreateStoreDto>({
    branchId: firstBranch,
    code: "",
    name: "",
    addressLine: "",
  });
  const [busy, setBusy] = useState(false);

  const branchOptions = useMemo(() => branches.map(b => ({ id: b.id, label: `${b.code} - ${b.name}` })), [branches]);

  async function add() {
    if (!dto.branchId || !dto.code.trim() || !dto.name.trim()) return;
    setBusy(true);
    try {
      await onAdd({ ...dto, code: dto.code.trim(), name: dto.name.trim() });
      setDto({ ...dto, code: "", name: "", addressLine: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {branches.length === 0 ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          Add at least one branch first.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#555" }}>Branch</div>
              <select
                value={dto.branchId}
                onChange={(e) => setDto({ ...dto, branchId: e.target.value })}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              >
                {branchOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>

            <Field label="Store Code" value={dto.code} onChange={(v) => setDto({ ...dto, code: v })} />
            <Field label="Store Name" value={dto.name} onChange={(v) => setDto({ ...dto, name: v })} />
            <Field label="Address" value={dto.addressLine ?? ""} onChange={(v) => setDto({ ...dto, addressLine: v })} full />
          </div>

          <button type="button" onClick={add} disabled={busy} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}>
            + Add Store
          </button>
        </>
      )}

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <Head cols={["Code", "Name", "Branch", "Active"]} />
        {stores.map((s) => (
          <Row
            key={s.id}
            cols={[
              s.code,
              s.name,
              branches.find(b => b.id === s.branchId)?.code ?? "",
              s.isActive ? "Yes" : "No",
            ]}
          />
        ))}
        {stores.length === 0 ? <div style={{ padding: 12, color: "#666" }}>No stores yet.</div> : null}
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
};

function Field({ label, value, onChange, full }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <input
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
      />
    </label>
  );
}
function Head({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, background: "#fafafa", padding: 10, fontSize: 12, borderBottom: "1px solid #eee" }}>
      {cols.map(c => <div key={c}><b>{c}</b></div>)}
    </div>
  );
}
function Row({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: 10, borderBottom: "1px solid #f3f3f3" }}>
      {cols.map((c, i) => <div key={i}>{c}</div>)}
    </div>
  );
}
