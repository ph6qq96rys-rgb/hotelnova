import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import { useStockTransferCatalogs } from "../hooks/useStockTransferCatalogs";
import { buildStockTransferPaths } from "../routing/stockTransferRoutes";
import {
  clean,
  dateOnlyToUtcIso,
  getApiError,
  safeNum,
  todayDateOnly,
} from "../utils/apiUtils";

import {
  cardStyle,
  dangerBtn,
  errorStyle,
  inputStyle,
  labelStyle,
  primaryBtn,
  secondaryBtn,
  stickyBar,
  tableStyle,
  tdStyle,
  thStyle,
} from "../../../../shared/inventoryStyles";

type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type PageState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "error"; message: string };

type TransferLineDraft = {
  itemId: string;
  unitId: string;
  quantity: number;
  notes: string;
};

type TransferDraft = {
  fromLocationId: string;
  toLocationId: string;
  transferDate: string;
  notes: string;
  lines: TransferLineDraft[];
};

type FieldErrors = {
  fromLocationId?: string;
  toLocationId?: string;
  transferDate?: string;
  lines?: string;
  lineErrors?: Record<number, Partial<Record<keyof TransferLineDraft, string>>>;
};

const emptyDraft = (): TransferDraft => ({
  fromLocationId: "",
  toLocationId: "",
  transferDate: todayDateOnly(),
  notes: "",
  lines: [],
});

function validateTransferDraft(draft: TransferDraft): FieldErrors {
  const next: FieldErrors = {};
  const lineErrors: NonNullable<FieldErrors["lineErrors"]> = {};

  const fromLocationId = clean(draft.fromLocationId);
  const toLocationId = clean(draft.toLocationId);

  if (!fromLocationId) next.fromLocationId = "Source location is required.";
  if (!toLocationId) next.toLocationId = "Destination location is required.";

  if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
    next.toLocationId = "Destination location must be different from the source location.";
  }

  if (!clean(draft.transferDate)) next.transferDate = "Transfer date is required.";
  if (!draft.lines.length) next.lines = "Add at least one transfer line.";

  draft.lines.forEach((line, index) => {
    const row: Partial<Record<keyof TransferLineDraft, string>> = {};

    if (!clean(line.itemId)) row.itemId = "Item is required.";
    if (!clean(line.unitId)) row.unitId = "Unit is required.";
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      row.quantity = "Quantity must be greater than zero.";
    }

    if (Object.keys(row).length > 0) lineErrors[index] = row;
  });

  if (Object.keys(lineErrors).length > 0) next.lineErrors = lineErrors;

  return next;
}

function hasErrors(errors: FieldErrors): boolean {
  return Boolean(
    errors.fromLocationId ||
      errors.toLocationId ||
      errors.transferDate ||
      errors.lines ||
      (errors.lineErrors && Object.keys(errors.lineErrors).length)
  );
}

