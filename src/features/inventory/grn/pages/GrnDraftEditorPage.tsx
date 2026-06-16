import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi, type GrnScope } from "../api/grnApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";
import type { InventoryItemDto } from "../../../inventoryMaster/items/types";
import type { CreateGrnDraftRequest, GrnDetailDto } from "../types/grn.types";
import {
  PageHeader,
  SectionHead,
  InlineAlert,
  cardStyle,
  dangerBtn,
  errorInline,
  inputStyle,
  labelStyle,
  pageWrap,
  primaryBtn,
  secondaryBtn,
  stickyBar,
  tableStyle,
  tableWrap,
  tdStyle,
  thStyle,
  tokens,
} from "../components/grn.ui";

type Option = {
  value: string;
  label: string;
};

type GrnLineForm = {
  itemId: string;
  uomId: string;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
  notes: string;
};

type GrnForm = {
  id?: string;
  receivingLocationId: string;
  receivedDate: string;
  supplierName: string;
  notes: string;
  lines: GrnLineForm[];
};

type ItemVm = {
  id: string;
  label: string;
  uoms: Option[];
  defaultUomId: string;
};

type UomCatalog = Map<string, { code: string; name: string }>;

type LineErrors = Partial<Record<keyof GrnLineForm, string>>;

type FormErrors = Partial<
  Record<"receivingLocationId" | "receivedDate" | "lines", string>
