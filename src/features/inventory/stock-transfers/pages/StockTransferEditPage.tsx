// StockTransferEditPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { http } from "../../../../api/http";
import { useAppScope } from "../../../../app/useAppScope";
import { stockTransfersApi } from "../api/stockTransfersApi";
import type { ItemLookupDto, UomLookupDto } from "../api/stockTransfersApi";
import {
  STOCK_TRANSFER_STATUS,
  type StockLocationDto,
  type StockTransferDetailDto,
  type StockTransferStatus,
} from "../types";

type SelectOption<T> = { value: T; label: string };

type MsgTone = "success" | "error" | "info" | "warn";
type Msg = { tone: MsgTone; text: string } | null;

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

type ActionKind = "submit" | "cancel" | "post";

type TransferPaths = {
  list: string;
  detail: (id: string) => string;
  edit: (id: string) => string;
};

type FormLine = {
  id: string;
  inventoryItemId: string;
  unitId: string;
  qty: number;
  note: string;
  _itemCode?: string;
  _itemName?: string;
  _uomText?: string;
};

type FormState = {
  fromLocationId: string;
  toLocationId: string;
  transferDate: string;
  reference: string;
  lines: FormLine[];
};

type FieldErrors = {
  fromLocationId?: string;
  toLocationId?: string;
  transferDate?: string;
  lines?: string;
  lineErrors?: Record<number, Partial<Record<keyof FormLine, string>>>;
};

const clean = (value: unknown): string => String(value ?? "").trim();
const norm = (value: unknown): string => clean(value).toLowerCase();
const newKey = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function isoToDateOnly(value: string | null | undefined): string {
  const cleanValue = clean(value);
  if (!cleanValue) return "";
  return cleanValue.includes("T") ? cleanValue.slice(0, 10) : cleanValue;
}

