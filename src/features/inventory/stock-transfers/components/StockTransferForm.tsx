// Shared create / edit form for stock transfers.
//
// Location first: choose where the stock leaves (a location of this branch) and where it goes (any receiving
// location of the company, grouped by branch). Whether the transfer stays in the branch or goes to another
// branch follows from the destination, and the form explains what will happen. Lines list only items with
// stock at the source location, with the quantity available.
// A store issuing to a kitchen, bar or outlet of its own branch is an SIV and is blocked here with a pointer to SIV.

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { StateMessage } from "../../../../components/ui/Feedback";
import { useI18n } from "../../../../i18n";
import { cardStyle, labelStyle, tableStyle, tdStyle, thStyle } from "../../../../shared/inventoryStyles";
import { stockTransfersApi, type ItemLookupDto, type UomLookupDto } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_TYPE,
  type StockTransferAvailableItemDto,
  type StockTransferDestinationOption,
  type StockTransferFormLine,
  type StockTransferFormValues,
  type StockTransferLookupsDto,
} from "../types";
import { clean, getApiError, safeNum, todayDateOnly } from "../utils/apiUtils";
import { qty } from "../utils/stockTransferLabels";

export const emptyTransferForm = (): StockTransferFormValues => ({
  transferType: STOCK_TRANSFER_TYPE.InterDepartment,
  toBranchId: "",
  fromDepartmentId: "",
  toDepartmentId: "",
  fromLocationId: "",
  toLocationId: "",
  transferDate: todayDateOnly(),
  notes: "",
  lines: [],
});

const emptyLookups: StockTransferLookupsDto = {
  destinationBranches: [],
  fromDepartments: [],
  toDepartments: [],
  fromLocations: [],
  toLocations: [],
  destinations: [],
};

type Errors = Partial<Record<keyof StockTransferFormValues, string>> & {
  lineErrors?: Record<number, string>;
};

export const SIV_BOUNDARY_MESSAGE =
  "A store issuing stock to a kitchen, bar or outlet of the same branch is a Store Issue Voucher (SIV), not a stock transfer. Raise an SIV instead, or choose another destination.";

const destinationKey = (branchId: string, locationId: string) => `${branchId}|${locationId}`;

function validate(values: StockTransferFormValues, isStoreIssue: boolean): Errors {
  const errors: Errors = {};

  if (!clean(values.fromLocationId)) errors.fromLocationId = "Choose the location the stock leaves.";
  if (!clean(values.toLocationId)) errors.toLocationId = "Choose the location that receives the stock.";
  if (clean(values.fromLocationId) && values.fromLocationId === values.toLocationId)
    errors.toLocationId = "Source and destination locations must be different.";
  if (isStoreIssue) errors.toLocationId = SIV_BOUNDARY_MESSAGE;
  if (!clean(values.transferDate)) errors.transferDate = "Transfer date is required.";
  if (values.lines.length === 0) errors.lines = "Add at least one line.";

  const lineErrors: Record<number, string> = {};
  const seen = new Set<string>();
  values.lines.forEach((line, index) => {
    if (!clean(line.itemId)) lineErrors[index] = "Choose an item.";
    else if (!clean(line.unitId)) lineErrors[index] = "Choose a unit.";
    else if (!(safeNum(line.quantity) > 0)) lineErrors[index] = "Quantity must be greater than zero.";
    const key = `${line.itemId}:${line.unitId}`;
    if (clean(line.itemId) && seen.has(key)) lineErrors[index] = "This item and unit is already on another line.";
    seen.add(key);
  });
  if (Object.keys(lineErrors).length) errors.lineErrors = lineErrors;
  return errors;
}

function hasErrors(errors: Errors) {
  return Object.entries(errors).some(([key, value]) =>
    key === "lineErrors" ? Object.keys(value as object).length > 0 : Boolean(value)
  );
}

