import type { SelectOption } from "../types/grn.types";
import type { FormErrors, GrnForm } from "../hooks/useGrnDraftForm";

type Props = {
  form: GrnForm;
  errors: FormErrors;
  locations: SelectOption<string>[];
  loadingLocations: boolean;
  busy: boolean;
  onPatch: (patch: Partial<GrnForm>) => void;
};

export default function GrnHeaderForm({ form, errors, locations, loadingLocations, busy, onPatch }: Props) {
  const locationPlaceholder = loadingLocations
    ? "Loading locations..."
    : locations.length
      ? "Select receiving location"
      : "No active receiving locations found";

  return (
    <section className="grn-editor-card">
      <div className="grn-editor-grid">
        <label className="grn-field grn-col-4">
          <span>Receiving Location *</span>
          <select
            value={form.receivingLocationId}
            disabled={busy || loadingLocations || locations.length === 0}
            className={errors.receivingLocationId ? "is-invalid" : ""}
            onChange={(event) => onPatch({ receivingLocationId: event.target.value })}
          >
            <option value="">{locationPlaceholder}</option>
            {locations.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.receivingLocationId ? <small>{errors.receivingLocationId}</small> : null}
        </label>

        <label className="grn-field grn-col-3">
          <span>Received Date *</span>
          <input
            type="date"
            value={form.receivedDate}
            disabled={busy}
            className={errors.receivedDate ? "is-invalid" : ""}
            onChange={(event) => onPatch({ receivedDate: event.target.value })}
          />
          {errors.receivedDate ? <small>{errors.receivedDate}</small> : null}
        </label>

        <label className="grn-field grn-col-5">
          <span>Supplier</span>
          <input
            value={form.supplierName}
            disabled={busy}
            placeholder="Supplier name"
            onChange={(event) => onPatch({ supplierName: event.target.value })}
          />
        </label>

        <label className="grn-field grn-col-12">
          <span>Notes</span>
          <textarea
            value={form.notes}
            disabled={busy}
            placeholder="Receiving notes"
            onChange={(event) => onPatch({ notes: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
