import { useI18n } from "../../../../i18n";
import type { SelectOption } from "../types/grn.types";
import type { FormErrors, GrnForm } from "../hooks/useGrnDraftForm";

const grnHeaderAmharicPhrases: Record<string, string> = {
  "Loading locations...": "ቦታዎች በመጫን ላይ...",
  "Select receiving location": "የመቀበያ ቦታ ይምረጡ",
  "No active receiving locations found": "ንቁ የመቀበያ ቦታዎች አልተገኙም",
  "Receiving Location *": "የመቀበያ ቦታ *",
  "Received Date *": "የተቀበለበት ቀን *",
  "Supplier": "አቅራቢ",
  "Supplier name": "የአቅራቢ ስም",
  "Notes": "ማስታወሻዎች",
  "Receiving notes": "የመቀበያ ማስታወሻዎች",
};

function grnHeaderText(language: string, text: string): string {
  return language === "am" ? grnHeaderAmharicPhrases[text] ?? text : text;
}
type Props = {
  form: GrnForm;
  errors: FormErrors;
  locations: SelectOption<string>[];
  loadingLocations: boolean;
  busy: boolean;
  onPatch: (patch: Partial<GrnForm>) => void;
};

export default function GrnHeaderForm({ form, errors, locations, loadingLocations, busy, onPatch }: Props) {
  const { language } = useI18n();
  const tx = (text: string) => grnHeaderText(language, text);
  const locationPlaceholder = loadingLocations
    ? tx("Loading locations...")
    : locations.length
      ? tx("Select receiving location")
      : tx("No active receiving locations found");

  return (
    <section className="grn-editor-card">
      <div className="grn-editor-grid">
        <label className="grn-field grn-col-4">
          <span>{tx("Receiving Location *")}</span>
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
          <span>{tx("Received Date *")}</span>
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
          <span>{tx("Supplier")}</span>
          <input
            value={form.supplierName}
            disabled={busy}
            placeholder={tx("Supplier name")}
            onChange={(event) => onPatch({ supplierName: event.target.value })}
          />
        </label>

        <label className="grn-field grn-col-12">
          <span>{tx("Notes")}</span>
          <textarea
            value={form.notes}
            disabled={busy}
            placeholder={tx("Receiving notes")}
            onChange={(event) => onPatch({ notes: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
