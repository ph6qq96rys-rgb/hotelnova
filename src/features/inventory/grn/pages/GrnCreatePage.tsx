// GrnDraftEditorPage.tsx (FULL REWRITE)
// ✅ Draft workflow: create draft, load/edit draft by :draftId, post draft
// ✅ companyId/branchId come from AppScope (NOT from URL)
// ✅ Dropdown labels are user-friendly (NO full GUIDs shown as selectable text)
// ✅ Still “shows IDs” safely: uses short IDs in label (last 6–8 chars), not full GUID spam
// ✅ Item → UOM dropdown filtered to item.allowed UOM list
// ✅ DraftId shown in header (full GUID) but not inside dropdown options
//
// Recommended routes:
//   /inventory/grns/drafts
//   /inventory/grns/drafts/new
//   /inventory/grns/drafts/:draftId
//   /inventory/grns/:grnId

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../../app/useAppScope";

import { grnApi } from "../api/grnApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import { inventoryItemsApi } from "../../../inventoryMaster/items/api/inventoryItemsApi";

import type { InventoryItemDto } from "../../../inventoryMaster/items/types";
import type { SelectOption,  GrnDto, CreateGrnDraftRequest } from "../types/grn";
import { SelectDropdown } from "../../../../components/controls/SelectDropdown";
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
  stickyBar,totRow} from "../../../../shared/inventoryStyles"


/** ================= Helpers ================= */
const todayDateOnly = () => new Date().toISOString().slice(0, 10);

