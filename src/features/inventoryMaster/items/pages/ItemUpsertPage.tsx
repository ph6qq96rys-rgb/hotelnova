import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { itemsApi } from "../api/itemsApi";
import type { InventoryCatalogs } from "../types";
import type { ItemType } from "../constants/itemTypes";
import { useAppScope } from "../../../../app/useAppScope";
import UomConversionGrid, {type AllowedUomRow } from "../components/UomConversionGrid";
import OpeningStockModal from "../components/OpeningStockModal";

type Model = {
  id?: string;
  name: string;
  type: ItemType;
  categoryId: string;
  baseUomId: string;
  allowedUoms: AllowedUomRow[];
  trackStock: boolean;
  costingMethod?: string;
  active?: boolean;
};

function isPhysical(type: ItemType) {
  return type !== "Service";
}

export default function ItemUpsertPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const nav = useNavigate();
  const { companyId } = useAppScope();

  const [step, setStep] = useState(1);
  const [catalogs, setCatalogs] = useState<InventoryCatalogs>();
  const [loading, setLoading] = useState(true);

  const [model, setModel] = useState<Model>({
    name: "",
    type: "Ingredient",
    categoryId: "",
    baseUomId: "",
    allowedUoms: [],
    trackStock: true,
    costingMethod: "",
    active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // post-save opening stock modal
  const [openStock, setOpenStock] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);

  useEffect(() => {
    //if (!companyId) return;
    setLoading(true);
    Promise.all([
      itemsApi.load(companyId).then(setCatalogs),
      isEdit ? itemsApi.get(companyId,id!).then((dto: any) => {
        // Map DTO -> model (assuming dto already contains ids needed)
        setModel({
          id: dto.id,
          name: dto.name,
          type: dto.type,
          categoryId: dto.categoryId ?? "",
          baseUomId: dto.baseUomId ?? "",
          allowedUoms: dto.allowedUoms ?? [],
          trackStock: dto.trackStock ?? true,
          costingMethod: dto.costingMethod ?? "",
          active: dto.active ?? true,
        });
      }) : Promise.resolve(),
    ])
      .catch(e => setError(e?.message ?? "Failed to load item data"))
      .finally(() => setLoading(false));
  }, [id]);

  const title = isEdit ? "Edit Item" : "New Item";
  const physical = isPhysical(model.type);

  const canGoStep2 = model.name.trim().length > 1 && !!model.type && !!model.categoryId;
  const canGoStep3 = !physical || !!model.baseUomId; // Service can skip units
  const canSave =
    canGoStep2 &&
    canGoStep3 &&
    (!physical || (!!model.baseUomId && validateUoms(model.allowedUoms)));

  const uoms = catalogs?.uoms ?? [];

  const baseUom = useMemo(() => uoms.find(u => u.id === model.baseUomId), [uoms, model.baseUomId]);

  function validateUoms(rows: AllowedUomRow[]) {
    // allow empty rows; if present must be > 0 and unique uomId
    const ids = rows.map(r => r.uomId).filter(Boolean);
    const uniq = new Set(ids);
    if (uniq.size !== ids.length) return false;
    if (rows.some(r => !r.uomId || !r.toBaseFactor || r.toBaseFactor <= 0)) return false;
    return true;
  }

  const save = async (openOpeningStockAfter: boolean) => {
    if (!companyId) return;
    setError(null);
    setSaving(true);

    try {
      // build payload for server
      const payload: any = {
        companyId,
        name: model.name.trim(),
        type: model.type,
        categoryId: model.categoryId,
        baseUomId: physical ? model.baseUomId : null,
        allowedUoms: physical ? model.allowedUoms : [],
        trackStock: physical ? model.trackStock : false,
        costingMethod: physical ? (model.costingMethod || null) : null,
        active: model.active ?? true,
      };

      if (isEdit) {
        await itemsApi.update(id!, payload);
        nav("..");
      } else {
        const res = await itemsApi.create(payload);
        // If your create returns the created id in body, use it.
        // If not, you can switch to: itemsApi.create(...).then(r=>r.data.id)
        const newId =
          res?.data?.id ||
          res?.data?.itemId ||
          res?.headers?.location?.split("/").pop() ||
          null;

        if (openOpeningStockAfter && newId) {
          setSavedItemId(newId);
          setOpenStock(true);
        } else {
          nav("..");
        }
      }
    } catch (e: any) {
      setError(e?.response?.data ?? e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !catalogs) return <div className="page">Loading…</div>;

  return (
    <div className="page max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <div className="text-sm text-slate-500">
            Register items with base unit, conversions, costing, and optional opening stock.
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn" onClick={() => nav("./dashboard")} disabled={saving}>Cancel</button>
          <button className="btn" onClick={() => save(false)} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {!isEdit && (
            <button className="btn btn-primary" onClick={() => save(true)} disabled={!canSave || saving}>
              {saving ? "Saving…" : "Save + Opening Stock"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {String(error)}
        </div>
      )}

      {/* Stepper */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StepChip label="1) Basics" active={step === 1} done={step > 1} onClick={() => setStep(1)} />
          <StepChip label="2) Units" active={step === 2} done={step > 2} onClick={() => setStep(2)} disabled={!canGoStep2} />
          <StepChip label="3) Inventory & Costing" active={step === 3} done={false} onClick={() => setStep(3)} disabled={!canGoStep2 || !canGoStep3} />
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Item name" required>
              <input
                className="input"
                placeholder="e.g., Flour, Mineral Water 500ml, Pizza Box"
                value={model.name}
                onChange={e => setModel({ ...model, name: e.target.value })}
              />
            </Field>

            <Field label="Item type" required>
              <select
                className="input"
                value={model.type}
                onChange={e => {
                  const type = e.target.value as ItemType;
                  setModel(m => ({
                    ...m,
                    type,
                    // Service should not track stock
                    trackStock: type === "Service" ? false : m.trackStock,
                  }));
                }}
              >
                {catalogs.itemTypes.map(t => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Category" required>
              <select
                className="input"
                value={model.categoryId}
                onChange={e => setModel({ ...model, categoryId: e.target.value })}
              >
                <option value="">Select category</option>
                {catalogs.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                className="input"
                value={(model.active ?? true) ? "Active" : "Inactive"}
                onChange={e => setModel({ ...model, active: e.target.value === "Active" })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={!canGoStep2} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="card p-5 space-y-5">
          {!physical ? (
            <div className="text-sm text-slate-600">
              Service items do not require units or conversions.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Base UOM" required>
                  <select
                    className="input"
                    value={model.baseUomId}
                    onChange={e => setModel({ ...model, baseUomId: e.target.value })}
                  >
                    <option value="">Select base unit</option>
                    {catalogs.uoms.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>

                  <div className="text-xs text-slate-500 mt-1">
                    Choose the smallest authoritative unit (e.g., G, ML, PCS).
                  </div>
                </Field>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">Tip</div>
                  <div className="text-xs text-slate-600 mt-1">
                    If you buy in KG but store in grams, set base to <b>G</b> and add KG conversion = 1000.
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    If you buy eggs in BOX(12), base = <b>PCS</b>, BOX(12) conversion = 12.
                  </div>
                </div>
              </div>

              <UomConversionGrid
                baseUomId={model.baseUomId}
                uoms={catalogs.uoms}
                rows={model.allowedUoms}
                onChange={(rows) => setModel({ ...model, allowedUoms: rows })}
              />

              {!validateUoms(model.allowedUoms) && model.allowedUoms.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Fix conversions: units must be unique and factors must be greater than 0.
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <button className="btn" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" disabled={!canGoStep3} onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="card p-5 space-y-5">
          {!physical ? (
            <div className="text-sm text-slate-600">
              Service items do not track stock or costing.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Stock tracking</div>
                <div className="text-xs text-slate-500 mb-3">Enable on-hand calculations and ledger updates.</div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!model.trackStock}
                    onChange={e => setModel({ ...model, trackStock: e.target.checked })}
                  />
                  Track stock for this item
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Costing</div>
                <div className="text-xs text-slate-500 mb-3">Controls how inventory cost is calculated.</div>

                <Field label="Costing method" required>
                  <select
                    className="input"
                    value={model.costingMethod ?? ""}
                    onChange={e => setModel({ ...model, costingMethod: e.target.value })}
                  >
                    <option value="">Select costing method</option>
                    {catalogs.costingMethods.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </Field>

                {baseUom && (
                  <div className="text-xs text-slate-500 mt-2">
                    Base unit: <span className="font-semibold">{baseUom.code}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn" onClick={() => setStep(2)}>Back</button>
            <div className="flex gap-2">
              <button className="btn" onClick={() => save(false)} disabled={!canSave || saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              {!isEdit && (
                <button className="btn btn-primary" onClick={() => save(true)} disabled={!canSave || saving}>
                  {saving ? "Saving…" : "Save + Opening Stock"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Opening stock modal */}
      {savedItemId && catalogs && model.baseUomId && (
        <OpeningStockModal
          open={openStock}
          onClose={() => {
            setOpenStock(false);
            nav("..");
          }}
          companyId={companyId!}
          itemId={savedItemId}
          itemName={model.name}
          uoms={catalogs.uoms}
          baseUomId={model.baseUomId}
        />
      )}
    </div>
  );
}

/** Small UI helpers */
function StepChip(props: {
  label: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { label, active, done, onClick, disabled } = props;
  const cls =
    "px-3 py-1.5 rounded-full border text-xs font-semibold " +
    (active
      ? "bg-slate-900 text-white border-slate-900"
      : done
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : "bg-white text-slate-600 border-slate-200") +
    (disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer");

  return (
    <button type="button" className={cls} onClick={disabled ? undefined : onClick}>
      {label}
    </button>
  );
}

function Field(props: { label: string; required?: boolean; children: any }) {
  return (
    <div>
      <div className="label">
        {props.label} {props.required ? <span className="text-rose-600">*</span> : null}
      </div>
      {props.children}
    </div>
  );
}