function dateOnlyToUtcIso(dateOnly: string): string | null {
  if (!dateOnly) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function apiErr(error: unknown): string {
  const err = error as any;
  const data = err?.response?.data;

  if (typeof data === "string") return data;

  return (
    data?.message ??
    data?.title ??
    data?.detail ??
    err?.message ??
    "Request failed"
  );
}

const STATUS_VALUES = new Set<StockTransferStatus>(
  Object.values(STOCK_TRANSFER_STATUS)
);

function normalizeStatus(raw: unknown): StockTransferStatus {
  if (STATUS_VALUES.has(raw as StockTransferStatus)) {
    return raw as StockTransferStatus;
  }

  const value = norm(raw);

  if (value === "draft") return STOCK_TRANSFER_STATUS.Draft;
  if (value === "submitted") return STOCK_TRANSFER_STATUS.Submitted;
  if (value === "approved") return STOCK_TRANSFER_STATUS.Approved;
  if (value === "rejected") return STOCK_TRANSFER_STATUS.Rejected;
  if (value === "posted") return STOCK_TRANSFER_STATUS.Posted;
  if (value === "reversed") return STOCK_TRANSFER_STATUS.Reversed;
  if (value === "cancelled" || value === "canceled") {
    return STOCK_TRANSFER_STATUS.Cancelled;
  }

  return STOCK_TRANSFER_STATUS.Draft;
}

function canEdit(status: StockTransferStatus) {
  return (
    status === STOCK_TRANSFER_STATUS.Draft ||
    status === STOCK_TRANSFER_STATUS.Rejected
  );
}

function canSubmit(status: StockTransferStatus) {
  return canEdit(status);
}

function canCancel(status: StockTransferStatus) {
  return (
    status === STOCK_TRANSFER_STATUS.Draft ||
    status === STOCK_TRANSFER_STATUS.Submitted ||
    status === STOCK_TRANSFER_STATUS.Approved
  );
}

function canPost(status: StockTransferStatus) {
  return status === STOCK_TRANSFER_STATUS.Approved;
}

async function listLocations(
  companyId: string,
  branchId: string,
  signal?: AbortSignal
): Promise<StockLocationDto[]> {
  const response = await http.get(
    `/companies/${companyId}/branches/${branchId}/stock-locations`,
    { signal }
  );

  const data = response.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

export default function StockTransferEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { companyId, branchId } = useAppScope();

  const [detail, setDetail] = useState<StockTransferDetailDto | null>(null);
  const [locations, setLocations] = useState<StockLocationDto[]>([]);
  const [items, setItems] = useState<ItemLookupDto[]>([]);
  const [uoms, setUoms] = useState<UomLookupDto[]>([]);

  const itemsRef = useRef<ItemLookupDto[]>([]);
  const uomsRef = useRef<UomLookupDto[]>([]);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const [form, setForm] = useState<FormState>({
    fromLocationId: "",
    toLocationId: "",
    transferDate: "",
    reference: "",
    lines: [],
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<ActionKind | null>(null);
  const [needsRemap, setNeedsRemap] = useState(false);

  const status = useMemo(() => normalizeStatus(detail?.status), [detail]);
  const editable = canEdit(status);
  const loading = pageState.status === "loading";
  const busy = loading || saving || acting !== null;

  const paths = useMemo<TransferPaths | null>(() => {
    if (!companyId) return null;

    const base = `/companies/${companyId}/inventory/stock-transfers`;

    return {
      list: base,
      detail: (transferId: string) => `${base}/${transferId}`,
      edit: (transferId: string) => `${base}/${transferId}/edit`,
    };
  }, [companyId]);

  const go = useCallback(
    (path: string, replace = false) => {
      navigate(path, { replace });
    },
    [navigate]
  );

  const locationOptions = useMemo<SelectOption<string>[]>(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: clean(location.name) || clean(location.code) || "Location",
      })),
    [locations]
  );

  const itemOptions = useMemo<SelectOption<string>[]>(
    () =>
      itemsRef.current
        .filter((item) => clean(item.id))
        .map((item) => ({
          value: String(item.id),
          label:
            clean(item.label) ||
            `${clean(item.sku) || clean(item.code)} ${clean(item.name)}`.trim() ||
            clean(item.name) ||
            "Item",
        })),
    [items]
  );

  const uomOptionsAll = useMemo<SelectOption<string>[]>(
    () =>
      uomsRef.current
        .filter((uom) => clean(uom.id))
        .map((uom) => ({
          value: String(uom.id),
          label: clean(uom.name) || clean(uom.code) || "UOM",
        })),
    [uoms]
  );

  const itemById = useMemo(() => {
    return new Map(itemsRef.current.map((item) => [String(item.id), item]));
  }, [items]);

  const totals = useMemo(() => {
    if (!editable && detail) {
      return {
        qty: Number(detail.totalQuantity ?? 0) || 0,
        lines: detail.items?.length ?? 0,
      };
    }

    return {
      qty: form.lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0),
      lines: form.lines.length,
    };
  }, [editable, detail, form.lines]);

  const uomOptionsForLine = useCallback(
    (inventoryItemId: string): SelectOption<string>[] => {
      const item = inventoryItemId ? itemById.get(inventoryItemId) : undefined;

      const allowed = ((item as any)?.uoms ?? [])
        .map((uom: any) => String(uom.uomId))
        .filter(Boolean) as string[];

      if (allowed.length > 0) {
        const allowedSet = new Set(allowed);

        return uomsRef.current
          .filter((uom) => allowedSet.has(String(uom.id)))
          .map((uom) => ({
            value: String(uom.id),
            label: clean(uom.name) || clean(uom.code) || "UOM",
          }));
      }

      return uomOptionsAll;
    },
    [itemById, uomOptionsAll]
  );

  const loadAll = useCallback(async () => {
    if (!companyId || !branchId || !id) return;

    const requestId = ++requestIdRef.current;

    setPageState({ status: "loading" });
    setMsg(null);

    try {
      const [detailResponse, locationRows, itemRows, uomRows] =
        await Promise.all([
          stockTransfersApi.get(companyId, branchId, id),
          listLocations(companyId, branchId),
          stockTransfersApi.listItems(companyId),
          stockTransfersApi.listUoms(companyId),
        ]);

      if (requestId !== requestIdRef.current) return;

      itemsRef.current = itemRows;
      uomsRef.current = uomRows;

      const itemIdByCode = new Map(
        itemRows.map((item) => [norm(item.code), String(item.id)])
      );

      const uomIdByCodeOrName = new Map<string, string>();

      uomRows.forEach((uom) => {
        if (norm(uom.code)) uomIdByCodeOrName.set(norm(uom.code), String(uom.id));
        if (norm(uom.name)) uomIdByCodeOrName.set(norm(uom.name), String(uom.id));
      });

      const mappedLines: FormLine[] = (detailResponse.items ?? []).map(
        (line: any) => {
          const mappedItemId =
            clean(line.inventoryItemId) ||
            clean(line.itemId) ||
            itemIdByCode.get(norm(line.itemCode)) ||
            "";

          const mappedUnitId =
            clean(line.unitId) ||
            clean(line.uomId) ||
            uomIdByCodeOrName.get(norm(line.uom)) ||
            "";

          return {
            id: clean(line.id) || newKey(),
            inventoryItemId: mappedItemId,
            unitId: mappedUnitId,
            qty: Number(line.quantity) || 0,
            note: clean(line.notes) || clean(line.note) || "",
            _itemCode: clean(line.itemCode) || clean(line.sku),
            _itemName: clean(line.itemName) || clean(line.name),
            _uomText: clean(line.uom) || clean(line.uomCode),
          };
        }
      );

      setNeedsRemap(
        mappedLines.some(
          (line) => !clean(line.inventoryItemId) || !clean(line.unitId)
        )
      );

      setDetail(detailResponse);
      setLocations(locationRows);
      setItems(itemRows);
      setUoms(uomRows);
      setForm({
        fromLocationId: clean(detailResponse.fromLocationId),
        toLocationId: clean(detailResponse.toLocationId),
        transferDate: isoToDateOnly(detailResponse.transferDateUtc),
        reference: clean(detailResponse.reference),
        lines: mappedLines,
      });
      setErrors({});
      setPageState({ status: "ready" });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setPageState({
        status: "error",
        message: apiErr(error),
      });
    }
  }, [companyId, branchId, id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const updateHeader = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({
      ...prev,
      ...patch,
    }));
  }, []);

  const updateLine = useCallback((index: number, patch: Partial<FormLine>) => {
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
          id: newKey(),
          inventoryItemId: "",
          unitId: "",
          qty: 1,
          note: "",
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

  const onItemChange = useCallback(
    (index: number, inventoryItemId: string) => {
      const item = inventoryItemId ? itemById.get(inventoryItemId) : undefined;

      const defaultUnit =
        clean((item as any)?.baseUomId) || clean((item as any)?.defaultUomId) || "";

      updateLine(index, {
        inventoryItemId,
        unitId: defaultUnit,
      });
    },
    [itemById, updateLine]
  );

  const validate = useCallback((current: FormState): FieldErrors => {
    const next: FieldErrors = {};

    if (!clean(current.fromLocationId)) {
      next.fromLocationId = "From location is required.";
    }

    if (!clean(current.toLocationId)) {
      next.toLocationId = "To location is required.";
    }

    if (
      clean(current.fromLocationId) &&
      clean(current.toLocationId) &&
      current.fromLocationId === current.toLocationId
    ) {
      next.toLocationId = "From and To locations must be different.";
    }

    if (!clean(current.transferDate)) {
      next.transferDate = "Transfer date is required.";
    }

    if (!current.lines.length) {
      next.lines = "Add at least one line.";
    }

    const lineErrors: NonNullable<FieldErrors["lineErrors"]> = {};

    current.lines.forEach((line, index) => {
      const row: Partial<Record<keyof FormLine, string>> = {};

      if (!clean(line.inventoryItemId)) row.inventoryItemId = "Item is required.";
      if (!clean(line.unitId)) row.unitId = "UOM is required.";
      if (!Number.isFinite(line.qty) || line.qty <= 0) row.qty = "Qty must be > 0.";
      if (!clean(line.note)) row.note = "Note is required.";

      if (Object.keys(row).length > 0) {
        lineErrors[index] = row;
      }
    });

    if (Object.keys(lineErrors).length > 0) {
      next.lineErrors = lineErrors;
    }

    return next;
  }, []);

  const hasErrors = useCallback((next: FieldErrors) => {
    return Boolean(
      next.fromLocationId ||
        next.toLocationId ||
        next.transferDate ||
        next.lines ||
        (next.lineErrors && Object.keys(next.lineErrors).length)
    );
  }, []);

  const save = useCallback(async () => {
    if (!companyId || !branchId || !id || inFlightRef.current) return;

    setMsg(null);

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    inFlightRef.current = true;
    setSaving(true);

    try {
      await stockTransfersApi.update(companyId, branchId, id, {
        companyId,
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        reference: clean(form.reference) || null,
        transferDateUtc: form.transferDate
          ? dateOnlyToUtcIso(form.transferDate)
          : null,
        items: form.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          unitId: line.unitId,
          quantity: Number(line.qty),
          notes: clean(line.note) || "",
        })),
      } as any);

      await loadAll();

      setMsg({
        tone: "success",
        text: "Saved.",
      });
    } catch (error) {
      setMsg({
        tone: "error",
        text: apiErr(error),
      });
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [companyId, branchId, id, form, validate, hasErrors, loadAll]);

  const doAction = useCallback(
    async (kind: ActionKind) => {
      if (!companyId || !branchId || !id || inFlightRef.current) return;

      setMsg(null);

      if (kind === "submit") {
        const nextErrors = validate(form);
        setErrors(nextErrors);

        if (hasErrors(nextErrors)) {
          setMsg({
            tone: "error",
            text: "Fix validation errors before submitting.",
          });
          return;
        }
      }

      inFlightRef.current = true;
      setActing(kind);

      try {
        if (kind === "submit") {
          await stockTransfersApi.submit(companyId, branchId, id);
        } else if (kind === "cancel") {
          await stockTransfersApi.cancel(companyId, branchId, id);
        } else {
          await stockTransfersApi.post(companyId, branchId, id);
        }

        await loadAll();

        setMsg({
          tone: "success",
          text: "Done.",
        });
      } catch (error) {
        setMsg({
          tone: "error",
          text: apiErr(error),
        });
      } finally {
        inFlightRef.current = false;
        setActing(null);
      }
    },
    [companyId, branchId, id, form, validate, hasErrors, loadAll]
  );

  if (!companyId) {
    return <ScopeGuard tone="warn" title="No company selected" />;
  }

  if (!branchId) {
    return <ScopeGuard tone="warn" title="No branch selected" />;
  }

  if (!id) {
    return <ScopeGuard tone="danger" title="Missing transfer ID" />;
  }

  if (!paths) {
    return <ScopeGuard tone="danger" title="Company path could not be resolved" />;
  }

  const transferNo = clean(detail?.transferNumber);

  return (
    <div className="ob-page">
      <PageHeader
        transferNo={transferNo}
        status={status}
        editable={editable}
        loading={loading}
        totals={totals}
      />

      {editable && needsRemap ? <RemapWarning /> : null}

      {pageState.status === "error" ? (
        <MessageAlert tone="error" text={pageState.message} />
      ) : null}

      {msg ? <MessageAlert tone={msg.tone} text={msg.text} /> : null}

      <TransferDetailsCard
        loading={loading}
        detail={detail}
        editable={editable}
        busy={busy}
        form={form}
        errors={errors}
        locationOptions={locationOptions}
        onChange={updateHeader}
      />

      <LinesCard
        loading={loading}
        detail={detail}
        editable={editable}
        busy={busy}
        form={form}
        errors={errors}
        itemOptions={itemOptions}
        uomOptionsForLine={uomOptionsForLine}
        onAddLine={addLine}
        onRemoveLine={removeLine}
        onUpdateLine={updateLine}
        onItemChange={onItemChange}
      />

      <ActionBar
        busy={busy}
        editable={editable}
        saving={saving}
        acting={acting}
        status={status}
        onBack={() => go(paths.list)}
        onRefresh={() => void loadAll()}
        onSave={() => void save()}
        onSubmit={() => void doAction("submit")}
        onCancel={() => void doAction("cancel")}
        onPost={() => void doAction("post")}
      />
    </div>
  );
}

