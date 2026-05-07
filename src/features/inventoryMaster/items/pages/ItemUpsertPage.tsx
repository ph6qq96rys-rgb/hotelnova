import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";


import { useAppScope } from "../../../../app/useAppScope";
import { itemsApi } from "../api/itemsApi";
import type { InventoryCatalogs, ItemUomDto } from "../types";
import type { ItemType } from "../constants/itemTypes";
import UomConversionGrid from "../components/UomConversionGrid";

import type { CreateInventoryItemRequest } from "../types";
import { mapAllowedUomsToDto } from "../types";

/* ============================ GRN STYLE (copied) ============================ */

const pageWrap: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "18px 14px 28px",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: -0.3,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12.5,
  opacity: 0.75,
  color: "#0f172a",
};

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  padding: 14,
  background: "white",
  color: "#0f172a",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  paddingBottom: 10,
  marginBottom: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionHint: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: "#0f172a",
  opacity: 0.65,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#181822ff",
  opacity: 0.75,
  marginBottom: 6,
};

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: invalid ? "1px solid rgba(220, 38, 38, 0.9)" : "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
});

const errorStyle: React.CSSProperties = {
  color: "rgb(220, 38, 38)",
  fontSize: 12,
  marginTop: 6,
};

const noteStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11.5,
  opacity: 0.7,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "black",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

/* ============================ HELPERS ============================ */

function normalizeCatalogs(c: any): InventoryCatalogs {
  return {
    ...c,
    categories: c?.categories ?? c?._categories ?? [],
    costingMethods: c?.costingMethods ?? c?._costingMethods ?? [],
    itemTypes: c?.itemTypes ?? [],
    uoms: c?.uoms ?? [],
    items: c?.items ?? [],
  } as InventoryCatalogs;
}

function isPhysical(type: ItemType) {
  return type !== "Service";
}

function validateUoms(rows: ItemUomDto[]) {
  if (!rows?.length) return true; // allow empty
  const ids = rows.map((r) => r.uomId).filter(Boolean);
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) return false;
  if (rows.some((r) => !r.uomId || !r.toBaseFactor || r.toBaseFactor <= 0)) return false;
  return true;
}

function ensureBaseRow(rows: ItemUomDto[], baseUomId: string, uoms: any[]): ItemUomDto[] {
  if (!baseUomId) return rows;
  const hasBase = rows.some((r) => r.isBase && r.uomId === baseUomId);
  if (hasBase) return rows;

  const u = uoms.find((x: any) => x.id === baseUomId);
  if (!u) return rows;

  // prepend base row with factor 1
  return [
    {
      uomId: baseUomId,
      code: u.code,
      name: u.name,
      toBaseFactor: 1,
      isBase: true,
      isIssue: false,
      isActive: true,
    },
    ...rows,
  ];
}

/* ============================ PAGE ============================ */

type Model = {
  id?: string;

  name: string;
  sku: string | null;
  barcode: string | null;

  type: ItemType;
  categoryId: string;
  baseUomId: string;

  allowedUoms: ItemUomDto[];

  trackInventory: boolean;

  defaultCost: number | null;
  defaultPrice: number | null;

  costingMethod: string;
  active: boolean;
  reorderLevel:number;
};

