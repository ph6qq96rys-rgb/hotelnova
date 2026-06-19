import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";
import type { InventoryItemDto } from "../../../inventoryMaster/items/types";

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

type StockTransferPaths = {
  list: string;
  edit: (id: string) => string;
};

type ItemUomVm = {
  uomId: string;
  uomName: string;
  isDefault?: boolean;
};

type ItemVm = {
  id: string;
  label: string;
  uoms: ItemUomVm[];
  defaultUomId: string;
};

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
  lineErrors?: Record<
    number,
    Partial<Record<keyof TransferLineDraft, string>>
  >;
};

const emptyDraft = (): TransferDraft => ({
  fromLocationId: "",
  toLocationId: "",
  transferDate: todayDateOnly(),
  notes: "",
  lines: [],
});

function clean(value?: string | null) {
  return (value ?? "").trim();
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyToUtcIso(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date().toISOString();
  }

  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function getErrorMessage(error: any) {
  const data = error?.response?.data;

  if (typeof data === "string") return data;

  return (
    data?.detail ||
    data?.title ||
    data?.message ||
    error?.message ||
    "Request failed."
  );
}

function toItemVm(dto: InventoryItemDto): ItemVm {
  const raw = dto as any;

  const id = clean(raw.id);
  const name = clean(raw.name) || "Item";
  const code = clean(raw.code) || clean(raw.sku);

  const rawUoms: any[] = Array.isArray(raw.uoms)
    ? raw.uoms
    : Array.isArray(raw.itemUoms)
    ? raw.itemUoms
    : Array.isArray(raw.allowedUoms)
    ? raw.allowedUoms
    : [];

  const uoms: ItemUomVm[] = rawUoms
    .map((uom) => {
      const uomId = clean(uom.uomId ?? uom.id);
      const uomName = clean(uom.uomName ?? uom.name ?? uom.code ?? "UOM");

      return {
        uomId,
        uomName,
        isDefault:
          Boolean(uom.isDefaultIssue) ||
          Boolean(uom.isDefaultPurchase) ||
          Boolean(uom.isDefault) ||
          Boolean(uom.isBase),
      };
    })
    .filter((uom) => Boolean(uom.uomId));

  const baseUomId = clean(raw.baseUomId);
  const baseUomName = clean(
    raw.baseUomName ??
      raw.baseUomCode ??
      raw.baseUom?.name ??
      raw.baseUom?.code
  );

  if (!uoms.length && baseUomId) {
    uoms.push({
      uomId: baseUomId,
      uomName: baseUomName || "Base UOM",
      isDefault: true,
    });
  }

  const defaultUomId =
    uoms.find((uom) => uom.isDefault)?.uomId ||
    baseUomId ||
    uoms[0]?.uomId ||
    "";

  return {
    id,
    label: code ? `${code} — ${name}` : name,
    uoms,
    defaultUomId,
  };
}

function validateTransferDraft(draft: TransferDraft): FieldErrors {
  const next: FieldErrors = {};
  const lineErrors: NonNullable<FieldErrors["lineErrors"]> = {};

  const fromLocationId = clean(draft.fromLocationId);
  const toLocationId = clean(draft.toLocationId);

  if (!fromLocationId) {
    next.fromLocationId = "From location is required.";
  }

  if (!toLocationId) {
    next.toLocationId = "To location is required.";
  }

  if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
    next.toLocationId = "To location must be different from From location.";
  }

  if (!clean(draft.transferDate)) {
    next.transferDate = "Transfer date is required.";
  }

  if (!draft.lines.length) {
    next.lines = "Add at least one transfer line.";
  }

  draft.lines.forEach((line, index) => {
    const row: Partial<Record<keyof TransferLineDraft, string>> = {};

    if (!clean(line.itemId)) row.itemId = "Item is required.";
    if (!clean(line.unitId)) row.unitId = "Unit is required.";

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      row.quantity = "Quantity must be greater than zero.";
    }

    if (Object.keys(row).length > 0) {
      lineErrors[index] = row;
    }
  });

  if (Object.keys(lineErrors).length > 0) {
    next.lineErrors = lineErrors;
  }

  return next;
}

