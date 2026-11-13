import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { DateTimeField, NumberField, SelectField, TextField } from "./ui";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import type { CateringPackage } from "../screens/PackagesScreen";

export type ServiceDraft = { serviceAtUtc: string; name: string; packageId: string; guestCount: number; selectedLineKeys?: string[] };
export type ScheduledService = ServiceDraft & { id: string; snapshot: { packageName: string; guestCount: number; sellingPrice: number; selectedLineKeys?: string[]; items?: { name: string; quantity: number }[] } };
export function scheduleFromJson(json?: string | null): ScheduledService[] {
  try { return json ? JSON.parse(json).services ?? [] : []; } catch { return []; }
}
const localTime = (iso: string) => iso ? new Date(new Date(iso).getTime() + 3 * 3600000).toISOString().slice(0, 16) : "";
export function ServiceScheduleEditor({ services, packages, onChange }: {
  services: ServiceDraft[]; packages: CateringPackage[]; onChange: (rows: ServiceDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<ServiceDraft>) => onChange(services.map((s, j) => i === j ? { ...s, ...patch } : s));
  return <fieldset><legend>Meal service schedule</legend>
    <p>One booking, with a separate row for every lunch and tea break. All service times are Addis Ababa time (UTC+3). Prices are calculated from the selected packages when saved.</p>
    {services.map((s, i) => <fieldset key={i}><legend>Service {i + 1}</legend>
      <div className="cat-form-grid">
        <TextField label="Service name" value={s.name} onChange={name => update(i, { name })} />
        <DateTimeField label="Service date and time (Addis Ababa)" value={localTime(s.serviceAtUtc)} onChange={value => update(i, { serviceAtUtc: value ? new Date(value + "+03:00").toISOString() : "" })} />
        <NumberField label="Guests for this service" min={1} value={s.guestCount} onChange={value => update(i, { guestCount: Number(value) })} />
        <SelectField label="Service package" value={s.packageId} placeholder="Select package" options={packages.map(p => ({ value: p.id!, label: p.name }))}
          onChange={packageId => update(i, { packageId, selectedLineKeys: [] })} />
      </div>
      {packages.find(p => p.id === s.packageId)?.offering?.sections.map((section, sectionIndex) => section.rule !== "All" && <fieldset key={sectionIndex}>
        <legend>{section.name} · {section.rule === "Choose" ? `Select ${section.selectCount}` : "Optional add-ons"}</legend>
        {section.items.map(item => { const key = `${sectionIndex}:${item.itemId}`; return <label key={key}><Checkbox checked={s.selectedLineKeys?.includes(key) ?? false}
          onChange={e => update(i, { selectedLineKeys: e.target.checked ? [...(s.selectedLineKeys ?? []), key] : (s.selectedLineKeys ?? []).filter(x => x !== key) })} />{item.name}</label>; })}
      </fieldset>)}
      <Button type="button" variant="outline" onClick={() => onChange(services.filter((_, j) => j !== i))}>Remove service {i + 1}</Button>
      <Button type="button" variant="outline" onClick={() => onChange([...services, { ...s, serviceAtUtc: s.serviceAtUtc ? new Date(new Date(s.serviceAtUtc).getTime() + 86400000).toISOString() : "" }])}>Repeat next day</Button>
    </fieldset>)}
    <Button type="button" variant="outline" onClick={() => onChange([...services, { serviceAtUtc: "", name: "Lunch", guestCount: services[0]?.guestCount ?? 50, packageId: "" }])}>Add meal service</Button>
  </fieldset>;
}
export function ServiceScheduleTable({ services }: { services?: ScheduledService[] }) {
  if (!services?.length) return null;
  return <section className="co-card"><h3>Service schedule</h3><p>Times: Addis Ababa (UTC+3). Amounts before booking-level charges and tax.</p>
    <div className="co-table-wrap"><table className="cat-table"><thead><tr><th>Date and time</th><th>Service</th><th>Package</th><th>Guests</th><th>Amount</th></tr></thead>
      <tbody>{services.map(s => <tr key={s.id}><td>{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", dateStyle: "medium", timeStyle: "short" }).format(new Date(s.serviceAtUtc))}</td>
        <td>{s.name}</td><td>{s.snapshot.packageName}</td><td>{s.snapshot.guestCount}</td><td>{formatCurrency(s.snapshot.sellingPrice)}</td></tr>)}</tbody></table></div>
  </section>;
}