export default function ItemUpsertPage() {
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const goToList = () => nav("/inventory/items");
 const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [catalogs, setCatalogs] = useState<InventoryCatalogs | null>(null);
  //const [loading, setLoading] = useState(true);

  const [model, setModel] = useState<Model>({
  name: "",
  sku: null,
  barcode: null,
  type: "Ingredient",
  categoryId: "",
  baseUomId: "",
  allowedUoms: [],
  trackInventory: true,
  defaultCost: null,
  defaultPrice: null,
  costingMethod: "",
  active: true,reorderLevel:1
});


  const [saving, setSaving] = useState(false);
  const [errorTop, setErrorTop] = useState<string | null>(null);

  const [touched, setTouched] = useState({
    name: false,
    categoryId: false,
    baseUomId: false,
    uoms: false,
  });

 useEffect(() => {
  if (!companyId) return;

  (async () => {
    const cRaw = await itemsApi.load(companyId);
    setCatalogs(normalizeCatalogs(cRaw));

    if (id) {
      const dto = await itemsApi.get(companyId, id);
     setModel({
        id: dto.id,
        name: dto.name ?? "",
          sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,

        type: dto.type ?? "Ingredient",
        categoryId: dto.categoryId ?? "",
        baseUomId: dto.baseUomId ?? "",

        allowedUoms: Array.isArray(dto.allowedUoms) ? dto.allowedUoms : [],

        trackInventory: dto.trackInventory ?? true,

        defaultCost: dto.defaultCost ?? null,
        defaultPrice: dto.defaultPrice ?? null,

        costingMethod: dto.costingMethod ?? "",
        active: dto.isActive ?? true,reorderLevel:1
});

   } else {
  setModel({
    name: "",
    sku: null,
    barcode: null,
    type: "Ingredient",
    categoryId: "",
    baseUomId: "",
    allowedUoms: [],
    trackInventory: true,
    defaultCost: null,
    defaultPrice: null,
    costingMethod: "",
    active: true,
    reorderLevel:1
  });
}

  })();
}, [companyId, id]);


  const itemTypes = catalogs?.itemTypes ?? [];
  const categories = (catalogs as any)?.categories ?? [];
  const uoms = catalogs?.uoms ?? [];

  const physical = isPhysical(model.type);

  const v = useMemo(() => {
    const nameOk = model.name.trim().length > 1;
    const catOk = !!model.categoryId;

    const baseOk = !physical || !!model.baseUomId;
    const uomsOk = !physical || validateUoms(model.allowedUoms);

    return { nameOk, catOk, baseOk, uomsOk };
  }, [model, physical]);

  const canSave = v.nameOk && v.catOk && v.baseOk && v.uomsOk;

  function set<K extends keyof Model>(key: K, value: Model[K]) {
    setModel((m) => ({ ...m, [key]: value }));
  }

  const save = async () => {
    if (!companyId) return;

    setTouched((t) => ({ ...t, name: true, categoryId: true, baseUomId: true, uoms: true }));

    if (!v.nameOk || !v.catOk) {
      setErrorTop("Please complete required fields.");
      return;
    }
    if (physical && !v.baseOk) {
      setErrorTop("Please select Base UOM.");
      return;
    }
    if (physical && !v.uomsOk) {
      setErrorTop("Fix unit conversions (unique units and factor > 0).");
      return;
    }

    const cost = model.defaultCost ? Number(model.defaultCost) : null;
    const price = model.defaultPrice ? Number(model.defaultPrice) : null;
    if (cost !== null && Number.isNaN(cost)) return setErrorTop("Default cost must be a number.");
    if (price !== null && Number.isNaN(price)) return setErrorTop("Default price must be a number.");

    setErrorTop(null);
    setSaving(true);
    

    try {
      const normalizedRows = physical
        ? ensureBaseRow(model.allowedUoms, model.baseUomId, uoms as any)
        : [];

      const dto: CreateInventoryItemRequest = {
        name: model.name.trim(),
        sku: model.sku?.trim() ? model.sku.trim() : null,
        barcode: model.barcode?.trim() ? model.barcode.trim() : null,
        categoryId: model.categoryId || null,
        baseUomId: physical ? model.baseUomId : ("" as any), // backend requires; if Service, you likely want a different endpoint/DTO
        type: model.type,
        allowedUoms: physical ? mapAllowedUomsToDto(normalizedRows) : [],
        trackInventory: physical ? !!model.trackInventory : false,
        defaultCost: cost,
        defaultPrice: price,
        isActive: !!model.active,
        reorderLevel:model.reorderLevel
      };
    const res = isEdit
          ? await itemsApi.update(companyId, id, dto)
          : await itemsApi.create(companyId, dto);


      if(!res) throw new Error("Invalid response from server.");

      goToList(); // match your upsert UX
      //nav(`/inventory/items/${newId}`)
       nav(`/inventory/items`);
    } catch (e: any) {
      setErrorTop(e?.response?.data?.message ?? e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Select a company</div>
          <div style={{ ...noteStyle, marginTop: 6 }}>Choose your company context to create items.</div>
        </div>
      </div>
    );
  }

  if (!catalogs) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={headerRow}>
        <div>
          <div style={titleStyle}>New Item</div>
          <div style={subtitleStyle}>Register items with base unit and conversions.</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={secondaryBtn} onClick={goToList} disabled={saving}>
            Cancel
          </button>
          <button style={primaryBtn} onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>

      {/* Top error */}
      {errorTop && (
        <div
          style={{
            ...cardStyle,
            marginTop: 10,
            border: "1px solid rgba(220,38,38,0.35)",
            background: "rgba(220,38,38,0.06)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 12, color: "rgb(220,38,38)" }}>Action needed</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "rgb(220,38,38)" }}>{String(errorTop)}</div>
        </div>
      )}

      {/* Basics */}
      <div style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <div style={sectionTitle}>Basics</div>
            <div style={sectionHint}>Item identity and classification.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>
              Item name <span style={{ color: "rgb(220,38,38)" }}>*</span>
            </label>
            <input
              style={inputStyle(touched.name && !v.nameOk)}
              value={model.name}
              placeholder="e.g., Flour, Mineral Water 500ml, Pizza Box"
              onChange={(e) => set("name", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            {touched.name && !v.nameOk && <div style={errorStyle}>Enter a name (min 2 characters).</div>}
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>SKU</label>
            <input style={inputStyle(false)} value={model.sku??""} onChange={(e) => set("sku", e.target.value)} />
            <div style={noteStyle}>Optional.</div>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>Barcode</label>
            <input style={inputStyle(false)} value={model.barcode??""} onChange={(e) => set("barcode", e.target.value)} />
            <div style={noteStyle}>Optional.</div>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>
              Item type <span style={{ color: "rgb(220,38,38)" }}>*</span>
            </label>
            <select
              style={inputStyle(false)}
              value={model.type}
              onChange={(e) => {
                const type = e.target.value as ItemType;
                setModel((m) => ({
                  ...m,
                  type,
                  trackInventory: type === "Service" ? false : m.trackInventory,
                  baseUomId: type === "Service" ? "" : m.baseUomId,
                  allowedUoms: type === "Service" ? [] : m.allowedUoms,
                }));
              }}
            >
              {itemTypes.map((t: any) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>
              Category <span style={{ color: "rgb(220,38,38)" }}>*</span>
            </label>
            <select
              style={inputStyle(touched.categoryId && !v.catOk)}
              value={model.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, categoryId: true }))}
            >
              <option value="">Select category</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {touched.categoryId && !v.catOk && <div style={errorStyle}>Select a category.</div>}
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label style={labelStyle}>Status</label>
            <select
              style={inputStyle(false)}
              value={model.active ? "Active" : "Inactive"}
              onChange={(e) => set("active", e.target.value === "Active")}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Units */}
      <div style={cardStyle}>
        <div style={sectionHeader}>
          <div>
            <div style={sectionTitle}>Units</div>
            <div style={sectionHint}>Define base unit and conversions for purchasing/issuing.</div>
          </div>
        </div>

        {!physical ? (
          <div style={{ fontSize: 12.5, opacity: 0.75 }}>Service items do not require units or conversions.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
              <div style={{ gridColumn: "span 6" }}>
                <label style={labelStyle}>
                  Base UOM <span style={{ color: "rgb(220,38,38)" }}>*</span>
                </label>
                <select
                  style={inputStyle(touched.baseUomId && !v.baseOk)}
                  value={model.baseUomId}
                  onChange={(e) => set("baseUomId", e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, baseUomId: true }))}
                >
                  <option value="">Select base unit</option>
                  {uoms.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.name}
                    </option>
                  ))}
                </select>
                {touched.baseUomId && !v.baseOk && <div style={errorStyle}>Base UOM is required.</div>}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, marginBottom: 8 }}>
                Allowed UOMs & Conversions
              </div>

              <UomConversionGrid
                baseUomId={model.baseUomId}
                uoms={uoms as any}
                rows={model.allowedUoms}
                onChange={(rows) => {
                  set("allowedUoms", rows);
                  setTouched((t) => ({ ...t, uoms: true }));
                }}
              />

              {touched.uoms && !v.uomsOk && model.allowedUoms.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(245,158,11,0.35)",
                    background: "rgba(245,158,11,0.10)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(120,53,15,1)" }}>Fix conversions</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "rgba(120,53,15,1)" }}>
                    Units must be unique and factors must be greater than 0.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
