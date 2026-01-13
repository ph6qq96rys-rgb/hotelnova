import type { CreateCompanyDto } from "../types";

type Props = {
  value: CreateCompanyDto;
  onChange: (v: CreateCompanyDto) => void;
};

export default function CompanyForm({ value, onChange }: Props) {
  const set = (k: keyof CreateCompanyDto, v: any) => onChange({ ...value, [k]: v });

  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
      <Field label="Legal Name" value={value.legalName} onChange={(x) => set("legalName", x)} required />
      <Field label="Trade Name" value={value.tradeName ?? ""} onChange={(x) => set("tradeName", x)} />

      <Field label="Phone" value={value.phone ?? ""} onChange={(x) => set("phone", x)} />
      <Field label="Email" value={value.email ?? ""} onChange={(x) => set("email", x)} />

      <Field label="TIN" value={value.tinNumber ?? ""} onChange={(x) => set("tinNumber", x)} />
      <Field label="VAT" value={value.vatNumber ?? ""} onChange={(x) => set("vatNumber", x)} />

      <Field label="Country" value={value.country ?? ""} onChange={(x) => set("country", x)} />
      <Field label="City" value={value.city ?? ""} onChange={(x) => set("city", x)} />

      <Field label="Address" value={value.addressLine ?? ""} onChange={(x) => set("addressLine", x)} full />
      <Field label="Currency" value={value.defaultCurrency} onChange={(x) => set("defaultCurrency", x)} />
      <Field label="Timezone" value={value.timezone} onChange={(x) => set("timezone", x)} />
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: props.full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, color: "#555" }}>
        {props.label} {props.required ? <span style={{ color: "crimson" }}>*</span> : null}
      </div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
      />
    </label>
  );
}
