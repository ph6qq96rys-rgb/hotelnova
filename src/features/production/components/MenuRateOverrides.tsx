export type RateOverrides = {
  vatRateOverride: number | null;
  serviceChargeRateOverride: number | null;
  contingencyRateOverride: number | null;
};

export const inheritedRates: RateOverrides = {
  vatRateOverride: null, serviceChargeRateOverride: null, contingencyRateOverride: null,
};

const fields = [
  ["vatRateOverride", "VAT (%)", 15],
  ["serviceChargeRateOverride", "Service charge (%)", 10],
  ["contingencyRateOverride", "Recipe contingency (%)", 10],
] as const;

export default function MenuRateOverrides({ value, onChange, disabled = false }: {
  value: RateOverrides; onChange: (value: RateOverrides) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: "20px 0 0", minWidth: 0 }}>
    <legend className="p-field__label">Tax, service charge &amp; recipe allowance</legend>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
      {fields.map(([key, label, initial]) => <div key={key}>
        <label className="p-field">
          <span className="p-field__label">{label}</span>
          <input className="p-input" type="number" min={0} max={100} step="0.0001"
            value={value[key] ?? ""} disabled={value[key] === null}
            onChange={event => onChange({ ...value, [key]: event.target.value === "" ? 0 : Number(event.target.value) })} />
        </label>
        <label className="p-checkbox" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={value[key] === null}
            onChange={event => onChange({ ...value, [key]: event.target.checked ? null : initial })} />
          <span>Company default</span>
        </label>
      </div>)}
    </div>
  </fieldset>;
}