function hasErrors(errors: FieldErrors) {
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
  const { companyId, branchId } = useAppScope();

  const [form, setForm] = useState<TransferDraft>(() => emptyDraft());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });

  const [locationOptions, setLocationOptions] = useState<SelectOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationLabelById, setLocationLabelById] = useState<Record<string, string>>(
    {}
  );
  const fetchedLocationRef = useRef<Set<string>>(new Set());

  const [items, setItems] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemLabelById, setItemLabelById] = useState<Record<string, string>>({});
  const [uomLabelById, setUomLabelById] = useState<Record<string, string>>({});

  const busy = pageState.status === "saving";
  const submitError = pageState.status === "error" ? pageState.message : null;

  const paths = useMemo<StockTransferPaths | null>(() => {
    if (!companyId) return null;

    const base = `/companies/${companyId}/inventory/stock-transfers`;

    return {
      list: base,
      edit: (id: string) => `${base}/${id}/edit`,
    };
  }, [companyId]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const itemById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const itemOptions = useMemo<SelectOption[]>(() => {
    return items.map((item) => ({
      value: item.id,
      label: item.label,
    }));
  }, [items]);

  const summary = useMemo(() => {
    const totalQuantity = form.lines.reduce((sum, line) => {
      return sum + (Number.isFinite(line.quantity) ? Number(line.quantity) : 0);
    }, 0);

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

  const updateLine = useCallback(
    (index: number, patch: Partial<TransferLineDraft>) => {
      setForm((prev) => ({
        ...prev,
        lines: prev.lines.map((line, lineIndex) =>
          lineIndex === index ? { ...line, ...patch } : line
        ),
      }));
    },
    []
  );

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

    setErrors((prev) => {
      if (!prev.lineErrors) return prev;

      const remapped: NonNullable<FieldErrors["lineErrors"]> = {};

      Object.entries(prev.lineErrors).forEach(([key, value]) => {
        const lineIndex = Number(key);

        if (!Number.isFinite(lineIndex)) return;
        if (lineIndex < index) remapped[lineIndex] = value;
        if (lineIndex > index) remapped[lineIndex - 1] = value;
      });

      return {
        ...prev,
        lineErrors: remapped,
      };
    });
  }, []);

  useEffect(() => {
    if (!companyId || !branchId) {
      setLocationOptions([]);
      return;
    }

    let alive = true;

    async function loadLocations() {
      setLocationsLoading(true);

      try {
        const rows = await stockLocationsApi.list(companyId!, branchId!);

        if (!alive) return;

        const options = (rows ?? [])
          .map((row: any) => ({
            value: clean(row.id),
            label: clean(row.name) || clean(row.code) || "Location",
          }))
          .filter((option) => Boolean(option.value));

        setLocationOptions(options);

        setLocationLabelById((prev) => {
          const next = { ...prev };
          options.forEach((option) => {
            next[option.value] = option.label;
          });
          return next;
        });
      } catch {
        if (alive) setLocationOptions([]);
      } finally {
        if (alive) setLocationsLoading(false);
      }
    }

    void loadLocations();

    return () => {
      alive = false;
    };
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !branchId) return;

    const ids = [clean(form.fromLocationId), clean(form.toLocationId)].filter(
      Boolean
    );

    ids.forEach((id) => {
      if (locationLabelById[id]) return;
      if (fetchedLocationRef.current.has(id)) return;

      const api = stockLocationsApi as any;

      if (typeof api.getById !== "function") {
        fetchedLocationRef.current.add(id);
        setLocationLabelById((prev) => ({
          ...prev,
          [id]: "Saved location",
        }));
        return;
      }

      fetchedLocationRef.current.add(id);

      api
        .getById(companyId, branchId, id)
        .then((location: any) => {
          setLocationLabelById((prev) => ({
            ...prev,
            [id]:
              clean(location?.name) ||
              clean(location?.code) ||
              "Saved location",
          }));
        })
        .catch(() => {
          setLocationLabelById((prev) => ({
            ...prev,
            [id]: "Saved location",
          }));
        });
    });
  }, [
    companyId,
    branchId,
    form.fromLocationId,
    form.toLocationId,
    locationLabelById,
  ]);

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      return;
    }

    let alive = true;

    async function loadItems() {
      setItemsLoading(true);

      try {
        const result = await inventoryItemsApi.list(companyId!);
        const rows: InventoryItemDto[] = Array.isArray(result) ? result : result ?? [];
        const viewModels = rows.map(toItemVm).filter((item) => Boolean(item.id));

        if (!alive) return;

        setItems(viewModels);

        setItemLabelById((prev) => {
          const next = { ...prev };
          viewModels.forEach((item) => {
            next[item.id] = item.label;
          });
          return next;
        });

        setUomLabelById((prev) => {
          const next = { ...prev };
          viewModels.forEach((item) => {
            item.uoms.forEach((uom) => {
              next[uom.uomId] = uom.uomName;
            });
          });
          return next;
        });
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setItemsLoading(false);
      }
    }

    void loadItems();

    return () => {
      alive = false;
    };
  }, [companyId]);

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
      const id = await stockTransfersApi.create(companyId, branchId, payload);
      go(paths.edit(id));
    } catch (error: any) {
      setPageState({
        status: "error",
        message: getErrorMessage(error),
      });
    }
  }, [companyId, branchId, paths, form, go]);

  if (!companyId) {
    return <div style={{ padding: 16 }}>Select a company first.</div>;
  }

  if (!branchId) {
    return <div style={{ padding: 16 }}>Select a branch first.</div>;
  }

  if (!paths) {
    return <div style={{ padding: 16 }}>Company path could not be resolved.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader submitError={submitError} />

      <SummaryCard
        lines={summary.lines}
        totalQuantity={summary.totalQuantity}
        distinctItems={summary.distinctItems}
      />

      <HeaderCard
        form={form}
        errors={errors}
        busy={busy}
        locationsLoading={locationsLoading}
        locationOptions={locationOptions}
        locationLabelById={locationLabelById}
        onChange={setHeader}
      />

      <LinesCard
        form={form}
        errors={errors}
        busy={busy}
        itemsLoading={itemsLoading}
        itemById={itemById}
        itemOptions={itemOptions}
        itemLabelById={itemLabelById}
        uomLabelById={uomLabelById}
        onAddLine={addLine}
        onRemoveLine={removeLine}
        onUpdateLine={updateLine}
      />

      <FooterActions
        busy={busy}
        onBack={() => go(paths.list)}
        onSubmit={() => void submit()}
      />
    </div>
  );
}