> & {
  lineErrors?: Record<number, LineErrors>;
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  gap: 14,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle(false),
  minHeight: 72,
  resize: "vertical",
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nullable(value: string): string | null {
  const cleaned = clean(value);
  return cleaned.length ? cleaned : null;
}

function emptyLine(): GrnLineForm {
  return {
    itemId: "",
    uomId: "",
    quantity: "1",
    unitCost: "0",
    batchNo: "",
    expiryDate: "",
    notes: "",
  };
}

function parseDecimal(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isPositive(value: unknown): boolean {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isNonNegative(value: unknown): boolean {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function money(value: unknown): string {
  const parsed = parseDecimal(value);
  const safe = Number.isFinite(parsed) ? parsed : 0;

  return safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateOnly(value: unknown): string {
  const raw = clean(value);
  return raw ? raw.slice(0, 10) : today();
}

function dateToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Invalid date.");
  }

  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function unwrapArray<T>(value: unknown): T[] {
  const envelope = value as {
    data?: unknown;
    items?: unknown;
    result?: unknown;
  };

  const raw = envelope?.data ?? envelope?.items ?? envelope?.result ?? value;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function isActive(row: Record<string, unknown>): boolean {
  return row.isActive === true || row.isActive === undefined || row.isActive === null;
}

function isReceivingLocation(row: Record<string, unknown>): boolean {
  const type = clean(row.locationType ?? row.type ?? row.stockLocationType).toLowerCase();

  if (!type) return true;

  return [
    "warehouse",
    "mainwarehouse",
    "main warehouse",
    "storage",
    "store",
    "receiving",
    "receivinglocation",
    "receiving location",
  ].includes(type);
}

function locationLabel(row: Record<string, unknown>): string {
  const name = clean(row.name) || "Location";
  const code = clean(row.code);
  const type = clean(row.locationType ?? row.type ?? row.stockLocationType);

  return [name, code ? `(${code})` : "", type ? `— ${type}` : ""]
    .filter(Boolean)
    .join(" ");
}

function uomLabel(uomId: string, catalog: UomCatalog): string {
  const uom = catalog.get(uomId);
  if (!uom) return uomId;

  return uom.code ? `${uom.code} — ${uom.name}` : uom.name;
}

function uniqueOptions(options: Option[]): Option[] {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function itemToVm(dto: InventoryItemDto, catalog: UomCatalog): ItemVm {
  const allowed = dto.allowedUoms ?? [];

  let uoms = uniqueOptions(
    allowed
      .filter((u) => Boolean(u.uomId))
      .map((u) => ({
        value: u.uomId,
        label: uomLabel(u.uomId, catalog),
      })),
  );

  if (!uoms.length) {
    uoms = uniqueOptions(
      [
        dto.baseUomId
          ? {
              value: dto.baseUomId,
              label: uomLabel(dto.baseUomId, catalog),
            }
          : null,
        dto.issueUomId && dto.issueUomId !== dto.baseUomId
          ? {
              value: dto.issueUomId,
              label: uomLabel(dto.issueUomId, catalog),
            }
          : null,
      ].filter(Boolean) as Option[],
    );
  }

  const purchaseUom = allowed.find((u) => u.isPurchase);
  const baseUom = dto.baseUomId
    ? allowed.find((u) => u.uomId === dto.baseUomId)
    : undefined;
  const issueUom = allowed.find((u) => u.isIssue);

  const defaultUomId =
    purchaseUom?.uomId ??
    baseUom?.uomId ??
    dto.baseUomId ??
    issueUom?.uomId ??
    uoms[0]?.value ??
    "";

  return {
    id: dto.id,
    label: dto.sku ? `${dto.sku} — ${dto.name}` : dto.name || dto.id,
    uoms,
    defaultUomId,
  };
}

function extractError(error: unknown, fallback = "An unexpected error occurred."): string {
  const e = error as {
    response?: {
      data?: {
        detail?: string;
        title?: string;
        message?: string;
        error?: string;
        errors?: Record<string, string[]>;
      };
    };
    message?: string;
  };

  const validationErrors = e?.response?.data?.errors;

  if (validationErrors) {
    const first = Object.values(validationErrors).flat().find(Boolean);
    if (first) return first;
  }

  return (
    e?.response?.data?.detail ??
    e?.response?.data?.title ??
    e?.response?.data?.message ??
    e?.response?.data?.error ??
    e?.message ??
    fallback
  );
}

function grnBasePath(companyId: string, branchId?: string | null): string {
  const company = encodeURIComponent(companyId);

  if (branchId) {
    return `/companies/${company}/branches/${encodeURIComponent(branchId)}/grns`;
  }

  return `/companies/${company}/grns`;
}

function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  hasError,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
}) {
  return (
    <select
      style={inputStyle(hasError)}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>

      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function GrnDraftEditorPage() {
  const navigate = useNavigate();
  const { draftId } = useParams<{ draftId?: string }>();
  const { companyId, branchId } = useAppScope();

  const itemDetailCache = useRef<Map<string, InventoryItemDto>>(new Map());

  const grnScope = useMemo<GrnScope | null>(
    () =>
      companyId
        ? {
            companyId,
            branchId,
          }
        : null,
    [companyId, branchId],
  );

  const basePath = useMemo(
    () => (companyId ? grnBasePath(companyId, branchId) : "/"),
    [companyId, branchId],
  );

  const [form, setForm] = useState<GrnForm>({
    receivingLocationId: "",
    receivedDate: today(),
    supplierName: "",
    notes: "",
    lines: [emptyLine()],
  });

  const [locations, setLocations] = useState<Option[]>([]);
  const [items, setItems] = useState<ItemVm[]>([]);
  const [uomCatalog, setUomCatalog] = useState<UomCatalog>(new Map());

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const busy = saving || posting;

  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      return;
    }

    let alive = true;

    setLoadingLocations(true);

    stockLocationsApi
      .list(companyId)
      .then((response) => {
        if (!alive) return;

        const options = unwrapArray<Record<string, unknown>>(response)
          .filter((row) => isActive(row) && isReceivingLocation(row))
          .map((row) => ({
            value: clean(row.id),
            label: locationLabel(row),
          }))
          .filter((x) => Boolean(x.value));

        setLocations(options);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setLocations([]);
        setSubmitError(extractError(error, "Failed to load receiving locations."));
      })
      .finally(() => {
        if (alive) setLoadingLocations(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      setUomCatalog(new Map());
      itemDetailCache.current.clear();
      return;
    }

    let alive = true;

    setLoadingItems(true);

    Promise.all([
      inventoryItemsApi.list(companyId),
      inventoryItemsApi.getUoms(companyId),
    ])
      .then(([itemsResponse, uomsResponse]) => {
        if (!alive) return;

        const catalog = new Map(
          (uomsResponse ?? []).map((u) => [
            u.id,
            {
              code: u.code ?? u.symbol ?? "",
              name: u.name,
            },
          ]),
        );

        setUomCatalog(catalog);

        setItems(
          unwrapArray<InventoryItemDto>(itemsResponse).map((dto) =>
            itemToVm(dto, catalog),
          ),
        );
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setItems([]);
        setSubmitError(extractError(error, "Failed to load inventory items."));
      })
      .finally(() => {
        if (alive) setLoadingItems(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!grnScope || !draftId) return;

    let alive = true;

    setLoadingDraft(true);

    grnApi
      .getById(grnScope, draftId)
      .then((dto: GrnDetailDto) => {
        if (!alive) return;

        const d = dto as GrnDetailDto & {
          warehouseId?: string | null;
          locationId?: string | null;
          receivedAt?: string | null;
          receiptDate?: string | null;
          receivedAtUtc?: string | null;
          lines?: Array<Record<string, unknown>>;
        };

        const lines = Array.isArray(d.lines)
          ? d.lines.map((line) => ({
              itemId: clean(line.itemId),
              uomId: clean(line.uomId),
              quantity: String(line.quantity ?? 1),
              unitCost: String(line.unitCost ?? 0),
              batchNo: clean(line.batchNo),
              expiryDate: clean(line.expiryDate ?? line.expiryDateUtc).slice(0, 10),
              notes: clean(line.notes),
            }))
          : [];

        setForm({
          id: clean(d.id),
          receivingLocationId: clean(
            d.receivingLocationId ?? d.locationId ?? d.warehouseId,
          ),
          receivedDate: dateOnly(
            d.receivedDate ?? d.receivedAt ?? d.receiptDate ?? d.receivedAtUtc,
          ),
          supplierName: clean(d.supplierName),
          notes: clean(d.notes),
          lines: lines.length ? lines : [emptyLine()],
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setSubmitError(extractError(error, "Failed to load GRN draft."));
      })
      .finally(() => {
        if (alive) setLoadingDraft(false);
      });

    return () => {
      alive = false;
    };
  }, [grnScope, draftId]);

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const itemOptions = useMemo(
    () => items.map((item) => ({ value: item.id, label: item.label })),
    [items],
  );

  const subtotal = useMemo(
    () =>
      form.lines.reduce((sum, line) => {
        const qty = parseDecimal(line.quantity);
        const cost = parseDecimal(line.unitCost);

        if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;

        return sum + qty * cost;
      }, 0),
    [form.lines],
  );

  function patch(value: Partial<GrnForm>) {
    setForm((current) => ({ ...current, ...value }));
    setSuccessMsg(null);
  }

  function patchLine(index: number, value: Partial<GrnLineForm>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...value } : line,
      ),
    }));
    setSuccessMsg(null);
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, emptyLine()],
    }));
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      lines:
        current.lines.length <= 1
          ? [emptyLine()]
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};
    const lineErrors: NonNullable<FormErrors["lineErrors"]> = {};

    if (!clean(form.receivingLocationId)) {
      nextErrors.receivingLocationId = "Receiving location is required.";
    }

    if (!clean(form.receivedDate)) {
      nextErrors.receivedDate = "Received date is required.";
    }

    if (!form.lines.length) {
      nextErrors.lines = "At least one line is required.";
    }

    form.lines.forEach((line, index) => {
      const lineError: LineErrors = {};

      if (!clean(line.itemId)) lineError.itemId = "Item is required.";
      if (!clean(line.uomId)) lineError.uomId = "UOM is required.";

      if (!isPositive(line.quantity)) {
        lineError.quantity = "Quantity must be greater than zero.";
      }

      if (!isNonNegative(line.unitCost)) {
        lineError.unitCost = "Unit cost cannot be negative.";
      }

      if (Object.keys(lineError).length) {
        lineErrors[index] = lineError;
      }
    });

    if (Object.keys(lineErrors).length) {
      nextErrors.lineErrors = lineErrors;
    }

    return nextErrors;
  }

  function hasErrors(value: FormErrors): boolean {
    return Boolean(
      value.receivingLocationId ||
        value.receivedDate ||
        value.lines ||
        Object.keys(value.lineErrors ?? {}).length,
    );
  }

  function buildPayload(): CreateGrnDraftRequest {
    return {
      receivingLocationId: clean(form.receivingLocationId),
      receivedDate: dateToIso(form.receivedDate),
      supplierName: clean(form.supplierName),
      notes: nullable(form.notes),
      lines: form.lines.map((line) => ({
        itemId: clean(line.itemId),
        uomId: clean(line.uomId),
        quantity: parseDecimal(line.quantity),
        unitCost: parseDecimal(line.unitCost),
        batchNo: nullable(line.batchNo),
        expiryDate: line.expiryDate ? dateToIso(line.expiryDate) : null,
        notes: nullable(line.notes),
      })),
    };
  }

  async function save() {
    setSubmitError(null);
    setSuccessMsg(null);

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (hasErrors(nextErrors) || !grnScope) return;

    setSaving(true);

    try {
      const payload = buildPayload();

      const result = form.id
        ? await grnApi.updateDraft(grnScope, form.id, payload)
        : await grnApi.createDraft(grnScope, payload);

      const id = clean(result.id ?? result.draftId ?? result.grnId);

      if (!id) {
        throw new Error("Draft was saved, but the server did not return a draft ID.");
      }

      setForm((current) => ({ ...current, id }));
      setSuccessMsg("GRN draft saved.");

      if (!form.id) {
        navigate(`${basePath}/drafts/${encodeURIComponent(id)}`, { replace: true });
      }
    } catch (error: unknown) {
      setSubmitError(extractError(error, "Failed to save GRN draft."));
    } finally {
      setSaving(false);
    }
  }

  async function post() {
    setSubmitError(null);
    setSuccessMsg(null);

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (hasErrors(nextErrors) || !grnScope) return;

    setPosting(true);

    try {
      const payload = buildPayload();

      const result = form.id
        ? await grnApi.updateDraft(grnScope, form.id, payload)
        : await grnApi.createDraft(grnScope, payload);

      const draftIdToPost = form.id || clean(result.id ?? result.draftId ?? result.grnId);

      if (!draftIdToPost) {
        throw new Error("Could not obtain draft ID.");
      }

      const posted = await grnApi.postDraft(grnScope, draftIdToPost);
      const postedId = clean(posted?.id ?? posted?.grnId) || draftIdToPost;

      navigate(`${basePath}/${encodeURIComponent(postedId)}`);
    } catch (error: unknown) {
      setSubmitError(extractError(error, "Failed to post GRN."));
    } finally {
      setPosting(false);
    }
  }

  async function fetchItemDetail(itemId: string, lineIndex: number) {
    if (!companyId || !itemId) {
      patchLine(lineIndex, { itemId: "", uomId: "" });
      return;
    }

    const existing = itemMap.get(itemId);

    if (existing) {
      patchLine(lineIndex, {
        itemId,
        uomId: existing.defaultUomId || existing.uoms[0]?.value || "",
      });
    } else {
      patchLine(lineIndex, { itemId, uomId: "" });
    }

    const cached = itemDetailCache.current.get(itemId);

    if (cached) {
      const vm = itemToVm(cached, uomCatalog);

      setItems((current) =>
        current.some((item) => item.id === itemId)
          ? current.map((item) => (item.id === itemId ? vm : item))
          : [...current, vm],
      );

      patchLine(lineIndex, {
        itemId,
        uomId: vm.defaultUomId || vm.uoms[0]?.value || "",
      });

      return;
    }

    try {
      const detail = await inventoryItemsApi.get(companyId, itemId);
      itemDetailCache.current.set(itemId, detail);

      const vm = itemToVm(detail, uomCatalog);

      setItems((current) =>
        current.some((item) => item.id === itemId)
          ? current.map((item) => (item.id === itemId ? vm : item))
          : [...current, vm],
      );

      patchLine(lineIndex, {
        itemId,
        uomId: vm.defaultUomId || vm.uoms[0]?.value || "",
      });
    } catch (error: unknown) {
      setSubmitError(extractError(error, "Failed to load item UOM details."));
    }
  }

  if (!companyId) {
    return (
      <div style={pageWrap}>
        <InlineAlert type="warning" message="Select a company to continue." />
      </div>
    );
  }

  const locationPlaceholder = loadingLocations
    ? "Loading locations…"
    : locations.length
      ? "Select receiving location"
      : "No active receiving locations found";

  const itemPlaceholder = loadingItems ? "Loading items…" : "Select item";

  return (
    <div style={pageWrap}>
      <PageHeader
        title={draftId ? "Edit GRN Draft" : "New GRN"}
        subtitle="Receive goods into an approved stock location. Save as draft or post to inventory after review."
        errorMsg={submitError}
        successMsg={successMsg}
        rightSlot={
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: tokens.colorMuted }}>Document Total</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: tokens.colorPrimary }}>
              ${money(subtotal)}
            </div>
          </div>
        }
      />

      {loadingDraft && (
        <div style={cardStyle}>
          <InlineAlert type="info" message="Loading GRN draft…" />
        </div>
      )}

      <div style={cardStyle}>
        <div style={formGrid}>
          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Receiving Location *</label>
            <Select
              value={form.receivingLocationId}
              options={locations}
              disabled={busy || loadingLocations || locations.length === 0}
              placeholder={locationPlaceholder}
              hasError={Boolean(errors.receivingLocationId)}
              onChange={(value) => patch({ receivingLocationId: value })}
            />
            {errors.receivingLocationId && (
              <div style={errorInline}>{errors.receivingLocationId}</div>
            )}
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Received Date *</label>
            <input
              style={inputStyle(Boolean(errors.receivedDate))}
              type="date"
              disabled={busy}
              value={form.receivedDate}
              onChange={(event) => patch({ receivedDate: event.target.value })}
            />
            {errors.receivedDate && <div style={errorInline}>{errors.receivedDate}</div>}
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label style={labelStyle}>Supplier</label>
            <input
              style={inputStyle(false)}
              disabled={busy}
              value={form.supplierName}
              onChange={(event) => patch({ supplierName: event.target.value })}
              placeholder="Supplier name"
            />
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={textareaStyle}
              disabled={busy}
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Receiving notes"
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <SectionHead
          title="Line Items"
          subtitle="Use purchase/receiving UOM where available. Quantity and cost are validated before save/post."
          action={
            <button type="button" style={primaryBtn} disabled={busy} onClick={addLine}>
              + Add Line
            </button>
          }
        />

        {errors.lines && <div style={errorInline}>{errors.lines}</div>}

        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item *</th>
                <th style={thStyle}>Qty *</th>
                <th style={thStyle}>UOM *</th>
                <th style={thStyle}>Unit Cost</th>
                <th style={thStyle}>Batch</th>
                <th style={thStyle}>Expiry</th>
                <th style={thStyle}>Notes</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                <th style={thStyle} />
              </tr>
            </thead>

            <tbody>
              {form.lines.map((line, index) => {
                const lineError = errors.lineErrors?.[index] ?? {};
                const item = itemMap.get(line.itemId);
                const qty = parseDecimal(line.quantity);
                const cost = parseDecimal(line.unitCost);
                const total =
                  Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0;

                return (
                  <tr key={index}>
                    <td style={tdStyle}>
                      <Select
                        value={line.itemId}
                        options={itemOptions}
                        disabled={busy || loadingItems}
                        placeholder={itemPlaceholder}
                        hasError={Boolean(lineError.itemId)}
                        onChange={(value) => {
                          void fetchItemDetail(value, index);
                        }}
                      />
                      {lineError.itemId && <div style={errorInline}>{lineError.itemId}</div>}
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={inputStyle(Boolean(lineError.quantity))}
                        type="number"
                        min="0"
                        step="0.001"
                        disabled={busy}
                        value={line.quantity}
                        onChange={(event) =>
                          patchLine(index, { quantity: event.target.value })
                        }
                      />
                      {lineError.quantity && (
                        <div style={errorInline}>{lineError.quantity}</div>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <Select
                        value={line.uomId}
                        options={item?.uoms ?? []}
                        disabled={busy || !line.itemId}
                        placeholder={line.itemId ? "Select UOM" : "Select item first"}
                        hasError={Boolean(lineError.uomId)}
                        onChange={(value) => patchLine(index, { uomId: value })}
                      />
                      {lineError.uomId && <div style={errorInline}>{lineError.uomId}</div>}
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={inputStyle(Boolean(lineError.unitCost))}
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={busy}
                        value={line.unitCost}
                        onChange={(event) =>
                          patchLine(index, { unitCost: event.target.value })
                        }
                      />
                      {lineError.unitCost && (
                        <div style={errorInline}>{lineError.unitCost}</div>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={inputStyle(false)}
                        disabled={busy}
                        value={line.batchNo}
                        onChange={(event) =>
                          patchLine(index, { batchNo: event.target.value })
                        }
                        placeholder="Optional"
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={inputStyle(false)}
                        type="date"
                        disabled={busy}
                        value={line.expiryDate}
                        onChange={(event) =>
                          patchLine(index, { expiryDate: event.target.value })
                        }
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        style={inputStyle(false)}
                        disabled={busy}
                        value={line.notes}
                        onChange={(event) =>
                          patchLine(index, { notes: event.target.value })
                        }
                        placeholder="Optional"
                      />
                    </td>

                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>
                      ${money(total)}
                    </td>

                    <td style={tdStyle}>
                      <button
                        type="button"
                        style={dangerBtn}
                        disabled={busy}
                        onClick={() => removeLine(index)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={stickyBar}>
        <span style={{ color: tokens.colorMuted, fontSize: 13 }}>
          {form.id ? `Draft saved: ${form.id}` : "Unsaved draft"}
        </span>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={secondaryBtn}
            disabled={busy}
            onClick={() => navigate(basePath)}
          >
            Cancel
          </button>

          <button
            type="button"
            style={secondaryBtn}
            disabled={busy}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save Draft"}
          </button>

          <button
            type="button"
            style={primaryBtn}
            disabled={busy}
            onClick={() => void post()}
          >
            {posting ? "Posting…" : "Post GRN"}
          </button>
        </div>
      </div>
    </div>
  );
}