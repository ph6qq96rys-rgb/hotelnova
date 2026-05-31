import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { stockTransfersApi } from "../api/stockTransfersApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";

import type { InventoryItemDto } from "../../../inventoryMaster/items/types";

import {
  cardStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  tableStyle,
  thStyle,
  tdStyle,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
  stickyBar,
} from "../../../../shared/inventoryStyles";

type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

const clean = (value?: string | null) => (value ?? "").trim();

const todayDateOnly = () => new Date().toISOString().slice(0, 10);

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

function toItemVm(dto: InventoryItemDto): ItemVm {
  const d: any = dto;

  const id = clean(d.id);
  const name = clean(d.name) || "Item";
  const code = clean(d.code) || clean(d.sku);

  const rawUoms: any[] = Array.isArray(d.uoms)
    ? d.uoms
    : Array.isArray(d.itemUoms)
      ? d.itemUoms
      : Array.isArray(d.allowedUoms)
        ? d.allowedUoms
        : [];

  const uoms: ItemUomVm[] = rawUoms
    .map((u) => {
      const uomId = clean(u.uomId ?? u.id);
      const uomName = clean(u.uomName ?? u.name ?? u.code ?? "UOM");

      return {
        uomId,
        uomName,
        isDefault:
          !!u.isDefaultIssue ||
          !!u.isDefaultPurchase ||
          !!u.isDefault ||
          !!u.isBase,
      };
    })
    .filter((x) => !!x.uomId);

  const baseUomId = clean(d.baseUomId);
  const baseUomName = clean(
    d.baseUomName ?? d.baseUomCode ?? d.baseUom?.name ?? d.baseUom?.code
  );

  if (!uoms.length && baseUomId) {
    uoms.push({
      uomId: baseUomId,
      uomName: baseUomName || "Base UOM",
      isDefault: true,
    });
  }

  const defaultUomId =
    uoms.find((x) => x.isDefault)?.uomId || baseUomId || uoms[0]?.uomId || "";

  return {
    id,
    label: code ? `${code} — ${name}` : name,
    uoms,
    defaultUomId,
  };
}

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

