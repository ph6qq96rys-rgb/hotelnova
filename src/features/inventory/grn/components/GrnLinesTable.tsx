import { useI18n } from "../../../../i18n";
import type { SelectOption } from "../types/grn.types";
import type { FormErrors, GrnLineForm } from "../hooks/useGrnDraftForm";
import type { GrnItemVm } from "../hooks/useGrnLookups";

const grnLinesAmharicPhrases: Record<string, string> = {
  "Base / Purchasing UOM unavailable": "Base / Purchasing UOM አልተገኘም",
  "Select item first": "መጀመሪያ እቃ ይምረጡ",
  "Line Items": "የመስመር እቃዎች",
  "GRN receiving is locked to the item Base/Purchasing UOM.": "GRN መቀበያ በእቃው Base/Purchasing UOM ላይ ተቆልፏል።",
  "Add Line": "መስመር ጨምር",
  "Item *": "እቃ *",
  "Qty *": "ብዛት *",
  "UOM *": "መለኪያ *",
  "Unit Cost": "የአንዱ ዋጋ",
  "Batch": "ባች",
  "Expiry": "የሚያበቃበት",
  "Notes": "ማስታወሻዎች",
  "Total": "ድምር",
  "Loading items...": "እቃዎች በመጫን ላይ...",
  "Select item": "እቃ ይምረጡ",
  "Optional": "አማራጭ",
  "Remove": "አስወግድ",
};

function grnLinesText(language: string, text: string): string {
  return language === "am" ? grnLinesAmharicPhrases[text] ?? text : text;
}
type Props = {
  lines: GrnLineForm[];
  errors: FormErrors;
  itemOptions: SelectOption<string>[];
  itemMap: Map<string, GrnItemVm>;
  loadingItems: boolean;
  busy: boolean;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onPatchLine: (index: number, patch: Partial<GrnLineForm>) => void;
  onItemSelected: (itemId: string, index: number) => void;
};

function money(value: unknown): string {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDecimal(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineUomDisplay(line: GrnLineForm, itemMap: Map<string, GrnItemVm>, tx: (text: string) => string): string {
  const item = itemMap.get(line.itemId);
  return item?.uoms[0]?.label || (line.itemId ? tx("Base / Purchasing UOM unavailable") : tx("Select item first"));
}

export default function GrnLinesTable({
  lines,
  errors,
  itemOptions,
  itemMap,
  loadingItems,
  busy,
  onAddLine,
  onRemoveLine,
  onPatchLine,
  onItemSelected,
}: Props) {
  const { language } = useI18n();
  const tx = (text: string) => grnLinesText(language, text);

  return (
    <section className="grn-editor-card">
      <div className="grn-section-head">
        <div>
          <h2>{tx("Line Items")}</h2>
          <p>{tx("GRN receiving is locked to the item Base/Purchasing UOM.")}</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onAddLine}>+ {tx("Add Line")}</button>
      </div>

      {errors.lines ? <div className="grn-field-error">{errors.lines}</div> : null}

      <div className="erp-table-wrap">
        <table className="table erp-grn-table grn-editor-lines">
          <thead>
            <tr>
              <th>{tx("Item *")}</th>
              <th className="num">{tx("Qty *")}</th>
              <th>{tx("UOM *")}</th>
              <th className="num">{tx("Unit Cost")}</th>
              <th>{tx("Batch")}</th>
              <th>{tx("Expiry")}</th>
              <th>{tx("Notes")}</th>
              <th className="num">{tx("Total")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineError = errors.lineErrors?.[index] ?? {};
              const qty = parseDecimal(line.quantity);
              const cost = parseDecimal(line.unitCost);
              const total = qty * cost;

              return (
                <tr key={index}>
                  <td>
                    <select
                      value={line.itemId}
                      disabled={busy || loadingItems}
                      className={lineError.itemId ? "is-invalid" : ""}
                      onChange={(event) => onItemSelected(event.target.value, index)}
                    >
                      <option value="">{loadingItems ? tx("Loading items...") : tx("Select item")}</option>
                      {itemOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {lineError.itemId ? <small>{lineError.itemId}</small> : null}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={line.quantity}
                      disabled={busy}
                      className={lineError.quantity ? "is-invalid" : ""}
                      onChange={(event) => onPatchLine(index, { quantity: event.target.value })}
                    />
                    {lineError.quantity ? <small>{lineError.quantity}</small> : null}
                  </td>
                  <td>
                    <input readOnly disabled={!line.itemId} value={lineUomDisplay(line, itemMap, tx)} />
                    {lineError.uomId ? <small>{lineError.uomId}</small> : null}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitCost}
                      disabled={busy}
                      className={lineError.unitCost ? "is-invalid" : ""}
                      onChange={(event) => onPatchLine(index, { unitCost: event.target.value })}
                    />
                    {lineError.unitCost ? <small>{lineError.unitCost}</small> : null}
                  </td>
                  <td><input value={line.batchNo} disabled={busy} placeholder={tx("Optional")} onChange={(event) => onPatchLine(index, { batchNo: event.target.value })} /></td>
                  <td><input type="date" value={line.expiryDate} disabled={busy} onChange={(event) => onPatchLine(index, { expiryDate: event.target.value })} /></td>
                  <td><input value={line.notes} disabled={busy} placeholder={tx("Optional")} onChange={(event) => onPatchLine(index, { notes: event.target.value })} /></td>
                  <td className="num"><strong>${money(total)}</strong></td>
                  <td><button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => onRemoveLine(index)}>{tx("Remove")}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
