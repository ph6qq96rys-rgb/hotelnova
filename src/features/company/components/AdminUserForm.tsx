import type { BranchVm, CreateCompanyAdminUserDto, StoreVm } from "../types";

type Props = {
  branches: BranchVm[];
  stores: StoreVm[];
  value: CreateCompanyAdminUserDto;
  onChange: (v: CreateCompanyAdminUserDto) => void;
};

export default function AdminUserForm({ branches, stores, value, onChange }: Props) {
  const set = <K extends keyof CreateCompanyAdminUserDto>(
    k: K,
    v: CreateCompanyAdminUserDto[K]
  ) => onChange({ ...value, [k]: v });

  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
      <Field label="Username" value={value.userName} onChange={(x) => set("userName", x)} />
      <Field label="Email" value={value.email} onChange={(x) => set("email", x)} />

      <Field
        label="Password"
        value={value.password}
        onChange={(x) => set("password", x)}
        type="password"
      />

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#555" }}>Branch Scope (optional)</div>
        <select
          value={value.branchId ?? ""}
          onChange={(e) => set("branchId", (e.target.value || undefined) as CreateCompanyAdminUserDto["branchId"])}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="">(none)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} - {b.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#555" }}>Store Scope (optional)</div>
        <select
          value={value.storeId ?? ""}
          onChange={(e) => set("storeId", (e.target.value || undefined) as CreateCompanyAdminUserDto["storeId"])}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="">(none)</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  type?: React.HTMLInputTypeAttribute;
  onChange: (value: string) => void;
};

function Field({ label, value, onChange, type = "text" }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
      />
    </label>
  );
}