export default function StockTransferCreatePage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [form, setForm] = useState<TransferDraft>({
    fromLocationId: "",
    toLocationId: "",
    transferDate: todayDateOnly(),
    notes: "",
    lines: [],
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [locationOptions, setLocationOptions] = useState<SelectOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationLabelById, setLocationLabelById] = useState<Record<string, string>>({});
  const fetchedLocationRef = useRef<Set<string>>(new Set());

  const [items, setItems] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemLabelById, setItemLabelById] = useState<Record<string, string>>({});
  const [uomLabelById, setUomLabelById] = useState<Record<string, string>>({});

  const itemById = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);

  const itemOptions = useMemo<SelectOption[]>(
    () => items.map((x) => ({ value: x.id, label: x.label })),
    [items]
  );

  const setHeader = (patch: Partial<TransferDraft>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateLine = (index: number, patch: Partial<TransferLineDraft>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line
      ),
    }));
  };

  useEffect(() => {
    if (!companyId || !branchId) {
      setLocationOptions([]);
      return;
    }

    let alive = true;

    async function loadLocations() {
      setLocationsLoading(true);

      try {
        const rows = await stockLocationsApi.list(companyId, branchId);

        if (!alive) return;

        const options = (rows ?? [])
          .map((x: any) => ({
            value: clean(x.id),
            label: clean(x.name) || clean(x.code) || "Location",
          }))
          .filter((x) => !!x.value);

        setLocationOptions(options);

        setLocationLabelById((prev) => {
          const next = { ...prev };
          options.forEach((x) => {
            next[x.value] = x.label;
          });
          return next;
        });
      } catch {
        if (alive) setLocationOptions([]);
      } finally {
        if (alive) setLocationsLoading(false);
      }
    }

    loadLocations();

    return () => {
      alive = false;
    };
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId || !branchId) return;

    const ids = [clean(form.fromLocationId), clean(form.toLocationId)].filter(Boolean);

    ids.forEach((id) => {
      if (locationLabelById[id]) return;
      if (fetchedLocationRef.current.has(id)) return;

      const api: any = stockLocationsApi;

      if (typeof api.getById !== "function") {
        fetchedLocationRef.current.add(id);
        setLocationLabelById((prev) => ({ ...prev, [id]: "Saved location" }));
        return;
      }

      fetchedLocationRef.current.add(id);

      api
        .getById(companyId, branchId, id)
        .then((loc: any) => {
          setLocationLabelById((prev) => ({
            ...prev,
            [id]: clean(loc?.name) || clean(loc?.code) || "Saved location",
          }));
        })
        .catch(() => {
          setLocationLabelById((prev) => ({ ...prev, [id]: "Saved location" }));
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
        const result = await inventoryItemsApi.list(companyId);
        const rows: InventoryItemDto[] = Array.isArray(result) ? result : result ?? [];
        const vms = rows.map(toItemVm).filter((x) => !!x.id);

        if (!alive) return;

        setItems(vms);

        setItemLabelById((prev) => {
          const next = { ...prev };
          vms.forEach((x) => {
            next[x.id] = x.label;
          });
          return next;
        });

        setUomLabelById((prev) => {
          const next = { ...prev };
          vms.forEach((item) => {
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

    loadItems();

    return () => {
      alive = false;
    };
  }, [companyId]);

  const validate = (draft: TransferDraft): FieldErrors => {
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
  };

  const hasErrors = (e: FieldErrors) =>
    !!(
      e.fromLocationId ||
      e.toLocationId ||
      e.transferDate ||
      e.lines ||
      (e.lineErrors && Object.keys(e.lineErrors).length)
    );

  const addLine = () => {
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
  };

  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));

    setErrors((prev) => {
      if (!prev.lineErrors) return prev;

      const remapped: NonNullable<FieldErrors["lineErrors"]> = {};

      Object.entries(prev.lineErrors).forEach(([key, value]) => {
        const i = Number(key);
        if (!Number.isFinite(i)) return;

        if (i < index) remapped[i] = value;
        if (i > index) remapped[i - 1] = value;
      });

      return {
        ...prev,
        lineErrors: remapped,
      };
    });
  };

  const submit = async () => {
    setSubmitError(null);

    if (!companyId || !branchId) {
      setSubmitError("Company and branch scope are required.");
      return;
    }

    const nextErrors = validate(form);
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

    setBusy(true);

    try {
      const id = await stockTransfersApi.create(companyId, branchId, payload);
      navigate(`/inventory/stock-transfers/${id}/edit`);
    } catch (error: any) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) {
    return <div style={{ padding: 16 }}>Select a company first.</div>;
  }

  if (!branchId) {
    return <div style={{ padding: 16 }}>Select a branch first.</div>;
  }

  const fromId = clean(form.fromLocationId);
  const toId = clean(form.toLocationId);

  const fromExists = fromId
    ? locationOptions.some((x) => x.value === fromId)
    : false;

  const toExists = toId
    ? locationOptions.some((x) => x.value === toId)
    : false;

  const fromLabel = locationLabelById[fromId] || "Saved location";
  const toLabel = locationLabelById[toId] || "Saved location";

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
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

          {submitError && (
            <div style={{ marginTop: 10, ...errorStyle }}>{submitError}</div>
          )}
        </div>
      </div>

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
              style={inputStyle(!!errors.fromLocationId)}
              value={fromId}
              disabled={locationsLoading || busy}
              onChange={(e) => {
                const value = e.target.value;
                setHeader({
                  fromLocationId: value,
                  toLocationId: value === toId ? "" : form.toLocationId,
                });
              }}
            >
              {!fromId && (
                <option value="">
                  {locationsLoading ? "Loading locations..." : "Select from location…"}
                </option>
              )}

              {!fromExists && fromId && (
                <option value={fromId}>{fromLabel}</option>
              )}

              {locationOptions
                .filter((x) => x.value !== toId)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
            {errors.fromLocationId && (
              <div style={errorStyle}>{errors.fromLocationId}</div>
            )}
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>To Location *</label>
            <select
              style={inputStyle(!!errors.toLocationId)}
              value={toId}
              disabled={locationsLoading || busy}
              onChange={(e) => {
                const value = e.target.value;
                setHeader({
                  toLocationId: value,
                  fromLocationId: value === fromId ? "" : form.fromLocationId,
                });
              }}
            >
              {!toId && (
                <option value="">
                  {locationsLoading ? "Loading locations..." : "Select to location…"}
                </option>
              )}

              {!toExists && toId && <option value={toId}>{toLabel}</option>}

              {locationOptions
                .filter((x) => x.value !== fromId)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
            {errors.toLocationId && (
              <div style={errorStyle}>{errors.toLocationId}</div>
            )}
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Transfer Date *</label>
            <input
              style={inputStyle(!!errors.transferDate)}
              type="date"
              value={form.transferDate}
              disabled={busy}
              onChange={(e) => setHeader({ transferDate: e.target.value })}
            />
            {errors.transferDate && (
              <div style={errorStyle}>{errors.transferDate}</div>
            )}
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <label style={labelStyle}>Notes</label>
            <input
              style={inputStyle(false)}
              value={form.notes}
              disabled={busy}
              onChange={(e) => setHeader({ notes: e.target.value })}
              placeholder="Optional transfer notes…"
            />
          </div>
        </div>
      </div>

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

          <button type="button" style={primaryBtn} onClick={addLine} disabled={busy}>
            + Add Line
          </button>
        </div>

        {errors.lines && (
          <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div>
        )}

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
                form.lines.map((line, index) => {
                  const lineError = errors.lineErrors?.[index] ?? {};

                  const itemId = clean(line.itemId);
                  const unitId = clean(line.unitId);

                  const selectedItem = itemId ? itemById.get(itemId) : undefined;

                  const uomOptions: SelectOption[] =
                    selectedItem?.uoms.map((u) => ({
                      value: u.uomId,
                      label: u.uomName,
                    })) ?? [];

                  const itemExists = itemId ? itemById.has(itemId) : false;
                  const uomExists = unitId
                    ? uomOptions.some((x) => x.value === unitId)
                    : false;

                  const savedItemLabel =
                    itemLabelById[itemId] || (itemId ? "Saved item" : "");

                  const savedUomLabel =
                    uomLabelById[unitId] || (unitId ? "Saved unit" : "");

                  return (
                    <tr key={`${index}-${itemId || "new"}`}>
                      <td style={tdStyle}>{index + 1}</td>

                      <td style={tdStyle}>
                        <select
                          style={inputStyle(!!lineError.itemId)}
                          value={itemId}
                          disabled={itemsLoading || busy}
                          onChange={(e) => {
                            const selectedItemId = e.target.value;
                            const item = selectedItemId
                              ? itemById.get(selectedItemId)
                              : undefined;

                            updateLine(index, {
                              itemId: selectedItemId,
                              unitId: item?.defaultUomId ?? "",
                            });
                          }}
                        >
                          {!itemId && (
                            <option value="">
                              {itemsLoading ? "Loading items..." : "Select item…"}
                            </option>
                          )}

                          {!itemExists && itemId && (
                            <option value={itemId}>{savedItemLabel}</option>
                          )}

                          {itemOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {lineError.itemId && (
                          <div style={errorStyle}>{lineError.itemId}</div>
                        )}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(!!lineError.quantity)}
                          type="number"
                          min={0}
                          step={0.01}
                          value={Number.isFinite(line.quantity) ? line.quantity : 0}
                          disabled={busy}
                          onChange={(e) =>
                            updateLine(index, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />

                        {lineError.quantity && (
                          <div style={errorStyle}>{lineError.quantity}</div>
                        )}
                      </td>

                      <td style={tdStyle}>
                        <select
                          style={inputStyle(!!lineError.unitId)}
                          value={unitId}
                          disabled={!itemId || busy}
                          onChange={(e) =>
                            updateLine(index, { unitId: e.target.value })
                          }
                        >
                          {!unitId && (
                            <option value="">
                              {!itemId
                                ? "Select item first…"
                                : uomOptions.length === 0
                                  ? "No UOM configured"
                                  : "Select unit…"}
                            </option>
                          )}

                          {!uomExists && unitId && (
                            <option value={unitId}>{savedUomLabel}</option>
                          )}

                          {uomOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {lineError.unitId && (
                          <div style={errorStyle}>{lineError.unitId}</div>
                        )}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(false)}
                          value={line.notes}
                          disabled={busy}
                          onChange={(e) =>
                            updateLine(index, { notes: e.target.value })
                          }
                          placeholder="Optional"
                        />
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          type="button"
                          style={dangerBtn}
                          onClick={() => removeLine(index)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Create the transfer draft, then continue to review and submit.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            style={secondaryBtn}
            onClick={() => navigate("/inventory/stock-transfers")}
            disabled={busy}
          >
            Transfers
          </button>

          <button type="button" style={primaryBtn} onClick={submit} disabled={busy}>
            {busy ? "Creating..." : "Create Draft & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}