export function StockTransferForm({
  companyId,
  branchId,
  initial,
  busy,
  error,
  saveLabel,
  onSave,
  onCancel,
}: {
  companyId: string;
  branchId: string;
  initial: StockTransferFormValues;
  busy: boolean;
  error?: string | null;
  saveLabel: string;
  onSave: (values: StockTransferFormValues, submit: boolean) => void;
  onCancel: () => void;
}) {
  const { tx } = useI18n();
  const [values, setValues] = useState<StockTransferFormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [lookups, setLookups] = useState<StockTransferLookupsDto>(emptyLookups);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [items, setItems] = useState<ItemLookupDto[]>([]);
  const [uoms, setUoms] = useState<UomLookupDto[]>([]);
  const [available, setAvailable] = useState<StockTransferAvailableItemDto[] | null>(null);
  const [availableError, setAvailableError] = useState<string | null>(null);

  useEffect(() => setValues(initial), [initial]);

  useEffect(() => {
    let alive = true;
    Promise.all([stockTransfersApi.listItems(companyId), stockTransfersApi.listUoms(companyId)])
      .then(([itemRows, uomRows]) => {
        if (!alive) return;
        setItems(itemRows);
        setUoms(uomRows);
      })
      .catch((e) => alive && setLookupError(getApiError(e, "Items could not be loaded.")));
    return () => {
      alive = false;
    };
  }, [companyId]);

  // The receiving branch only changes which departments are offered; locations come from `destinations`.
  const receivingBranch = clean(values.toBranchId);
  useEffect(() => {
    let alive = true;
    setLookupsLoading(true);
    stockTransfersApi
      .lookups(companyId, branchId, receivingBranch && receivingBranch !== branchId ? receivingBranch : null)
      .then((data) => alive && setLookups({ ...emptyLookups, ...data }))
      .catch((e) => alive && setLookupError(getApiError(e, "Locations could not be loaded.")))
      .finally(() => alive && setLookupsLoading(false));
    return () => {
      alive = false;
    };
  }, [companyId, branchId, receivingBranch]);

  // Stock on hand at the source location.
  useEffect(() => {
    const from = clean(values.fromLocationId);
    setAvailable(null);
    setAvailableError(null);
    if (!from) return;
    let alive = true;
    stockTransfersApi
      .availableItems(companyId, branchId, from)
      .then((rows) => alive && setAvailable(rows))
      .catch((e) => alive && setAvailableError(getApiError(e, "Stock at this location could not be loaded.")));
    return () => {
      alive = false;
    };
  }, [companyId, branchId, values.fromLocationId]);

  const destinations: StockTransferDestinationOption[] = lookups.destinations ?? [];
  const sendingBranchName = destinations.find((d) => d.sameBranch)?.branchName ?? tx("this branch");
  const destinationGroups = useMemo(() => {
    const groups = new Map<string, { label: string; options: StockTransferDestinationOption[] }>();
    for (const option of destinations) {
      if (option.id === values.fromLocationId && option.sameBranch) continue;
      const label = option.sameBranch ? tx("This branch: {name}", { name: option.branchName }) : option.branchName;
      const group = groups.get(option.branchId) ?? { label, options: [] };
      group.options.push(option);
      groups.set(option.branchId, group);
    }
    return [...groups.values()];
  }, [destinations, values.fromLocationId, tx]);

  const fromLocation = lookups.fromLocations.find((x) => x.id === values.fromLocationId);
  const destination = destinations.find(
    (d) => d.id === values.toLocationId && (!receivingBranch || d.branchId === receivingBranch)
  );
  const crossBranch = Boolean(destination && !destination.sameBranch);
  const isStoreIssue = Boolean(fromLocation?.isStore && destination?.sameBranch && !destination.isStore);

  const itemById = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);
  const uomById = useMemo(() => new Map(uoms.map((x) => [x.id, x])), [uoms]);
  const availableById = useMemo(() => new Map((available ?? []).map((x) => [x.itemId, x])), [available]);

  const set = (patch: Partial<StockTransferFormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  const chooseDestination = (key: string) => {
    const [toBranchId = "", toLocationId = ""] = key.split("|");
    const option = destinations.find((d) => d.branchId === toBranchId && d.id === toLocationId);
    set({
      toBranchId,
      toLocationId,
      transferType: option && !option.sameBranch ? STOCK_TRANSFER_TYPE.InterBranch : STOCK_TRANSFER_TYPE.InterDepartment,
      toDepartmentId: toBranchId === values.toBranchId ? values.toDepartmentId : "",
    });
  };

  const updateLine = (index: number, patch: Partial<StockTransferFormLine>) =>
    setValues((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));

  const unitOptions = (itemId: string) => {
    const item = itemById.get(itemId);
    if (item?.uoms?.length)
      return item.uoms.map((u) => ({ id: u.uomId, label: clean(u.code) || clean(u.name) || "Unit" }));
    const stock = availableById.get(itemId);
    const baseId = item?.baseUomId || stock?.baseUomId;
    if (baseId) {
      const base = uomById.get(baseId);
      return [{ id: baseId, label: base?.label ?? stock?.baseUomCode ?? "Base unit" }];
    }
    return uoms.map((u) => ({ id: u.id, label: u.label }));
  };

  /** Over the stock on hand; checked only when the line is in the base unit (other units are checked on submit). */
  const overStock = (line: StockTransferFormLine) => {
    const stock = availableById.get(line.itemId);
    if (!stock || !line.unitId || line.unitId !== stock.baseUomId) return false;
    const total = values.lines
      .filter((x) => x.itemId === line.itemId && x.unitId === line.unitId)
      .reduce((sum, x) => sum + safeNum(x.quantity), 0);
    return total > stock.availableBaseQty;
  };

  const save = (submit: boolean) => {
    const next = validate(values, isStoreIssue);
    setErrors(next);
    if (hasErrors(next)) return;
    onSave(values, submit);
  };

  const totalQty = values.lines.reduce((sum, line) => sum + safeNum(line.quantity), 0);
  const anyOverStock = values.lines.some(overStock);
  const fieldError = (key: keyof StockTransferFormValues) =>
    errors[key] ? <div className="ui-field-error" role="alert">{tx(errors[key] as string)}</div> : null;

  const showDepartments = lookups.fromDepartments.length > 0 || lookups.toDepartments.length > 0 || Boolean(values.fromDepartmentId || values.toDepartmentId);
  const sourceItems = available ?? [];
  const itemChoices = (line: StockTransferFormLine) => {
    const choices = sourceItems.map((x) => ({
      id: x.itemId,
      label: `${clean(x.itemCode) ? `${clean(x.itemCode)} - ` : ""}${x.itemName} (${qty(x.availableBaseQty)} ${clean(x.baseUomCode)})`.trim(),
    }));
    // Keep an existing line visible even when its item has run out at the source.
    if (line.itemId && !availableById.has(line.itemId)) {
      const item = itemById.get(line.itemId);
      choices.unshift({ id: line.itemId, label: `${item?.label || clean(item?.name) || tx("Item")} (${tx("no stock here")})` });
    }
    return choices;
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? <StateMessage tone="error">{error}</StateMessage> : null}
      {lookupError ? <StateMessage tone="error">{lookupError}</StateMessage> : null}

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{tx("Route")}</div>
        <p className="ui-field-help" style={{ marginTop: 0 }}>
          {tx("Stock leaves a location of {branch}. To send from another branch, switch branch at the top of the page first.", { branch: sendingBranchName })}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="st-from-loc">{tx("From location")} *</label>
            <Select
              id="st-from-loc"
              value={values.fromLocationId}
              disabled={busy || lookupsLoading}
              onChange={(e) => set({ fromLocationId: e.target.value })}
            >
              <option value="">{lookupsLoading ? tx("Loading…") : tx("Select where the stock leaves…")}</option>
              {lookups.fromLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} · {l.locationType}</option>
              ))}
            </Select>
            {fieldError("fromLocationId")}
          </div>

          <div>
            <label style={labelStyle} htmlFor="st-to-loc">{tx("To location")} *</label>
            <Select
              id="st-to-loc"
              value={destination ? destinationKey(destination.branchId, destination.id) : ""}
              disabled={busy || lookupsLoading}
              onChange={(e) => chooseDestination(e.target.value)}
            >
              <option value="">{lookupsLoading ? tx("Loading…") : tx("Select where the stock goes…")}</option>
              {destinationGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((d) => (
                    <option key={destinationKey(d.branchId, d.id)} value={destinationKey(d.branchId, d.id)}>
                      {d.name} · {d.locationType}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {fieldError("toLocationId")}
          </div>
        </div>

        {fromLocation && destination ? (
          <div style={{ marginTop: 12 }}>
            {isStoreIssue ? (
              <StateMessage tone="warning">{tx(SIV_BOUNDARY_MESSAGE)}</StateMessage>
            ) : crossBranch ? (
              <StateMessage tone="info">
                <strong>{fromLocation.name} ({sendingBranchName}) → {destination.name} ({destination.branchName})</strong>
                <br />
                {tx("Goes to another branch: after approval {from} dispatches it into transit, then {to} counts and receives it. Any shortage stays in transit for follow-up.", { from: sendingBranchName, to: destination.branchName })}
              </StateMessage>
            ) : (
              <StateMessage tone="info">
                <strong>{fromLocation.name} → {destination.name}</strong>
                <br />
                {tx("Within {branch}: the stock moves in one step when the approved transfer is posted.", { branch: sendingBranchName })}
              </StateMessage>
            )}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="st-date">{tx("Transfer date")} *</label>
            <Input id="st-date" type="date" value={values.transferDate} disabled={busy} onChange={(e) => set({ transferDate: e.target.value })} />
            {fieldError("transferDate")}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle} htmlFor="st-notes">{tx("Reason / notes")}</label>
            <Textarea id="st-notes" rows={2} value={values.notes} disabled={busy} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>

        {showDepartments ? (
          <details style={{ marginTop: 12 }} open={Boolean(values.fromDepartmentId || values.toDepartmentId)}>
            <summary className="ui-field-help" style={{ cursor: "pointer" }}>{tx("Departments (optional, for reporting)")}</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 8 }}>
              <div>
                <label style={labelStyle} htmlFor="st-from-dept">{tx("Sending department")}</label>
                <Select id="st-from-dept" value={values.fromDepartmentId} disabled={busy} onChange={(e) => set({ fromDepartmentId: e.target.value })}>
                  <option value="">{tx("None")}</option>
                  {lookups.fromDepartments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="st-to-dept">{tx("Receiving department")}</label>
                <Select id="st-to-dept" value={values.toDepartmentId} disabled={busy || !destination} onChange={(e) => set({ toDepartmentId: e.target.value })}>
                  <option value="">{tx("None")}</option>
                  {(crossBranch ? lookups.toDepartments : lookups.fromDepartments).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
                {fieldError("toDepartmentId")}
              </div>
            </div>
          </details>
        ) : null}
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{tx("Lines")} · {values.lines.length} · {tx("total qty")} {qty(totalQty)}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !values.fromLocationId}
            onClick={() => set({ lines: [...values.lines, { itemId: "", unitId: "", quantity: 1, notes: "" }] })}
          >
            {tx("Add line")}
          </Button>
        </div>
        {errors.lines ? <div className="ui-field-error" role="alert">{tx(errors.lines)}</div> : null}
        {availableError ? <StateMessage tone="error">{availableError}</StateMessage> : null}

        {!values.fromLocationId ? (
          <p className="ui-field-help">{tx("Choose the from location first; the items in stock there are listed for the lines.")}</p>
        ) : available && available.length === 0 ? (
          <StateMessage tone="warning">{tx("{location} has no stock to transfer.", { location: fromLocation?.name ?? tx("This location") })}</StateMessage>
        ) : values.lines.length === 0 ? (
          <p className="ui-field-help">{tx("No lines yet. Add the items to move.")}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>{tx("Item")}</th>
                  <th style={thStyle}>{tx("Unit")}</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>{tx("Available")}</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>{tx("Quantity")}</th>
                  <th style={thStyle}>{tx("Note")}</th>
                  <th style={thStyle} aria-label={tx("Remove")} />
                </tr>
              </thead>
              <tbody>
                {values.lines.map((line, index) => {
                  const units = unitOptions(line.itemId);
                  const stock = availableById.get(line.itemId);
                  const over = overStock(line);
                  return (
                    <tr key={index}>
                      <td style={tdStyle}>{index + 1}</td>
                      <td style={{ ...tdStyle, minWidth: 240 }}>
                        <Select
                          aria-label={`Item for line ${index + 1}`}
                          value={line.itemId}
                          disabled={busy || available === null}
                          onChange={(e) => {
                            const item = itemById.get(e.target.value);
                            const inStock = availableById.get(e.target.value);
                            updateLine(index, {
                              itemId: e.target.value,
                              unitId: item?.defaultUomId || item?.baseUomId || inStock?.baseUomId || "",
                            });
                          }}
                        >
                          <option value="">{available === null ? tx("Loading stock…") : tx("Select item…")}</option>
                          {itemChoices(line).map((choice) => (
                            <option key={choice.id} value={choice.id}>{choice.label}</option>
                          ))}
                        </Select>
                        {errors.lineErrors?.[index] ? (
                          <div className="ui-field-error" role="alert">{tx(errors.lineErrors[index])}</div>
                        ) : null}
                        {over ? <div className="ui-field-error" role="alert">{tx("More than the {qty} {unit} available.", { qty: qty(stock?.availableBaseQty), unit: clean(stock?.baseUomCode) })}</div> : null}
                      </td>
                      <td style={{ ...tdStyle, minWidth: 120 }}>
                        <Select aria-label={`Unit for line ${index + 1}`} value={line.unitId} disabled={busy || !line.itemId} onChange={(e) => updateLine(index, { unitId: e.target.value })}>
                          <option value="">{tx("Unit…")}</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>{u.label}</option>
                          ))}
                        </Select>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        {stock ? `${qty(stock.availableBaseQty)} ${clean(stock.baseUomCode)}` : line.itemId ? "0" : "-"}
                      </td>
                      <td style={{ ...tdStyle, width: 130 }}>
                        <Input
                          aria-label={`Quantity for line ${index + 1}`}
                          aria-invalid={over || undefined}
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          style={{ textAlign: "right" }}
                          value={Number.isFinite(line.quantity) ? line.quantity : ""}
                          disabled={busy}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td style={{ ...tdStyle, minWidth: 160 }}>
                        <Input aria-label={`Note for line ${index + 1}`} value={line.notes} disabled={busy} maxLength={500} onChange={(e) => updateLine(index, { notes: e.target.value })} />
                      </td>
                      <td style={tdStyle}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          aria-label={`Remove line ${index + 1}`}
                          onClick={() => set({ lines: values.lines.filter((_, i) => i !== index) })}
                        >
                          {tx("Remove")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{tx("Cancel")}</Button>
        <Button type="button" variant="secondary" disabled={busy || isStoreIssue} onClick={() => save(false)}>
          {busy ? tx("Saving…") : tx(saveLabel)}
        </Button>
        <Button type="button" disabled={busy || isStoreIssue || anyOverStock} onClick={() => save(true)}>
          {tx("Save and submit for approval")}
        </Button>
      </div>
    </div>
  );
}
