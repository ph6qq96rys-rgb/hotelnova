import type { CompanySettingsDto } from "../types";

type Props = {
  value: CompanySettingsDto;
  onChange: (v: CompanySettingsDto) => void;
};

export default function SettingsForm({ value, onChange }: Props) {
  const set = (k: keyof CompanySettingsDto, v: any) => onChange({ ...value, [k]: v });

  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
      <Check label="VAT Enabled" checked={value.vatEnabled} onChange={(v) => set("vatEnabled", v)} />
      <Check label="Prices Include VAT" checked={value.pricesIncludeVat} onChange={(v) => set("pricesIncludeVat", v)} />

      <Field label="VAT Rate (e.g. 0.15)" value={String(value.vatRate)} onChange={(x) => set("vatRate", Number(x))} />
      <Field label="Fiscal Year Start Month (1-12)" value={String(value.fiscalYearStartMonth)} onChange={(x) => set("fiscalYearStartMonth", Number(x))} />

      <Field label="Invoice Prefix" value={value.invoicePrefix} onChange={(x) => set("invoicePrefix", x)} />
      <Field label="Receipt Prefix" value={value.receiptPrefix} onChange={(x) => set("receiptPrefix", x)} />

      <Check label="Allow Negative Stock" checked={value.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />
    </div>
  );
}
type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
};

function Field({ label, value, onChange }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
    </label>
  );
}
type CheckProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};
function Check({ label, checked, onChange }: CheckProps) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 0" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </label>
  );
}