export default function StockTransferCreatePage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { companyId, branchId: selectedBranchId } = useAppScope();
  const branchId = search.get("branchId") || selectedBranchId;

  const [form, setForm] = useState<TransferDraft>(() => {
    const draft=emptyDraft();
    if(search.get("itemId")&&search.get("fromLocationId")&&search.get("toLocationId")) {
      draft.fromLocationId=search.get("fromLocationId")!;draft.toLocationId=search.get("toLocationId")!;
      draft.notes="Prepared from procurement stock availability review.";
      const quantity=Number(search.get("quantity"));
      draft.lines=[{itemId:search.get("itemId")!,unitId:search.get("unitId")??"",quantity:Number.isFinite(quantity)&&quantity>0?quantity:0,notes:""}];
    }
    return draft;
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });

  const catalogs = useStockTransferCatalogs(companyId, branchId);
  const paths = useMemo(() => buildStockTransferPaths(companyId), [companyId]);

  const busy = pageState.status === "saving";
  const submitError = pageState.status === "error" ? pageState.message : null;

  const fromLocationOptions = useMemo<SelectOption[]>(
    () =>
      catalogs.fromLocations.map((location) => ({
        value: location.stockLocationId,
        label: location.label,
      })),
    [catalogs.fromLocations]
  );

  const toLocationOptions = useMemo<SelectOption[]>(
    () =>
      catalogs.toLocations.map((location) => ({
        value: location.stockLocationId,
        label: location.label,
      })),
    [catalogs.toLocations]
  );

  const itemById = useMemo(() => {
    return new Map(catalogs.items.map((item) => [item.id, item]));
  }, [catalogs.items]);

  const itemOptions = useMemo<SelectOption[]>(
    () =>
      catalogs.items.map((item) => ({
        value: item.id,
        label:
          item.label ||
          `${clean(item.sku) || clean(item.code)} ${clean(item.name)}`.trim() ||
          "Item",
      })),
    [catalogs.items]
  );

  const uomById = useMemo(() => {
    return new Map(catalogs.uoms.map((uom) => [String(uom.id), uom]));
  }, [catalogs.uoms]);

  const summary = useMemo(() => {
    const totalQuantity = form.lines.reduce(
      (sum, line) => sum + safeNum(line.quantity),
      0
    );

    const distinctItems = new Set(
      form.lines.map((line) => clean(line.itemId)).filter(Boolean)
    ).size;

    return {
      lines: form.lines.length,
      totalQuantity,
      distinctItems,
    };
  }, [form.lines]);

  const setHeader = useCallback((patch: Partial<TransferDraft>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateLine = useCallback((index: number, patch: Partial<TransferLineDraft>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line
      ),
    }));
  }, []);

  const addLine = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          itemId: "",
          unitId: "",
          quantity: 1,
          notes: "",
        },
      ],
    }));
  }, []);

  const removeLine = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }, []);

  const submit = useCallback(async () => {
    setPageState({ status: "idle" });

    if (!companyId || !branchId || !paths) {
      setPageState({
        status: "error",
        message: "Company and branch scope are required.",
      });
      return;
    }

    const nextErrors = validateTransferDraft(form);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    const payload = {
      fromLocationId: clean(form.fromLocationId),
      toLocationId: clean(form.toLocationId),
      requestedAtUtc: dateOnlyToUtcIso(form.transferDate),
      notes: clean(form.notes) || null,
      lines: form.lines.map((line, index) => ({
        itemId: clean(line.itemId),
        lineNo: index + 1,
        quantity: Number(line.quantity),
        unitId: clean(line.unitId),
        notes: clean(line.notes) || null,
      })),
    };

    setPageState({ status: "saving" });

    try {
      const id = await stockTransfersApi.create(companyId, branchId, payload as any);
      navigate(paths.edit(id));
    } catch (error) {
      setPageState({
        status: "error",
        message: getApiError(error),
      });
    }
  }, [companyId, branchId, paths, form, navigate]);

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (!branchId) return <div style={{ padding: 16 }}>Select a branch first.</div>;
  if (!paths) return <div style={{ padding: 16 }}>Company path could not be resolved.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader submitError={submitError || catalogs.error} />

      <SummaryCard
        lines={summary.lines}
        totalQuantity={summary.totalQuantity}
        distinctItems={summary.distinctItems}
      />

      <HeaderCard
        form={form}
        errors={errors}
        busy={busy}
        catalogsLoading={catalogs.loading}
        fromLocationOptions={fromLocationOptions}
        toLocationOptions={toLocationOptions}
        onChange={setHeader}
      />

      <LinesCard
        form={form}
        errors={errors}
        busy={busy}
        catalogsLoading={catalogs.loading}
        itemById={itemById}
        itemOptions={itemOptions}
        uomById={uomById}
        onAddLine={addLine}
        onRemoveLine={removeLine}
        onUpdateLine={updateLine}
      />

      <FooterActions
        busy={busy}
        onBack={() => navigate(paths.list)}
        onSubmit={() => void submit()}
      />
    </div>
  );
}

function PageHeader({ submitError }: { submitError: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Create Stock Transfer</div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Move stock between department, branch, or operational stock locations. Use SIV when a department requests stock from a warehouse.
        </div>

        {submitError ? <div style={{ marginTop: 10, ...errorStyle }}>{submitError}</div> : null}
      </div>
    </div>
  );
}

function SummaryCard({
  lines,
  totalQuantity,
  distinctItems,
}: {
  lines: number;
  totalQuantity: number;
  distinctItems: number;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Kpi label="Lines" value={lines} />
        <Kpi label="Total Qty" value={totalQuantity} />
        <Kpi label="Distinct Items" value={distinctItems} />
      </div>
    </div>
  );
}