function PageHeader({ submitError }: { submitError: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          Create Stock Transfer
        </div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Transfer stock between branch locations with controlled line items.
        </div>

        {submitError ? (
          <div style={{ marginTop: 10, ...errorStyle }}>{submitError}</div>
        ) : null}
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
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
  locationsLoading,
  locationOptions,
  locationLabelById,
  onChange,
}: {
  form: TransferDraft;
  errors: FieldErrors;
  busy: boolean;
  locationsLoading: boolean;
  locationOptions: SelectOption[];
  locationLabelById: Record<string, string>;
  onChange: (patch: Partial<TransferDraft>) => void;
}) {
  const fromId = clean(form.fromLocationId);
  const toId = clean(form.toLocationId);

  const fromExists = fromId
    ? locationOptions.some((option) => option.value === fromId)
    : false;

  const toExists = toId
    ? locationOptions.some((option) => option.value === toId)
    : false;

  const fromLabel = locationLabelById[fromId] || "Saved location";
  const toLabel = locationLabelById[toId] || "Saved location";

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 12,
        }}
      >
        <div style={{ gridColumn: "span 4" }}>
          <label style={labelStyle}>From Location *</label>
          <select
            style={inputStyle(Boolean(errors.fromLocationId))}
            value={fromId}
            disabled={locationsLoading || busy}
            onChange={(event) => {
              const value = event.target.value;

              onChange({
                fromLocationId: value,
                toLocationId: value === toId ? "" : form.toLocationId,
              });
            }}
          >
            {!fromId ? (
              <option value="">
                {locationsLoading ? "Loading locations..." : "Select from location…"}
              </option>
            ) : null}

            {!fromExists && fromId ? (
              <option value={fromId}>{fromLabel}</option>
            ) : null}

            {locationOptions
              .filter((option) => option.value !== toId)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>

          {errors.fromLocationId ? (
            <div style={errorStyle}>{errors.fromLocationId}</div>
          ) : null}
        </div>

        <div style={{ gridColumn: "span 4" }}>
          <label style={labelStyle}>To Location *</label>
          <select
            style={inputStyle(Boolean(errors.toLocationId))}
            value={toId}
            disabled={locationsLoading || busy}
            onChange={(event) => {
              const value = event.target.value;

              onChange({
                toLocationId: value,
                fromLocationId: value === fromId ? "" : form.fromLocationId,
              });
            }}
          >
            {!toId ? (
              <option value="">
                {locationsLoading ? "Loading locations..." : "Select to location…"}
              </option>
            ) : null}

            {!toExists && toId ? <option value={toId}>{toLabel}</option> : null}

            {locationOptions
              .filter((option) => option.value !== fromId)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>

          {errors.toLocationId ? (
            <div style={errorStyle}>{errors.toLocationId}</div>
          ) : null}
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

          {errors.transferDate ? (
            <div style={errorStyle}>{errors.transferDate}</div>
          ) : null}
        </div>

        <div style={{ gridColumn: "span 12" }}>
          <label style={labelStyle}>Notes</label>
          <input
            style={inputStyle(false)}
            value={form.notes}
            disabled={busy}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="Optional transfer notes…"
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
  itemsLoading,
  itemById,
  itemOptions,
  itemLabelById,
  uomLabelById,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
}: {
  form: TransferDraft;
  errors: FieldErrors;
  busy: boolean;
  itemsLoading: boolean;
  itemById: Map<string, ItemVm>;
  itemOptions: SelectOption[];
  itemLabelById: Record<string, string>;
  uomLabelById: Record<string, string>;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onUpdateLine: (index: number, patch: Partial<TransferLineDraft>) => void;
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
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

      {errors.lines ? (
        <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div>
      ) : null}

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
                  itemsLoading={itemsLoading}
                  itemById={itemById}
                  itemOptions={itemOptions}
                  itemLabelById={itemLabelById}
                  uomLabelById={uomLabelById}
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
  itemsLoading,
  itemById,
  itemOptions,
  itemLabelById,
  uomLabelById,
  onRemove,
  onUpdate,
}: {
  line: TransferLineDraft;
  index: number;
  lineError: Partial<Record<keyof TransferLineDraft, string>>;
  busy: boolean;
  itemsLoading: boolean;
  itemById: Map<string, ItemVm>;
  itemOptions: SelectOption[];
  itemLabelById: Record<string, string>;
  uomLabelById: Record<string, string>;
  onRemove: () => void;
  onUpdate: (patch: Partial<TransferLineDraft>) => void;
}) {
  const itemId = clean(line.itemId);
  const unitId = clean(line.unitId);

  const selectedItem = itemId ? itemById.get(itemId) : undefined;

  const uomOptions: SelectOption[] =
    selectedItem?.uoms.map((uom) => ({
      value: uom.uomId,
      label: uom.uomName,
    })) ?? [];

  const itemExists = itemId ? itemById.has(itemId) : false;
  const uomExists = unitId
    ? uomOptions.some((option) => option.value === unitId)
    : false;

  const savedItemLabel = itemLabelById[itemId] || (itemId ? "Saved item" : "");
  const savedUomLabel = uomLabelById[unitId] || (unitId ? "Saved unit" : "");

  return (
    <tr>
      <td style={tdStyle}>{index + 1}</td>

      <td style={tdStyle}>
        <select
          style={inputStyle(Boolean(lineError.itemId))}
          value={itemId}
          disabled={itemsLoading || busy}
          onChange={(event) => {
            const selectedItemId = event.target.value;
            const item = selectedItemId ? itemById.get(selectedItemId) : undefined;

            onUpdate({
              itemId: selectedItemId,
              unitId: item?.defaultUomId ?? "",
            });
          }}
        >
          {!itemId ? (
            <option value="">
              {itemsLoading ? "Loading items..." : "Select item…"}
            </option>
          ) : null}

          {!itemExists && itemId ? (
            <option value={itemId}>{savedItemLabel}</option>
          ) : null}

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
          onChange={(event) =>
            onUpdate({
              quantity: Number(event.target.value),
            })
          }
        />

        {lineError.quantity ? (
          <div style={errorStyle}>{lineError.quantity}</div>
        ) : null}
      </td>

      <td style={tdStyle}>
        <select
          style={inputStyle(Boolean(lineError.unitId))}
          value={unitId}
          disabled={!itemId || busy}
          onChange={(event) =>
            onUpdate({
              unitId: event.target.value,
            })
          }
        >
          {!unitId ? (
            <option value="">
              {!itemId
                ? "Select item first…"
                : uomOptions.length === 0
                ? "No UOM configured"
                : "Select unit…"}
            </option>
          ) : null}

          {!uomExists && unitId ? (
            <option value={unitId}>{savedUomLabel}</option>
          ) : null}

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
          onChange={(event) =>
            onUpdate({
              notes: event.target.value,
            })
          }
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
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(0,0,0,.03)",
        border: "1px solid rgba(0,0,0,.08)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}