function dateOnlyToUtcIso(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

function utcIsoToDateOnly(iso: string | null | undefined) {
  return (iso ?? "").toString().slice(0, 10) || todayDateOnly();
}

function toNullable(s: string | null | undefined) {
  const t = (s ?? "").trim();
  return t ? t : null;
}

function money(n: number) {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

const clean = (s?: string | null) => (s ?? "").trim();

const shortId = (id?: string | null, n = 8) => {
  const s = clean(id);
  if (!s) return "";
  return s.length <= n ? s : s.slice(-n);
};

const niceJoin = (...parts: Array<string | undefined | null>) =>
  parts
    .map((x) => clean(x))
    .filter(Boolean)
    .join(" ");

const labelWithShortId = (main: string, id?: string | null) => {
  const sid = shortId(id, 8);
  return sid ? `${main}  ·  #${sid}` : main;
};

/** ================= View Models ================= */
type ItemUomVm = {
  uomId: string;
  uomName: string; // friendly name
  isDefaultPurchase?: boolean;
};

type ItemVm = {
  id: string;
  code?: string;
  name: string;
  label: string; // friendly, NO full GUID
  baseUomId: string;
  baseUomName?: string;
  uoms: ItemUomVm[];
  defaultUomId: string;
};

function toItemVm(dto: InventoryItemDto): ItemVm {
  const d: any = dto;

  const id = clean(d.id);
  const name = clean(d.name);
  const code = clean(d.code) || clean(d.sku) || undefined;

  const baseUomId = clean(d.baseUomId);
  const baseUomName =
    clean(d.baseUomCode) ||
    clean(d.baseUomName) ||
    clean(d.baseUom?.code) ||
    clean(d.baseUom?.name) ||
    undefined;

  const uomsRaw: any[] =
    Array.isArray(d.uoms) ? d.uoms : Array.isArray(d.itemUoms) ? d.itemUoms : [];

  const uoms: ItemUomVm[] = (uomsRaw ?? [])
    .map((u: any) => {
      const uomId = clean(u.uomId ?? u.id);
      const uomName = clean(u.uomName ?? u.name ?? u.code ?? "UOM");
      return {
        uomId,
        uomName,
        isDefaultPurchase: !!u.isDefaultPurchase,
      };
    })
    .filter((x) => !!x.uomId);

  // fallback: at least base UOM exists
  if (!uoms.length && baseUomId) {
    uoms.push({
      uomId: baseUomId,
      uomName: baseUomName ?? "Base UOM",
      isDefaultPurchase: true,
    });
  }

  const defaultUomId =
    uoms.find((x) => x.isDefaultPurchase)?.uomId ?? baseUomId ?? (uoms[0]?.uomId ?? "");

  // Friendly label (no GUID), but still uniquely helpful:
  // "ITM-001 — Avocado Oil (1L) · #d0f051"
  const friendlyMain = code ? `${code} — ${name}` : name;
  const label = labelWithShortId(friendlyMain, id);

  return {
    id,
    code,
    name,
    label,
    baseUomId,
    baseUomName,
    uoms,
    defaultUomId,
  };
}

/** ================= Draft Form Types ================= */
export type GrnLineDraft = {
  inventoryItemId: string;
  uomId: string;
  quantity: number;
  unitCost: number;
  expiryDate: string | null; // date-only
  notes: string;
};

export type GrnDraft = {
  id?: string;
  locationId: string;
  receivedDate: string; // date-only
  supplierName: string;
  notes: string;
  lines: GrnLineDraft[];
};

type FieldErrors = {
  locationId?: string;
  receivedDate?: string;
  lines?: string;
  lineErrors?: Record<number, Partial<Record<keyof GrnLineDraft, string>>>;
};

/** ================= Page ================= */
export default function GrnDraftEditorPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  // URL has only draftId (real param). companyId is NOT in URL.
  const { draftId } = useParams<{ draftId?: string }>();
  const isEdit = !!draftId;

  /** Form */
  const [form, setForm] = useState<GrnDraft>({
    id: undefined,
    locationId: "",
    receivedDate: todayDateOnly(),
    supplierName: "",
    notes: "",
    lines: [],
  });

  const setHeader = (patch: Partial<GrnDraft>) => setForm((f) => ({ ...f, ...patch }));

  /** Warehouses */
  const [warehouseOptions, setWarehouseOptions] = useState<SelectOption<string>[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  useEffect(() => {
    setWarehouseOptions([]);
    if (!companyId || !branchId) return;

    setWarehousesLoading(true);
    stockLocationsApi
      .list(companyId, branchId)
      .then((rows: any[]) => {
        const opts: SelectOption<string>[] = (rows ?? []).map((x) => {
         // const code = clean(x.code);
          const name = clean(x.name) || "Warehouse";
         // const main =  code ? `${code} — ${name}` : name;
          return {
            value: String(x.id),
            label: name,// labelWithShortId(name, String(x.id)),
          };
        });
        setWarehouseOptions(opts);
      })
      .catch(() => setWarehouseOptions([]))
      .finally(() => setWarehousesLoading(false));
  }, [companyId, branchId]);

  /** Items */
  const [items, setItems] = useState<ItemVm[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!companyId) {
        if (!alive) return;
        setItems([]);
        setItemsLoading(false);
        return;
      }

      setItemsLoading(true);
      try {
        const res = await inventoryItemsApi.list(companyId);
        const list: InventoryItemDto[] = Array.isArray(res) ? res : [];
        if (!alive) return;
        setItems(list.map(toItemVm));
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setItemsLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);
  const itemOptions = useMemo<SelectOption<string>[]>(
    () => items.map((it) => ({ value: it.id, label: it.name })),
    [items]
  );

  /** Load draft (edit/view) */
  useEffect(() => {
    if (!companyId || !draftId) return;

    grnApi
      .getDraftById(companyId, draftId)
      .then((dto: GrnDto) => {
        const anyDto: any = dto;

        setForm({
          id: anyDto.id,
          locationId: anyDto.locationId ?? "",
          receivedDate: utcIsoToDateOnly(anyDto.receivedAtUtc ?? anyDto.receivedDateUtc),
          supplierName: anyDto.supplierName ?? "",
          notes: anyDto.notes ?? "",
          lines: (anyDto.lines ?? []).map((l: any) => ({
            inventoryItemId: l.inventoryItemId ?? "",
            uomId: l.uomId ?? l.unitId ?? "",
            quantity: Number(l.quantity ?? 0),
            unitCost: Number(l.unitCost ?? 0),
            expiryDate: l.expiryDateUtc ? utcIsoToDateOnly(l.expiryDateUtc) : null,
            notes: l.notes ?? "",
          })),
        });
      })
      .catch((e: any) => {
        alert(e?.response?.data?.title ?? e?.message ?? "Failed to load draft");
      });
  }, [companyId, draftId]);

  /** Totals */
  const subtotal = useMemo(
    () => form.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [form.lines]
  );

  /** Lines helpers */
  const addLine = () => {
    const nl: GrnLineDraft = {
      inventoryItemId: "",
      uomId: "",
      quantity: 1,
      unitCost: 0,
      expiryDate: null,
      notes: "",
    };
    setForm((f) => ({ ...f, lines: [...f.lines, nl] }));
  };

  const removeLine = (idx: number) => {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
    setErrors((prev) => {
      const next: FieldErrors = { ...prev };
      if (next.lineErrors) {
        const remapped: FieldErrors["lineErrors"] = {};
        Object.entries(next.lineErrors).forEach(([k, v]) => {
          const i = Number(k);
          if (i < idx) remapped![i] = v;
          else if (i > idx) remapped![i - 1] = v;
        });
        next.lineErrors = remapped;
      }
      return next;
    });
  };

  const updateLine = (idx: number, patch: Partial<GrnLineDraft>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };

  /** Errors + submit */
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (current: GrnDraft): FieldErrors => {
    const e: FieldErrors = {};
    if (!clean(current.locationId)) e.locationId = "Warehouse is required.";
    if (!clean(current.receivedDate)) e.receivedDate = "Received date is required.";
    if (!current.lines.length) e.lines = "Add at least one line.";

    const lineErrors: FieldErrors["lineErrors"] = {};
    current.lines.forEach((l, idx) => {
      const le: Partial<Record<keyof GrnLineDraft, string>> = {};
      if (!clean(l.inventoryItemId)) le.inventoryItemId = "Item is required.";
      if (!clean(l.uomId)) le.uomId = "Unit is required.";
      if (!Number.isFinite(l.quantity) || l.quantity <= 0) le.quantity = "Qty must be > 0.";
      if (!Number.isFinite(l.unitCost) || l.unitCost < 0) le.unitCost = "Unit cost cannot be negative.";
      if (Object.keys(le).length) lineErrors[idx] = le;
    });

    if (Object.keys(lineErrors).length) e.lineErrors = lineErrors;
    return e;
  };

  const hasErrors = (e: FieldErrors) =>
    !!(e.locationId || e.receivedDate || e.lines || (e.lineErrors && Object.keys(e.lineErrors).length));

  /** Payload (recommended body excludes companyId; route supplies it) */
 

  const buildPayload = (): CreateGrnDraftRequest => ({
    locationId: form.locationId,
    receivedDate: dateOnlyToUtcIso(form.receivedDate),
    supplierName: toNullable(form.supplierName) ?? "",
    notes: toNullable(form.notes),
    lines: form.lines.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      quantity: Number(l.quantity),
      unitId: l.uomId,
      unitCost: Number(l.unitCost),
      expiryDateUtc: l.expiryDate ? dateOnlyToUtcIso(l.expiryDate) : null,
      notes: toNullable(l.notes),
    })),
  });

  const saveDraft = async () => {
    setSubmitError(null);
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e) || !companyId) return;

    setSaving(true);
    try {
      const payload = buildPayload();

      if (!form.id) {
              const created = await grnApi.createDraft(companyId, payload);
              setForm((f) => ({ ...f, id: created.id }));

              nav(`/companies/${companyId}/grns/drafts/${created.id}`, {
                replace: true,
              });
            } else {
              await grnApi.updateDraft(companyId, form.id, payload);
            }
    } catch (err: any) {
      setSubmitError(err?.response?.data?.title ?? err?.message ?? "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const postGrn = async () => {
    setSubmitError(null);
    const e = validate(form);
    setErrors(e);
    if (hasErrors(e) || !companyId) return;

    setPosting(true);
    try {
      let id = form.id;

      // Ensure draft exists first
      if (!id) {
        const created = await grnApi.createDraft(companyId, buildPayload());
        id = created.id;
        setForm((f) => ({ ...f, id }));
        nav(`/companies/${companyId}/grns/drafts/${id}`, { replace: true });
      }

      const posted = await grnApi.postDraft(companyId, id);

        const postedId =
          typeof posted === "string"
            ? posted
            : posted?.id;

        if (!postedId) {
          throw new Error("Posted GRN response did not return an id.");
        }
      nav(`/companies/${companyId}/grns/${postedId}`);
    } 
    catch (err: any) {
      setSubmitError(err?.response?.data?.title ?? err?.message ?? "Failed to post GRN");
    } finally {
      setPosting(false);
    }
  };

  /** ================= Render ================= */
  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{isEdit ? "Edit GRN Draft" : "New GRN Draft"}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Select warehouse, then add line items. Units are restricted to each item’s allowed UOM list.
          </div>

          {/* Show full draft GUID in header (OK) */}
          {(form.id || draftId) && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
              Draft Id: <b>{form.id ?? draftId}</b>
            </div>
          )}

          {/* Scope warnings */}
          {!companyId && (
            <div style={{ marginTop: 10, color: "rgb(220, 38, 38)", fontSize: 12 }}>
              companyId missing (AppScope). Cannot submit.
            </div>
          )}
          {!branchId && (
            <div style={{ marginTop: 6, color: "rgb(220, 38, 38)", fontSize: 12 }}>
              branchId missing (AppScope). Select a branch to load warehouses.
            </div>
          )}

          {submitError && <div style={{ marginTop: 10, color: "rgb(220, 38, 38)", fontSize: 12 }}>{submitError}</div>}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Subtotal</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{money(subtotal)}</div>
        </div>
      </div>

      {/* Header Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 4" }}>
            <SelectDropdown<string>
              label="Warehouse *"
              value={form.locationId || null}
              options={warehouseOptions}
              loading={warehousesLoading}
              disabled={!companyId || !branchId}
              placeholder={!branchId ? "Select branch first…" : "Select warehouse…"}
              onChange={(v) => setHeader({ locationId: v ?? "" })}
            />
            {errors.locationId && <div style={errorStyle}>{errors.locationId}</div>}
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Received Date *</label>
            <input
              style={inputStyle(!!errors.receivedDate)}
              type="date"
              value={form.receivedDate}
              onChange={(e) => setHeader({ receivedDate: e.target.value })}
            />
            {errors.receivedDate && <div style={errorStyle}>{errors.receivedDate}</div>}
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label style={labelStyle}>Supplier Name</label>
            <input
              style={inputStyle(false)}
              value={form.supplierName}
              onChange={(e) => setHeader({ supplierName: e.target.value })}
              placeholder="Supplier"
            />
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle(false), minHeight: 72, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => setHeader({ notes: e.target.value })}
              placeholder="Optional receiving notes…"
            />
          </div>
        </div>

        {/* Tiny hint: IDs are not shown fully in dropdowns */}
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          IDs are shown as short codes like <b>#d0f051a2</b> in dropdowns (full GUIDs are not displayed to select).
        </div>
      </div>

      {/* Lines Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Lines</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Item dropdown shows <b>Code — Name</b> with a short id. UOM dropdown shows friendly unit names.
            </div>
          </div>

          <button style={primaryBtn} onClick={addLine}>
            + Add Line
          </button>
        </div>

        {errors.lines && <div style={{ ...errorStyle, marginTop: 10 }}>{errors.lines}</div>}

        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item *</th>
                <th style={thStyle}>Qty *</th>
                <th style={thStyle}>Unit (UOM) *</th>
                <th style={thStyle}>Unit Cost</th>
                <th style={thStyle}>Expiry</th>
                <th style={thStyle}>Line Notes</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Line Total</th>
                <th style={thStyle}></th>
              </tr>
            </thead>

            <tbody>
              {form.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 18, opacity: 0.75 }}>
                    No lines yet. Click <b>Add Line</b>.
                  </td>
                </tr>
              ) : (
                form.lines.map((l, idx) => {
                  const le = errors.lineErrors?.[idx] ?? {};
                  const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);

                  const item = l.inventoryItemId ? itemById.get(l.inventoryItemId) : undefined;

                  // Friendly UOM labels (no GUID spam)
                  const uomOptions: SelectOption<string>[] =
                    item?.uoms.map((u) => ({
                      value: u.uomId,
                      label: u.uomName,//labelWithShortId(u.uomName, u.uomId),
                    })) ?? [];

                  return (
                    <tr key={idx}>
                      <td style={tdStyle}>
                        <SelectDropdown<string>
                          value={l.inventoryItemId || null}
                          options={itemOptions}
                          loading={itemsLoading}
                          placeholder="Select item…"
                          onChange={(v) => {
                            const id = v ?? "";
                            const it = id ? itemById.get(id) : undefined;

                            updateLine(idx, {
                              inventoryItemId: id,
                              uomId: it?.defaultUomId ?? "",
                            });
                          }}
                        />
                        {le.inventoryItemId && <div style={errorStyle}>{le.inventoryItemId}</div>}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(!!le.quantity)}
                          type="number"
                          min={0}
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        />
                        {le.quantity && <div style={errorStyle}>{le.quantity}</div>}
                      </td>

                      <td style={tdStyle}>
                        <SelectDropdown<string>
                          value={l.uomId || null}
                          options={uomOptions}
                          disabled={!l.inventoryItemId}
                          placeholder={!l.inventoryItemId ? "Select item first…" : "Select unit…"}
                          onChange={(v) => updateLine(idx, { uomId: v ?? "" })}
                        />
                        {le.uomId && <div style={errorStyle}>{le.uomId}</div>}

                        {/* Keep full base UOM info out of dropdown; show helpful hint below */}
                        {item?.baseUomId && (
                          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>
                            Base UOM:{" "}
                            <b>
                              {niceJoin(item.baseUomName ?? "Base")}{""}
                            </b>{" "}
                            <span style={{ opacity: 0.8 }}>· #{shortId(item.baseUomId, 8)}</span>
                          </div>
                        )}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(!!le.unitCost)}
                          type="number"
                          min={0}
                          value={l.unitCost}
                          onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) })}
                        />
                        {le.unitCost && <div style={errorStyle}>{le.unitCost}</div>}
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(false)}
                          type="date"
                          value={l.expiryDate ?? ""}
                          onChange={(e) => updateLine(idx, { expiryDate: e.target.value || null })}
                        />
                      </td>

                      <td style={tdStyle}>
                        <input
                          style={inputStyle(false)}
                          value={l.notes}
                          onChange={(e) => updateLine(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>

                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{money(lineTotal)}</td>

                      <td style={tdStyle}>
                        <button style={dangerBtn} onClick={() => removeLine(idx)}>
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

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{ minWidth: 280 }}>
            <div style={totRow}>
              <span style={{ opacity: 0.75 }}>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div style={{ ...totRow, marginTop: 6, fontSize: 16 }}>
              <span>Total</span>
              <b>{money(subtotal)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div style={stickyBar}>
        <div style={{ opacity: 0.85 }}>
          <b>Tip:</b> Save Draft first, then Post when you confirm quantities & cost.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={() => nav(`/companies/${companyId}/grns/drafts`)}>
            Drafts
          </button>

          <button style={secondaryBtn} onClick={saveDraft} disabled={saving || posting || !companyId}>
            {saving ? "Saving..." : form.id ? "Update Draft" : "Save Draft"}
          </button>

          <button style={primaryBtn} onClick={postGrn} disabled={saving || posting || !companyId}>
            {posting ? "Posting..." : "Post GRN"}
          </button>
        </div>
      </div>
    </div>
  );
}