function HeaderCard({
  form,
  errors,
  busy,
  catalogsLoading,
  fromLocationOptions,
  toLocationOptions,
  onChange,
}: {
  form: TransferDraft;
  errors: FieldErrors;
  busy: boolean;
  catalogsLoading: boolean;
  fromLocationOptions: SelectOption[];
  toLocationOptions: SelectOption[];
  onChange: (patch: Partial<TransferDraft>) => void;
}) {
  const fromId = clean(form.fromLocationId);
  const toId = clean(form.toLocationId);

  return (
    <div style={cardStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
        <div style={{ gridColumn: "span 4" }}>
          <label style={labelStyle}>Source Location *</label>
          <select
            style={inputStyle(Boolean(errors.fromLocationId))}
            value={fromId}
            disabled={catalogsLoading || busy}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                fromLocationId: value,
                toLocationId: value === toId ? "" : form.toLocationId,
              });
            }}
          >
            <option value="">
              {catalogsLoading ? "Loading locations..." : "Select source location..."}
            </option>

            {fromLocationOptions
              .filter((option) => option.value !== toId)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          {errors.fromLocationId ? <div style={errorStyle}>{errors.fromLocationId}</div> : null}
        </div>

        <div style={{ gridColumn: "span 4" }}>
          <label style={labelStyle}>Destination Location *</label>
          <select
            style={inputStyle(Boolean(errors.toLocationId))}
            value={toId}
            disabled={catalogsLoading || busy}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                toLocationId: value,
                fromLocationId: value === fromId ? "" : form.fromLocationId,
              });
            }}
          >
            <option value="">
              {catalogsLoading ? "Loading locations..." : "Select destination location..."}
            </option>

            {toLocationOptions
              .filter((option) => option.value !== fromId)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          {errors.toLocationId ? <div style={errorStyle}>{errors.toLocationId}</div> : null}
        </div>

        <div style={{ gridColumn: "span 4" }}>
          <label style={labelStyle}>Transfer Date *</label>
          <input
            style={inputStyle(Boolean(errors.transferDate))}
            type="date"
            value={form.transferDate}
            disabled={busy}
            onChange={(event) => onChange({ transferDate: event.target.value })}
          />
          {errors.transferDate ? <div style={errorStyle}>{errors.transferDate}</div> : null}
        </div>

        <div style={{ gridColumn: "span 12" }}>
          <label style={labelStyle}>Notes</label>
          <input
            style={inputStyle(false)}
            value={form.notes}
            disabled={busy}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="Movement reason, department handoff, or branch transfer note..."
          />
        </div>
      </div>
    </div>
  );
}