function ScopeGuard({
  tone,
  title,
}: {
  tone: "warn" | "danger";
  title: string;
}) {
  return (
    <div className="ob-page">
      <div className={`ob-alert ob-alert--${tone}`}>
        <span className="ob-alert__icon">{tone === "warn" ? "⚠" : "✕"}</span>
        <div>
          <div className="ob-alert__title">{title}</div>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  transferNo,
  status,
  editable,
  loading,
  totals,
}: {
  transferNo: string;
  status: StockTransferStatus;
  editable: boolean;
  loading: boolean;
  totals: { qty: number; lines: number };
}) {
  return (
    <div className="ob-page-header">
      <div>
        <div className="ob-page-title">
          Stock Transfer{transferNo ? ` — ${transferNo}` : ""}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          <StatusBadge status={status} />

          <span
            className={`ob-badge ${
              editable ? "ob-badge--warn" : "ob-badge--default"
            }`}
          >
            {editable ? "Editable" : "Read-only"}
          </span>

          {loading ? (
            <span style={{ fontSize: 12, color: "#64748b" }}>Loading…</span>
          ) : null}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#94a3b8",
          }}
        >
          Total qty
        </div>

        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: "-0.03em",
          }}
        >
          {totals.qty}
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          Lines: <b>{totals.lines}</b>
        </div>
      </div>
    </div>
  );
}

