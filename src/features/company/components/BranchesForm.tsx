import { useState } from "react";
import type { BranchVm, CreateBranchDto } from "../types";

type Props = {
  branches: BranchVm[];
  onAdd: (dto: CreateBranchDto) => Promise<void>;
};

export default function BranchesForm({ branches, onAdd }: Props) {
  const [dto, setDto] = useState<CreateBranchDto>({
    code: "",
    name: "",
    region: "",
    city: "",
    addressLine: "",
    isMain: branches.length === 0,
  });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!dto.code.trim() || !dto.name.trim()) return;
    setBusy(true);
    try {
      await onAdd({ ...dto, code: dto.code.trim(), name: dto.name.trim() });
      setDto({
        code: "",
        name: "",
        region: "",
        city: "",
        addressLine: "",
        isMain: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <Field label="Branch Code" value={dto.code} onChange={(v) => setDto({ ...dto, code: v })} />
        <Field label="Branch Name" value={dto.name} onChange={(v) => setDto({ ...dto, name: v })} />
        <Field label="Region" value={dto.region ?? ""} onChange={(v) => setDto({ ...dto, region: v })} />
        <Field label="City" value={dto.city ?? ""} onChange={(v) => setDto({ ...dto, city: v })} />
        <Field
          label="Address"
          value={dto.addressLine ?? ""}
          onChange={(v) => setDto({ ...dto, addressLine: v })}
          full
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={dto.isMain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDto({ ...dto, isMain: e.target.checked })
            }
          />
          <span style={{ fontSize: 13 }}>Mark as Main</span>
        </label>
      </div>

      <button
        type="button"
        onClick={add}
        disabled={busy}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
      >
        + Add Branch
      </button>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <TableHead cols={["Code", "Name", "City", "Main", "Active"]} />
        {branches.map((b) => (
          <TableRow
            key={b.id}
            cols={[b.code, b.name, b.city ?? "", b.isMain ? "Yes" : "No", b.isActive ? "Yes" : "No"]}
          />
        ))}
        {branches.length === 0 ? <div style={{ padding: 12, color: "#666" }}>No branches yet.</div> : null}
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

function TableHead({ cols }: { cols: string[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        background: "#fafafa",
        padding: 10,
        fontSize: 12,
        color: "#444",
        borderBottom: "1px solid #eee",
      }}
    >
      {cols.map((c) => (
        <div key={c}>
          <b>{c}</b>
        </div>
      ))}
    </div>
  );
}

function TableRow({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: 10, borderBottom: "1px solid #f3f3f3" }}>
      {cols.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}