function LinesCard({
  form,
  errors,
  busy,
  catalogsLoading,
  itemById,
  itemOptions,
  uomById,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
}: {
  form: TransferDraft;
  errors: FieldErrors;
  busy: boolean;
  catalogsLoading: boolean;
  itemById: Map<string, any>;
  itemOptions: SelectOption[];
  uomById: Map<string, any>;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onUpdateLine: (index: number, patch: Partial<TransferLineDraft>) => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Line Items</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Select inventory items, quantity, and UOM for each transfer line.
          </div>
        </div>

        <button type="button" style={primaryBtn} onClick={onAddLine} disabled={busy}>
          + Add Line
        </button>
      </div>

      {errors.lines ? <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div> : null}

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Item *</th>
              <th style={thStyle}>Qty *</th>
              <th style={thStyle}>Unit *</th>
              <th style={thStyle}>Notes</th>
              <th style={{ ...thStyle, textAlign: "right" }} />
            </tr>
          </thead>

          <tbody>
            {form.lines.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 18, opacity: 0.75 }}>
                  No lines yet. Click <b>Add Line</b>.
                </td>
              </tr>
            ) : (
              form.lines.map((line, index) => (
                <TransferLineRow
                  key={`${index}-${line.itemId || "new"}`}
                  line={line}
                  index={index}
                  lineError={errors.lineErrors?.[index] ?? {}}
                  busy={busy}
                  catalogsLoading={catalogsLoading}
                  itemById={itemById}
                  itemOptions={itemOptions}
                  uomById={uomById}
                  onRemove={() => onRemoveLine(index)}
                  onUpdate={(patch) => onUpdateLine(index, patch)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransferLineRow({
  line,
  index,
  lineError,
  busy,
  catalogsLoading,
  itemById,
  itemOptions,
  uomById,
  onRemove,
  onUpdate,
}: {
  line: TransferLineDraft;
  index: number;
  lineError: Partial<Record<keyof TransferLineDraft, string>>;
  busy: boolean;
  catalogsLoading: boolean;
  itemById: Map<string, any>;
  itemOptions: SelectOption[];
  uomById: Map<string, any>;
  onRemove: () => void;
  onUpdate: (patch: Partial<TransferLineDraft>) => void;
}) {
  const itemId = clean(line.itemId);
  const unitId = clean(line.unitId);

  const selectedItem = itemId ? itemById.get(itemId) : undefined;
  const rawUoms = Array.isArray((selectedItem as any)?.uoms) ? (selectedItem as any).uoms : [];

  const uomOptions: SelectOption[] =
    rawUoms.length > 0
      ? rawUoms
          .map((uom: any) => {
            const id = clean(uom.uomId ?? uom.id);
            const catalogUom = uomById.get(id);
            return {
              value: id,
              label: clean(uom.name ?? uom.uomName ?? catalogUom?.label ?? catalogUom?.name ?? catalogUom?.code) || "UOM",
            };
          })
          .filter((option: SelectOption) => Boolean(option.value))
      : Array.from(uomById.values()).map((uom: any) => ({
          value: clean(uom.id),
          label: clean(uom.label ?? uom.name ?? uom.code) || "UOM",
        }));

  return (
    <tr>
      <td style={tdStyle}>{index + 1}</td>

      <td style={tdStyle}>
        <select
          style={inputStyle(Boolean(lineError.itemId))}
          value={itemId}
          disabled={catalogsLoading || busy}
          onChange={(event) => {
            const selectedItemId = event.target.value;
            const item = selectedItemId ? itemById.get(selectedItemId) : undefined;

            onUpdate({
              itemId: selectedItemId,
              unitId: clean((item as any)?.defaultUomId) || clean((item as any)?.baseUomId) || "",
            });
          }}
        >
          <option value="">{catalogsLoading ? "Loading items..." : "Select item..."}</option>
          {itemOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {lineError.itemId ? <div style={errorStyle}>{lineError.itemId}</div> : null}
      </td>

      <td style={tdStyle}>
        <input
          style={inputStyle(Boolean(lineError.quantity))}
          type="number"
          min={0}
          step={0.01}
          value={Number.isFinite(line.quantity) ? line.quantity : 0}
          disabled={busy}
          onChange={(event) => onUpdate({ quantity: Number(event.target.value) })}
        />
        {lineError.quantity ? <div style={errorStyle}>{lineError.quantity}</div> : null}
      </td>

      <td style={tdStyle}>
        <select
          style={inputStyle(Boolean(lineError.unitId))}
          value={unitId}
          disabled={!itemId || busy}
          onChange={(event) => onUpdate({ unitId: event.target.value })}
        >
          <option value="">{!itemId ? "Select item first..." : "Select unit..."}</option>
          {uomOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {lineError.unitId ? <div style={errorStyle}>{lineError.unitId}</div> : null}
      </td>

      <td style={tdStyle}>
        <input
          style={inputStyle(false)}
          value={line.notes}
          disabled={busy}
          onChange={(event) => onUpdate({ notes: event.target.value })}
          placeholder="Optional"
        />
      </td>

      <td style={{ ...tdStyle, textAlign: "right" }}>
        <button type="button" style={dangerBtn} onClick={onRemove} disabled={busy}>
          Remove
        </button>
      </td>
    </tr>
  );
}

function FooterActions({
  busy,
  onBack,
  onSubmit,
}: {
  busy: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div style={stickyBar}>
      <div style={{ opacity: 0.85 }}>
        <b>Tip:</b> Create the transfer draft, then continue to review and submit.
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" style={secondaryBtn} onClick={onBack} disabled={busy}>
          Transfers
        </button>

        <button type="button" style={primaryBtn} onClick={onSubmit} disabled={busy}>
          {busy ? "Creating..." : "Create Draft & Continue"}
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,.03)", border: "1px solid rgba(0,0,0,.08)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