function RemapWarning() {
  return (
    <div className="ob-alert ob-alert--warn">
      <span className="ob-alert__icon">⚠</span>
      <div>
        <div className="ob-alert__title">Item mapping incomplete</div>
        <div className="ob-alert__msg">
          Some rows could not be auto-mapped to Item / UOM IDs. Select Item and
          UOM for those rows, then Save.
        </div>
      </div>
    </div>
  );
}

function MessageAlert({ tone, text }: { tone: MsgTone; text: string }) {
  const alertTone =
    tone === "success"
      ? "ok"
      : tone === "warn"
      ? "warn"
      : tone === "info"
      ? "info"
      : "danger";

  const icon =
    tone === "success" ? "✓" : tone === "warn" ? "⚠" : tone === "info" ? "i" : "✕";

  return (
    <div className={`ob-alert ob-alert--${alertTone}`}>
      <span className="ob-alert__icon">{icon}</span>
      <div>
        <div className="ob-alert__title">{text}</div>
      </div>
    </div>
  );
}

function TransferDetailsCard({
  loading,
  detail,
  editable,
  busy,
  form,
  errors,
  locationOptions,
  onChange,
}: {
  loading: boolean;
  detail: StockTransferDetailDto | null;
  editable: boolean;
  busy: boolean;
  form: FormState;
  errors: FieldErrors;
  locationOptions: SelectOption<string>[];
  onChange: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="ob-card" style={{ marginBottom: 14 }}>
      {(detail || !loading) && (
        <div className="ob-card-header">
          <div className="ob-card-title">Transfer details</div>
          <div className="ob-card-subtitle">
            From / To location, date, and reference
          </div>
        </div>
      )}

      <div className="ob-card-body">
        {loading && !detail ? (
          <div style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13 }}>
            Loading transfer…
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 160px 1fr",
              gap: 12,
            }}
          >
            <LocationField
              label="From location"
              value={form.fromLocationId}
              excludeValue={form.toLocationId}
              error={errors.fromLocationId}
              options={locationOptions}
              disabled={!editable || busy}
              placeholder="Select from…"
              onChange={(value) => onChange({ fromLocationId: value })}
            />

            <LocationField
              label="To location"
              value={form.toLocationId}
              excludeValue={form.fromLocationId}
              error={errors.toLocationId}
              options={locationOptions}
              disabled={!editable || busy}
              placeholder="Select to…"
              onChange={(value) => onChange({ toLocationId: value })}
            />

            <div className="ob-field">
              <label className="ob-label">
                Transfer date <span className="ob-label-req">*</span>
              </label>

              <input
                className="ob-input"
                style={errors.transferDate ? { borderColor: "#fca5a5" } : undefined}
                type="date"
                value={form.transferDate}
                disabled={!editable || busy}
                onChange={(event) => onChange({ transferDate: event.target.value })}
              />

              {errors.transferDate ? (
                <span className="ob-hint" style={{ color: "#dc2626" }}>
                  {errors.transferDate}
                </span>
              ) : null}
            </div>

            <div className="ob-field">
              <label className="ob-label">Reference</label>

              <input
                className="ob-input"
                value={form.reference}
                disabled={!editable || busy}
                onChange={(event) => onChange({ reference: event.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationField({
  label,
  value,
  excludeValue,
  error,
  options,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  excludeValue: string;
  error?: string;
  options: SelectOption<string>[];
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ob-field">
      <label className="ob-label">
        {label} <span className="ob-label-req">*</span>
      </label>

      <select
        className="ob-select"
        style={error ? { borderColor: "#fca5a5" } : undefined}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || "")}
      >
        {!value ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}

        {options
          .filter((option) => option.value !== excludeValue)
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>

      {error ? (
        <span className="ob-hint" style={{ color: "#dc2626" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function LinesCard({
  loading,
  detail,
  editable,
  busy,
  form,
  errors,
  itemOptions,
  uomOptionsForLine,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  onItemChange,
}: {
  loading: boolean;
  detail: StockTransferDetailDto | null;
  editable: boolean;
  busy: boolean;
  form: FormState;
  errors: FieldErrors;
  itemOptions: SelectOption<string>[];
  uomOptionsForLine: (inventoryItemId: string) => SelectOption<string>[];
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onUpdateLine: (index: number, patch: Partial<FormLine>) => void;
  onItemChange: (index: number, itemId: string) => void;
}) {
  return (
    <div className="ob-card" style={{ marginBottom: 70 }}>
      <div
        className="ob-card-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div className="ob-card-title">{editable ? "Draft items" : "Items"}</div>
          <div className="ob-card-subtitle">
            {editable ? "Add, edit, or remove line items." : "Posted items — read-only."}
          </div>
        </div>

        {editable ? (
          <button
            className="ob-btn ob-btn--primary"
            disabled={busy}
            onClick={onAddLine}
            style={{ minHeight: 34, padding: "0 14px", fontSize: 12 }}
          >
            + Add line
          </button>
        ) : null}
      </div>

      <div className="ob-card-body">
        {loading && !detail ? (
          <div style={{ padding: "12px 0", color: "#94a3b8", fontSize: 13 }}>
            Loading items…
          </div>
        ) : !editable && detail ? (
          <ReadOnlyLinesTable items={detail.items} />
        ) : (
          <EditableLinesTable
            form={form}
            errors={errors}
            busy={busy}
            itemOptions={itemOptions}
            uomOptionsForLine={uomOptionsForLine}
            onRemoveLine={onRemoveLine}
            onUpdateLine={onUpdateLine}
            onItemChange={onItemChange}
          />
        )}
      </div>
    </div>
  );
}

function EditableLinesTable({
  form,
  errors,
  busy,
  itemOptions,
  uomOptionsForLine,
  onRemoveLine,
  onUpdateLine,
  onItemChange,
}: {
  form: FormState;
  errors: FieldErrors;
  busy: boolean;
  itemOptions: SelectOption<string>[];
  uomOptionsForLine: (inventoryItemId: string) => SelectOption<string>[];
  onRemoveLine: (index: number) => void;
  onUpdateLine: (index: number, patch: Partial<FormLine>) => void;
  onItemChange: (index: number, itemId: string) => void;
}) {
  if (errors.lines) {
    return (
      <div className="ob-alert ob-alert--danger" style={{ marginBottom: 10 }}>
        <span className="ob-alert__icon">✕</span>
        <div>
          <div className="ob-alert__title">{errors.lines}</div>
        </div>
      </div>
    );
  }

  if (form.lines.length === 0) {
    return (
      <div className="ob-empty">
        <div className="ob-empty__title">No draft lines yet</div>
        <div className="ob-empty__sub">Click "+ Add line" to add items.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          minWidth: 1000,
          fontSize: 13,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["Item *", "UOM *", "Qty *", "Note *", ""].map((heading, index) => (
              <th
                key={index}
                style={{
                  padding: "9px 10px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                  borderBottom: "1px solid var(--ob-slate-200)",
                  whiteSpace: "nowrap",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {form.lines.map((line, index) => (
            <EditableLineRow
              key={line.id}
              line={line}
              index={index}
              lineError={errors.lineErrors?.[index] ?? {}}
              busy={busy}
              itemOptions={itemOptions}
              uomOptions={uomOptionsForLine(line.inventoryItemId)}
              onRemove={() => onRemoveLine(index)}
              onUpdate={(patch) => onUpdateLine(index, patch)}
              onItemChange={(itemId) => onItemChange(index, itemId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableLineRow({
  line,
  index,
  lineError,
  busy,
  itemOptions,
  uomOptions,
  onRemove,
  onUpdate,
  onItemChange,
}: {
  line: FormLine;
  index: number;
  lineError: Partial<Record<keyof FormLine, string>>;
  busy: boolean;
  itemOptions: SelectOption<string>[];
  uomOptions: SelectOption<string>[];
  onRemove: () => void;
  onUpdate: (patch: Partial<FormLine>) => void;
  onItemChange: (itemId: string) => void;
}) {
  const noteError = Boolean(lineError.note);

  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      <td style={{ padding: "8px 10px", minWidth: 260 }}>
        <select
          className="ob-select"
          style={lineError.inventoryItemId ? { borderColor: "#fca5a5" } : undefined}
          value={line.inventoryItemId || ""}
          disabled={busy}
          onChange={(event) => onItemChange(event.target.value || "")}
        >
          {!line.inventoryItemId ? (
            <option value="" disabled>
              {line._itemCode ? `Remap: ${line._itemCode}` : "Select item…"}
            </option>
          ) : null}

          {itemOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {lineError.inventoryItemId ? (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
            {lineError.inventoryItemId}
          </div>
        ) : null}
      </td>

      <td style={{ padding: "8px 10px", minWidth: 160 }}>
        <select
          className="ob-select"
          style={lineError.unitId ? { borderColor: "#fca5a5" } : undefined}
          value={line.unitId || ""}
          disabled={busy || !line.inventoryItemId}
          onChange={(event) => onUpdate({ unitId: event.target.value || "" })}
        >
          {!line.unitId ? (
            <option value="" disabled>
              {line._uomText ? `Remap: ${line._uomText}` : "Select UOM…"}
            </option>
          ) : null}

          {uomOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {lineError.unitId ? (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
            {lineError.unitId}
          </div>
        ) : null}
      </td>

      <td style={{ padding: "8px 10px", minWidth: 100 }}>
        <input
          className="ob-input"
          style={lineError.qty ? { borderColor: "#fca5a5" } : undefined}
          type="number"
          min={0}
          step={0.01}
          value={Number.isFinite(line.qty) ? line.qty : 0}
          disabled={busy}
          onChange={(event) => onUpdate({ qty: Number(event.target.value) })}
        />

        {lineError.qty ? (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
            {lineError.qty}
          </div>
        ) : null}
      </td>

      <td style={{ padding: "8px 10px", minWidth: 220 }}>
        <input
          className="ob-input"
          style={
            noteError
              ? {
                  borderColor: "#fca5a5",
                  background: "#fff5f5",
                  outline: "none",
                  boxShadow: "0 0 0 2px rgba(239,68,68,.15)",
                }
              : undefined
          }
          value={line.note}
          disabled={busy}
          onChange={(event) => onUpdate({ note: event.target.value })}
          placeholder="Required"
        />

        {noteError ? (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>
            {lineError.note}
          </div>
        ) : null}
      </td>

      <td
        style={{
          padding: "8px 10px",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        <button
          className="ob-btn ob-btn--danger"
          style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }}
          disabled={busy}
          onClick={onRemove}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

function ReadOnlyLinesTable({ items }: { items: StockTransferDetailDto["items"] }) {
  if (!items?.length) {
    return (
      <div className="ob-empty">
        <div className="ob-empty__title">No items.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 10,
        border: "1px solid var(--ob-slate-200)",
      }}
    >
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {[
              "Item Code",
              "Item Name",
              "UOM",
              "Qty",
              "Avg Cost",
              "Line Value",
              "Note",
            ].map((heading) => (
              <th
                key={heading}
                style={{
                  padding: "9px 12px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                  borderBottom: "1px solid var(--ob-slate-200)",
                  whiteSpace: "nowrap",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={readOnlyTdMono}>{item.itemCode}</td>
              <td style={readOnlyTdStrong}>{item.itemName}</td>
              <td style={readOnlyTd}>{item.uom}</td>
              <td style={readOnlyTdStrong}>{item.quantity}</td>
              <td style={readOnlyTd}>{item.avgUnitCost ?? "—"}</td>
              <td style={readOnlyTd}>{item.lineValue ?? "—"}</td>
              <td style={readOnlyTd}>{(item as any).notes || (item as any).note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: StockTransferStatus }) {
  const map: Record<string, string> = {
    Draft: "ob-badge--default",
    Submitted: "ob-badge--info",
    Approved: "ob-badge--success",
    Rejected: "ob-badge--danger",
    Posted: "ob-badge--success",
    Reversed: "ob-badge--warn",
    Cancelled: "ob-badge--warn",
  };

  return (
    <span className={`ob-badge ${map[String(status)] ?? "ob-badge--default"}`}>
      {String(status)}
    </span>
  );
}

function ActionBar({
  busy,
  editable,
  saving,
  acting,
  status,
  onBack,
  onRefresh,
  onSave,
  onSubmit,
  onCancel,
  onPost,
}: {
  busy: boolean;
  editable: boolean;
  saving: boolean;
  acting: ActionKind | null;
  status: StockTransferStatus;
  onBack: () => void;
  onRefresh: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onPost: () => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 14,
        border: "1px solid var(--ob-slate-200)",
        background: "rgba(255,255,255,.97)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 -2px 12px -4px rgba(15,23,42,.1)",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>
        <b>Workflow:</b> Draft → Submit → Approve → Post
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <button className="ob-btn ob-btn--ghost" onClick={onBack} disabled={busy}>
          Transfers
        </button>

        <button className="ob-btn ob-btn--ghost" onClick={onRefresh} disabled={busy}>
          Refresh
        </button>

        <button
          className="ob-btn ob-btn--ghost"
          onClick={onSave}
          disabled={!editable || busy}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          className="ob-btn ob-btn--primary"
          onClick={onSubmit}
          disabled={!canSubmit(status) || busy}
        >
          {acting === "submit" ? "Submitting…" : "Submit"}
        </button>

        <button
          className="ob-btn ob-btn--ghost"
          onClick={onCancel}
          disabled={!canCancel(status) || busy}
        >
          {acting === "cancel" ? "Cancelling…" : "Cancel"}
        </button>

        <button
          className="ob-btn ob-btn--primary"
          onClick={onPost}
          disabled={!canPost(status) || busy}
        >
          {acting === "post" ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

const readOnlyTd: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 12,
  color: "#475569",
};

const readOnlyTdMono: React.CSSProperties = {
  ...readOnlyTd,
  fontFamily: "monospace",
  color: "#64748b",
};

const readOnlyTdStrong: React.CSSProperties = {
  ...readOnlyTd,
  fontSize: 13,
  fontWeight: 600,
  color: "#0f172a",
};