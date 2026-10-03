// src/features/production/pages/ProductionBatchPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RemovePlannedBatch } from "../../../components/RemovePlannedBatch";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import { useI18n } from "../../../i18n";
import { http } from "../../../api/http";
import {
  ApiError,
  createScopedProductionBatchesApi,
  type ProductionBatchDto,
  type ProductionBatchListItemDto,
  type CreateProductionBatchRequest,
  type UpdateProductionLinesRequest,
} from "../api/productionBatchesApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import { fetchInventoryItems, fetchProductionOutputItems, fetchUoms } from "../api/lookups";
import type { InventoryItemLite, UomLite } from "../api/lookups";
import { productionRecipesApi } from "../api/recipesApi";
import type { LocationLite, MenuItemLite, ProductionLineVm, RecipeDto } from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import "../layout/production.css";

//  Constants 

const BatchStatus = { Draft: 2, Approved: 3, Posted: 4, Reversed: 5, Cancelled: 6 } as const;
let translateProductionText = (text: string) => text;

type OutputKind = "good" | "bulk" | "waste" | "rework";

type ProductionOutputVm = {
  id?: string;
  lineNo: number;
  itemId: string;
  itemName: string;
  uomId?: string | null;
  uomName?: string | null;
  outputLocationId?: string | null;
  qty: number | string;
  plannedQuantity?: number | string | null;
  actualQuantity?: number | string | null;
  portionSize?: number | string | null;
  portionUomId?: string | null;
  outputWeightBase?: number | null;
  outputCategory?: string | null;
  isRemainingBulk?: boolean;
  isWaste?: boolean;
  isRework?: boolean;
  batchNo?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
};

//  Helpers 

const hasText       = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const safeNum       = (value: unknown, fallback = 0): number => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nonEmptyGuid  = (v: string | null | undefined): string | null =>
  (!v || v === "00000000-0000-0000-0000-000000000000") ? null : v;

function normalizeBatchId(value: unknown): string | null {
  if (typeof value === "string") {
    const candidate = value.trim();
    return guidPattern.test(candidate) ? candidate : null;
  }

  if (value && typeof value === "object") {
    const candidate = value as { id?: unknown; batchId?: unknown };
    return normalizeBatchId(candidate.id) ?? normalizeBatchId(candidate.batchId);
  }

  return null;
}

function requireBatchId(value: unknown): string {
  const id = normalizeBatchId(value);
  if (!id) throw new Error(translateProductionText("Production batch id is invalid. Refresh the batch and try again."));
  return id;
}


function text(value: unknown): string {
  return String(value ?? "").trim();
}

function locationIdOf(value: any): string {
  return text(value?.stockLocationId ?? value?.StockLocationId ?? value?.id ?? value?.Id);
}

function locationTypeOf(value: any): string {
  const type = text(value?.locationType ?? value?.type).replace(/[\s_-]+/g, "").toLowerCase();
  return type === "6" ? "transit" : type === "7" ? "waste" : type;
}

function boolOf(value: any, ...keys: string[]): boolean {
  return keys.some((key) => value?.[key] === true);
}

function locationLabel(value: any): string {
  const name = text(value?.name ?? value?.stockLocationName);
  const code = text(value?.code).toUpperCase();
  return code ? `${name} (${code})` : name;
}

function isIssueLocation(value: any): boolean {
  const type = locationTypeOf(value);
  return (
    value?.isActive !== false &&
    locationIdOf(value) !== "" &&
    value?.canIssue === true &&
    type !== "waste" &&
    type !== "transit"
  );
}

function isOutputLocation(value: any): boolean {
  const type = locationTypeOf(value);
  return (
    value?.isActive !== false &&
    locationIdOf(value) !== "" &&
    value?.canReceive === true &&
    type !== "waste" &&
    type !== "transit"
  );
}

function normaliseStatus(status: unknown): number {
  if (typeof status === "string") return BatchStatus[status as keyof typeof BatchStatus] ?? -1;
  return (status as number) ?? -1;
}

const isDraft       = (batch: ProductionBatchDto | null) => batch ? normaliseStatus(batch.status) === BatchStatus.Draft : false;
const isAbortError  = (e: unknown) => (e as any)?.name === "AbortError";

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function extractApiError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.errors) return Object.entries(e.errors).flatMap(([f, ms]) => ms.map((m) => `${f}: ${m}`)).join("\n");
    return e.detail ?? e.title ?? fallback;
  }
  const err = e as any;
  return err?.response?.data?.message ?? err?.response?.data?.title ?? err?.message ?? fallback;
}

function nextLineNo(lines: ProductionLineVm[]): number {
  return lines.reduce((max, l) => Math.max(max, l.lineNo ?? 0), 0) + 1;
}

function normaliseSource(value: unknown): "recipe" | "manual" {
  return value === "recipe" || value === 2 ? "recipe" : "manual";
}

function mapBatchInputs(batch: ProductionBatchDto): ProductionLineVm[] {
  return (batch.inputs ?? []).map((line, i) => ({
    id:           line.id ?? `${line.lineNo ?? i + 1}-${i}`,
    lineNo:       line.lineNo ?? i + 1,
    itemId:       line.itemId ?? "",
    itemName:     "",
    uomId:        line.uomId ?? null,
    uomName:      null,
    qty:          String(line.qty ?? 1),
    qtyBase:      line.qtyBase ?? null,
    source:       normaliseSource(line.source),
    recipeLineId: line.recipeLineId ?? null,
  }));
}

function mapBatchOutputs(batch: ProductionBatchDto): ProductionOutputVm[] {
  return (batch.outputs ?? []).map((line, i) => {
    const actualQuantity = line.actualQuantity ?? line.qty ?? 1;
    const portionSize = line.portionSize ?? null;
    return {
      id: line.id ?? String(line.lineNo ?? i + 1) + "-out-" + String(i),
      lineNo: line.lineNo ?? i + 1,
      itemId: line.itemId ?? "",
      itemName: line.itemName ?? "",
      uomId: line.uomId ?? null,
      uomName: line.uomName ?? line.uomCode ?? null,
      outputLocationId: line.outputLocationId ?? batch.outputLocationId ?? null,
      qty: String(actualQuantity),
      plannedQuantity: line.plannedQuantity ?? actualQuantity,
      actualQuantity,
      portionSize,
      portionUomId: line.portionUomId ?? null,
      outputWeightBase: line.outputWeightBase ?? (portionSize ? portionSize * safeNum(actualQuantity, 0) : null),
      outputCategory: line.outputCategory ?? "Retail",
      isRemainingBulk: line.isRemainingBulk ?? false,
      isWaste: line.isWaste ?? false,
      isRework: line.isRework ?? false,
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      notes: line.notes ?? null,
    };
  });
}

function outputWeightOf(line: ProductionOutputVm): number {
  const explicitWeight = safeNum(line.outputWeightBase, 0);
  if (explicitWeight > 0) return explicitWeight;
  return safeNum(line.portionSize, 0) * safeNum(line.actualQuantity ?? line.qty, 0);
}
function uomLabel(uom: UomLite): string {
  return uom.code ? String(uom.name ?? uom.code) + " (" + uom.code + ")" : String(uom.name ?? uom.id);
}

function preferredEachUom(uoms: UomLite[]): string | null {
  return uoms.find((u) => ["ea", "each", "pcs", "pc"].includes(String(u.code || u.name || "").toLowerCase()))?.id ?? uoms[0]?.id ?? null;
}

function outputKindOf(line: Pick<ProductionOutputVm, "isRemainingBulk" | "isWaste" | "isRework">): OutputKind {
  if (line.isWaste) return "waste";
  if (line.isRework) return "rework";
  if (line.isRemainingBulk) return "bulk";
  return "good";
}

function outputKindPatch(kind: OutputKind): Pick<ProductionOutputVm, "isRemainingBulk" | "isWaste" | "isRework" | "outputCategory"> {
  return {
    isRemainingBulk: kind === "bulk",
    isWaste: kind === "waste",
    isRework: kind === "rework",
    outputCategory: kind === "good" ? "Retail" : kind === "bulk" ? "Bulk balance" : kind === "waste" ? "Waste" : "Rework",
  };
}
type RecipeStandardLine = {
  recipeLineId: string;
  itemId: string;
  uomId: string;
  qtyPerOutputUnit: number;
};

function recipeStandardLines(recipe: RecipeDto | null): RecipeStandardLine[] {
  return (recipe?.lines ?? [])
    .map((line: any) => ({
      recipeLineId: text(line?.id),
      itemId: text(line?.itemId),
      uomId: text(line?.uomId),
      qtyPerOutputUnit: safeNum(line?.qty ?? line?.qtyPerMenuUnit, 0) / Math.max(1, safeNum(recipe?.outputQuantity, 1)),
    }))
    .filter((line) => line.recipeLineId && line.itemId && line.uomId && line.qtyPerOutputUnit > 0);
}

function calculateExpectedOutputFromRecipeInputs(
  inputs: ProductionLineVm[],
  standards: RecipeStandardLine[],
  fallbackPlannedQty: number
): number {
  if (!standards.length) return fallbackPlannedQty;

  const actualByRecipeLine = new Map<string, number>();
  for (const input of inputs) {
    const recipeLineId = text(input.recipeLineId);
    if (!recipeLineId) continue;
    actualByRecipeLine.set(recipeLineId, (actualByRecipeLine.get(recipeLineId) ?? 0) + safeNum(input.qty, 0));
  }

  const outputRatios = standards
    .map((standard) => {
      const actualQty = actualByRecipeLine.get(standard.recipeLineId);
      return actualQty && actualQty > 0 ? actualQty / standard.qtyPerOutputUnit : null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!outputRatios.length) return fallbackPlannedQty;
  return Math.min(...outputRatios);
}

function preferredWeightUom(uoms: UomLite[]): string | null {
  return uoms.find((u) => ["g", "gram", "grams"].includes(String(u.code || u.name || "").toLowerCase()))?.id
    ?? uoms.find((u) => ["kg", "kilogram", "kilograms"].includes(String(u.code || u.name || "").toLowerCase()))?.id
    ?? uoms[0]?.id
    ?? null;
}
async function fetchLocations(companyId: string, branchId: string): Promise<LocationLite[]> {
  return stockLocationsApi.list(companyId, branchId);
}

async function fetchMenuItems(companyId: string, branchId: string): Promise<MenuItemLite[]> {
  const res = await http.get<MenuItemLite[]>(
    `/companies/${companyId}/branches/${branchId}/menu/items`,
    { params: { activeOnly: true } }
  );
  return res.data ?? [];
}

function batchStatusLabel(status: number, tx: (text: string) => string): string {
  if (status === BatchStatus.Cancelled) return tx("Cancelled");
  if (status === BatchStatus.Posted)   return tx("Posted");
  if (status === BatchStatus.Reversed) return tx("Reversed");
  if (status === BatchStatus.Approved) return tx("Approved");
  return tx("Draft");
}

//  Sub-components 

function ScopeGuard({ message }: { message: string }) {
  return (
    <div className="p-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div className="p-guard">{message}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="p-field">
      <label className="p-field__label">
        {translateProductionText(label)}{required && <span className="p-field__required"> *</span>}
      </label>
      {children}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-metric">
      <div className="p-metric__label">{translateProductionText(label)}</div>
      <div className="p-metric__value">{value}</div>
    </div>
  );
}

//  Component 

export default function ProductionBatchPage() {
  const { tx } = useI18n();
  translateProductionText = tx;
  const erpNavigation = useErpNavigate() as any;
  const nav = useMemo(() => {
    return (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === "number") {
        if (typeof erpNavigation?.back === "function") return erpNavigation.back();
        if (typeof erpNavigation?.navigate === "function") return erpNavigation.navigate(to);
        return window.history.go(to);
      }

      if (typeof erpNavigation === "function") return erpNavigation(to, options);
      if (typeof erpNavigation?.navigate === "function") return erpNavigation.navigate(to, options);
      if (typeof erpNavigation?.to === "function") return erpNavigation.to(to, options);
      if (typeof erpNavigation?.go === "function") return erpNavigation.go(to, options);
      window.location.assign(to);
    };
  }, [erpNavigation]);
  const { batchId: routeBatchId } = useParams<{ batchId?: string }>();
  const location = useLocation();
  const [sp] = useSearchParams();

  const recipeIdFromQuery   = nonEmptyGuid(sp.get("recipeId"));
  const menuItemIdFromQuery = nonEmptyGuid(sp.get("menuItemId"));

  const scope     = useAppScope();
  const companyId = scope.companyId?.trim() ?? "";
  const branchId  = scope.branchId?.trim()  ?? "";
  const companyLabel = scope.companyName?.trim() || "Selected company";
  const branchLabel = scope.branchName?.trim() || "Selected branch";
  const hasScope  = Boolean(companyId && branchId);

  const initialBatchId = normalizeBatchId(routeBatchId);
  const batchIdRef    = useRef<string | null>(initialBatchId);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(initialBatchId);
  const isCreatePage = location.pathname.replace(/\/+$/, "").endsWith("/production/batches/new");
  const isRegisterPage = !hasText(routeBatchId) && !isCreatePage;
  const isNewPage = isCreatePage;

  const api = useMemo(
    () => hasScope ? createScopedProductionBatchesApi(companyId, branchId) : null,
    [hasScope, companyId, branchId]
  );

  //  State 

  const [locations,     setLocations]     = useState<LocationLite[]>([]);
  const [menuItems,     setMenuItems]     = useState<MenuItemLite[]>([]);
  const [inventoryItems,setInventoryItems]= useState<InventoryItemLite[]>([]);
  const [outputItems,   setOutputItems]   = useState<InventoryItemLite[]>([]);
  const [uoms,          setUoms]          = useState<UomLite[]>([]);
  const [catalogLoading,setCatalogLoading]= useState(false);
  const [catalogReady,  setCatalogReady]  = useState(false);

  const [batch,         setBatch]         = useState<ProductionBatchDto | null>(null);
  const [batchRows,     setBatchRows]     = useState<ProductionBatchListItemDto[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [inputs,        setInputs]        = useState<ProductionLineVm[]>([]);
  const [outputs,       setOutputs]       = useState<ProductionOutputVm[]>([]);
  const [activeRecipe,  setActiveRecipe]  = useState<RecipeDto | null>(null);

  const [menuItemId,      setMenuItemId]      = useState(menuItemIdFromQuery ?? "");
  const [recipeId,        setRecipeId]        = useState<string | null>(recipeIdFromQuery);
  const [plannedQty,      setPlannedQty]      = useState<number>(1);
  const [issueLocationId, setIssueLocationId] = useState("");
  const [outputLocationId,setOutputLocationId]= useState("");

  const [loading,     setLoading]     = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  //  Derived 

  const hasBatch = Boolean(activeBatchId);
  const canEdit  = !hasBatch || batch === null || isDraft(batch);

  const menuById = useMemo(() => new Map(menuItems.map((m) => [m.id, m.name])), [menuItems]);
  const itemById = useMemo(() => new Map(inventoryItems.map((i) => [i.id, i])), [inventoryItems]);
  const outputItemById = useMemo(() => new Map(outputItems.map((i) => [i.id, i])), [outputItems]);
  const uomById = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms]);
  const menuItemLabel = menuById.get(menuItemId) ?? "";
  const recipeLabel = menuItemLabel || (recipeId ? "Selected production recipe" : "");
  const recipeStandards = useMemo(() => recipeStandardLines(activeRecipe), [activeRecipe]);

  const expectedOutputWeight = useMemo(
    () => calculateExpectedOutputFromRecipeInputs(inputs, recipeStandards, safeNum(plannedQty, 0)),
    [inputs, recipeStandards, plannedQty]
  );
  const totalPortionedWeight = useMemo(() => outputs.reduce((s, l) => s + outputWeightOf(l), 0), [outputs]);
  const totalOutputUnits = useMemo(() => outputs.reduce((s, l) => s + safeNum(l.actualQuantity ?? l.qty, 0), 0), [outputs]);
  const hasPortionedOutputs = useMemo(() => outputs.some((line) => outputWeightOf(line) > 0 || safeNum(line.portionSize, 0) > 0 || Boolean(line.portionUomId)), [outputs]);
  const totalAccountedOutput = useMemo(() => hasPortionedOutputs ? totalPortionedWeight : totalOutputUnits, [hasPortionedOutputs, totalPortionedWeight, totalOutputUnits]);
  const accountedOutputLabel = hasPortionedOutputs ? "Portioned Weight" : "Accounted Output";
  const outputWeightVariance = useMemo(() => expectedOutputWeight - totalAccountedOutput, [expectedOutputWeight, totalAccountedOutput]);
  const outputOverTolerance = useMemo(() => expectedOutputWeight > 0 && totalAccountedOutput > expectedOutputWeight * 1.05, [expectedOutputWeight, totalAccountedOutput]);

  const issueLocations = useMemo(() => locations.filter(isIssueLocation), [locations]);
  const outputLocations = useMemo(() => locations.filter(isOutputLocation), [locations]);

  const rawStatus  = batch ? normaliseStatus(batch.status) : BatchStatus.Draft;
  const statusLabel= batchStatusLabel(rawStatus, tx);
  const statusBadge= rawStatus === BatchStatus.Posted    ? "p-badge--posted"
                   : rawStatus === BatchStatus.Reversed  ? "p-badge--reversed"
                   : rawStatus === BatchStatus.Approved  ? "p-badge--approved"
                   : "p-badge--draft";

  //  Sync form from batch 

  const syncFormFromBatch = useCallback((dto: ProductionBatchDto) => {
    setBatch(dto);
    setInputs(mapBatchInputs(dto));
    setOutputs(mapBatchOutputs(dto));
    setIssueLocationId(dto.issueLocationId ?? "");
    setOutputLocationId(dto.outputLocationId ?? "");
    setPlannedQty(safeNum(dto.plannedQty, 1));
    const rid = nonEmptyGuid(dto.recipeId);
    if (rid) setRecipeId(rid);
    const mid = nonEmptyGuid(dto.menuItemId);
    if (mid) setMenuItemId(mid);
  }, []);

  const reloadBatch = useCallback(
    async (batchId?: unknown, signal?: AbortSignal) => {
      const id = normalizeBatchId(batchId) ?? normalizeBatchId(batchIdRef.current) ?? normalizeBatchId(activeBatchId);
      if (!api || !id) return;
      batchIdRef.current = id;
      setActiveBatchId(id);
      setLoading(true); setError(null);
      try {
        const dto = await api.get(id, signal);
        syncFormFromBatch(dto);
      } catch (e) {
        if (!isAbortError(e)) setError(extractApiError(e, "Failed to reload batch."));
      } finally {
        setLoading(false);
      }
    },
    [api, activeBatchId, syncFormFromBatch]
  );

  //  Load catalog 

  useEffect(() => {
    if (!hasScope) { setLocations([]); setMenuItems([]); setInventoryItems([]); setOutputItems([]); setUoms([]); setCatalogReady(false); return; }
    const ctrl = new AbortController();
    setCatalogReady(false); setCatalogLoading(true); setError(null);

    Promise.all([
      fetchLocations(companyId, branchId),
      fetchMenuItems(companyId, branchId),
      fetchInventoryItems(companyId, branchId, ""),
      fetchProductionOutputItems(companyId, branchId),
      fetchUoms(companyId),
    ])
      .then(([locs, menus, items, outputRows, uomRows]) => {
        if (ctrl.signal.aborted) return;
        const activeLocs  = locs.filter((l: any) => l.isActive !== false);
        const issueLocs = activeLocs.filter(isIssueLocation);
        const outputLocs = activeLocs.filter(isOutputLocation);
        const activeMenus = menus.filter((m) => m.isActive !== false);
        const activeItems = items.filter((i) => i.isActive !== false);
        setLocations(activeLocs); setMenuItems(activeMenus); setInventoryItems(activeItems); setOutputItems((outputRows ?? []).filter((i) => i.isActive !== false)); setUoms((uomRows ?? []).filter((u) => u.isActive !== false));
        setCatalogReady(true);
        if (isNewPage) {
          setIssueLocationId((prev) => issueLocs.some((l: any) => locationIdOf(l) === prev) ? prev : locationIdOf(issueLocs[0]));
          setOutputLocationId((prev) => outputLocs.some((l: any) => locationIdOf(l) === prev) ? prev : locationIdOf(outputLocs[0]));
          if (menuItemIdFromQuery) setMenuItemId(menuItemIdFromQuery);
          else setMenuItemId((prev) => activeMenus.some((m) => m.id === prev) ? prev : activeMenus[0]?.id ?? "");
          if (recipeIdFromQuery) setRecipeId(recipeIdFromQuery);
        }
      })
      .catch((e) => { if (!ctrl.signal.aborted) setError(extractApiError(e, "Failed to load catalogs.")); })
      .finally(() => { if (!ctrl.signal.aborted) setCatalogLoading(false); });

    return () => ctrl.abort();
  }, [hasScope, companyId, branchId, isNewPage, menuItemIdFromQuery, recipeIdFromQuery]);

  //  Load register

  useEffect(() => {
    if (!api || !isRegisterPage) {
      setBatchRows([]);
      return;
    }

    const ctrl = new AbortController();
    setRegisterLoading(true);
    setError(null);

    api.list(undefined, ctrl.signal)
      .then((rows) => {
        if (!ctrl.signal.aborted) setBatchRows(rows ?? []);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(extractApiError(e, "Failed to load production batches."));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setRegisterLoading(false);
      });

    return () => ctrl.abort();
  }, [api, isRegisterPage]);

  //  Load existing batch 

  useEffect(() => {
    const id = normalizeBatchId(routeBatchId);
    if (!id || !api || !catalogReady) return;
    batchIdRef.current = id;
    setActiveBatchId(id);
    const ctrl = new AbortController();
    setLoading(true); setError(null);
    api.get(id, ctrl.signal)
      .then(syncFormFromBatch)
      .catch((e) => { if (!ctrl.signal.aborted) setError(extractApiError(e, tx("Failed to load batch."))); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [routeBatchId, api, catalogReady, syncFormFromBatch]);

  //  Auto-resolve recipe from menu item 

  useEffect(() => {
    if (!companyId || !menuItemId) {
      setActiveRecipe(null);
      if (!recipeIdFromQuery) setRecipeId(null);
      return;
    }

    let cancelled = false;

    productionRecipesApi.getByMenuItem(companyId, menuItemId, { mode: "production" })
      .then((recipe) => {
        if (cancelled) return;

        const mode = String((recipe as any)?.mode ?? "directSale").toLowerCase();
        if (mode === "directsale" || mode === "direct-sale" || mode === "direct_sale") {
          setActiveRecipe(null);
          setRecipeId(null);
          setError(tx("This menu item uses a direct-sale recipe. It is consumed at POS sale and does not use production batches."));
          return;
        }

        const rid = nonEmptyGuid(recipe.id);
        if (!rid) {
          setActiveRecipe(null);
          setRecipeId(null);
          setError(tx("This menu item does not have an active Production / Stocked Output recipe."));
          return;
        }

        if (!recipe.isActive) {
          setActiveRecipe(null);
          setRecipeId(null);
          setError(tx("The selected recipe is inactive. Activate it in the Recipe Editor first."));
        } else {
          setActiveRecipe(recipe);
          setRecipeId(recipeIdFromQuery ?? rid);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveRecipe(null);
          if (!recipeIdFromQuery) setRecipeId(null);
        }
      });

    return () => { cancelled = true; };
  }, [companyId, menuItemId, recipeIdFromQuery]);

  //  Line operations 

  const updateLine       = (lineNo: number, patch: Partial<ProductionLineVm>) =>
    setInputs((prev) => prev.map((l) => l.lineNo === lineNo ? { ...l, ...patch } : l));

  const selectInputItem  = (lineNo: number, itemId: string) => {
    const item = itemById.get(itemId);
    updateLine(lineNo, { itemId, itemName: item?.name ?? "", uomId: item?.baseUomId ?? item?.uomId ?? null, uomName: item?.baseUomName ?? item?.uomName ?? null });
  };

  const addManualLine    = () => setInputs((prev) => [
    ...prev,
    { id: `new-${Date.now()}`, lineNo: nextLineNo(prev), itemId: "", itemName: "", qty: "1", qtyBase: null, source: "manual", uomId: null, uomName: null, recipeLineId: null },
  ]);

  const removeLine       = (lineNo: number) => setInputs((prev) => prev.filter((l) => l.lineNo !== lineNo));

  const updateOutputLine = (lineNo: number, patch: Partial<ProductionOutputVm>) =>
    setOutputs((prev) => prev.map((l) => l.lineNo === lineNo ? { ...l, ...patch } : l));

  const selectOutputItem = (lineNo: number, itemId: string) => {
    const item = outputItemById.get(itemId);
    updateOutputLine(lineNo, {
      itemId,
      itemName: item?.name ?? "",
      uomId: item?.baseUomId ?? item?.uomId ?? preferredEachUom(uoms),
      uomName: item?.baseUomName ?? item?.uomName ?? null,
    });
  };

  const addOutputLine = () => setOutputs((prev) => {
    const lineNo = prev.reduce((max, l) => Math.max(max, l.lineNo ?? 0), 0) + 1;
    return [...prev, {
      id: "new-output-" + Date.now(),
      lineNo,
      itemId: "",
      itemName: "",
      uomId: preferredEachUom(uoms),
      uomName: null,
      outputLocationId: outputLocationId || (outputLocations[0] ? locationIdOf(outputLocations[0]) : null),
      qty: 1,
      plannedQuantity: 1,
      actualQuantity: 1,
      portionSize: 0,
      portionUomId: preferredWeightUom(uoms),
      outputWeightBase: 0,
      ...outputKindPatch("good"),
    }];
  });
  const removeOutputLine = (lineNo: number) => setOutputs((prev) => prev.filter((l) => l.lineNo !== lineNo));


  //  Validation 

  function validateCreate(): string | null {
    if (!nonEmptyGuid(recipeId))     return tx("Production recipe is required.");
    if (!hasText(menuItemId))        return tx("Menu item is required.");
    if (!hasText(issueLocationId))   return tx("Issue location is required.");
    if (!hasText(outputLocationId))  return tx("Output location is required.");
    if (issueLocationId === outputLocationId) return tx("Issue and output locations cannot be the same.");
    if (!issueLocations.some((l: any) => locationIdOf(l) === issueLocationId)) return tx("Select an active stock location that can issue raw materials.");
    if (!outputLocations.some((l: any) => locationIdOf(l) === outputLocationId)) return tx("Select an active stock location that can receive production output.");
    if (!plannedQty || plannedQty <= 0) return tx("Planned quantity must be greater than zero.");
    return null;
  }

  //  Actions 

  async function createBatch() {
    if (!api) return setError(tx("Select company and branch first."));
    const err = validateCreate(); if (err) return setError(err);
    setLoading(true); setError(null);
    try {
      const req = {
        menuItemId:       menuItemId.trim(),
        plannedQty:       safeNum(plannedQty, 1),
        issueLocationId:  issueLocationId.trim(),
        outputLocationId: outputLocationId.trim(),
        producedAtUtc:    new Date().toISOString(),
        notes:            null,
      } as CreateProductionBatchRequest;

      const newId = requireBatchId(await api.create(req));
      batchIdRef.current = newId;
      setActiveBatchId(newId);
      if (isNewPage) nav(`/production/batches/${newId}`, { replace: true });
      await reloadBatch(newId);
    } catch (e) {
      setError(extractApiError(e, tx("Failed to create batch.")));
    } finally {
      setLoading(false);
    }
  }

  async function applyRecipe() {
    const id = normalizeBatchId(batchIdRef.current) ?? normalizeBatchId(activeBatchId);
    if (!api || !id) return setError(tx("Create or open a batch first."));
    if (batch && (issueLocationId !== batch.issueLocationId || outputLocationId !== batch.outputLocationId))
      return setError(tx("Save batch location changes before applying the recipe."));
    if (batch?.companyId && batch.companyId !== companyId) return setError(tx("This production batch belongs to another company. Reopen it from the correct company workspace."));
    if (batch?.branchId && batch.branchId !== branchId) return setError(tx("This production batch belongs to another branch. Reopen it from the correct branch before saving."));
    if (!nonEmptyGuid(recipeId))   return setError(tx("Select a recipe first."));
    if (plannedQty <= 0)           return setError(tx("Planned quantity must be greater than zero."));
    setLoading(true); setError(null);
    try {
      await api.applyRecipe(id, { recipeId: nonEmptyGuid(recipeId)!, outputQty: safeNum(plannedQty, 1), replaceExistingInputs: true });
      await reloadBatch(id);
    } catch (e) {
      setError(extractApiError(e, tx("Failed to apply recipe.")));
    } finally {
      setLoading(false);
    }
  }

  async function saveLines() {
    const id = normalizeBatchId(batchIdRef.current) ?? normalizeBatchId(activeBatchId);
    if (!api || !id) return setError(tx("Create or open a batch first."));
    if (batch?.companyId && batch.companyId !== companyId) return setError(tx("This production batch belongs to another company. Reopen it from the correct company workspace."));
    if (batch?.branchId && batch.branchId !== branchId) return setError(tx("This production batch belongs to another branch. Reopen it from the correct branch before saving."));
    if (!outputs.length) return setError(tx("Add at least one portion output before saving."));
    if (!issueLocations.some((l: any) => locationIdOf(l) === issueLocationId))
      return setError(tx("Select an active stock location that can issue raw materials."));
    if (!outputLocations.some((l: any) => locationIdOf(l) === outputLocationId))
      return setError(tx("Select an active stock location that can receive production output."));
    if (issueLocationId === outputLocationId)
      return setError(tx("Issue and output locations cannot be the same."));

    const badLine = inputs.find((l) => !l.itemId || !l.uomId || safeNum(l.qty, 0) <= 0);
    if (badLine) return setError(tx("Every input line needs an item, UOM, and quantity > 0. Re-select the item to auto-fill UOM."));

    const invalidOutput = outputs
      .slice()
      .sort((a, b) => a.lineNo - b.lineNo)
      .find((line) => {
        const kind = outputKindOf(line);
        const hasPortionControls = outputWeightOf(line) > 0 || safeNum(line.portionSize, 0) > 0 || Boolean(line.portionUomId);
        if (!line.itemId || !line.uomId || !hasText(line.outputLocationId)) return true;
        if (kind !== "good") return outputWeightOf(line) <= 0;
        if (safeNum(line.actualQuantity ?? line.qty, 0) <= 0) return true;
        if (hasPortionControls && (safeNum(line.portionSize, 0) <= 0 || outputWeightOf(line) <= 0)) return true;
        return false;
      });
    if (invalidOutput) {
      const kind = outputKindOf(invalidOutput);
      const message = kind === "good"
        ? "Line " + invalidOutput.lineNo + ": good finished output needs finished item, stock UOM, receiving destination, and actual quantity. Portion size and output weight are only required for portioned outputs."
        : "Line " + invalidOutput.lineNo + ": " + kind + " output needs finished item, stock UOM, receiving destination, and output weight. Actual portion quantity is optional.";
      return setError(tx(message));
    }

    setSavingLines(true); setError(null);
    try {
      const req: UpdateProductionLinesRequest = {
        issueLocationId,
        outputLocationId,
        inputs: inputs.slice().sort((a, b) => a.lineNo - b.lineNo).map((l) => ({
          id:     l.id?.startsWith("new-") ? null : (l.id ?? null),
          lineNo: l.lineNo,
          itemId: l.itemId,
          qty:    safeNum(l.qty, 1),
          uomId:  l.uomId ?? "00000000-0000-0000-0000-000000000000",
          notes:  null,
        })),
        outputs: outputs.slice().sort((a, b) => a.lineNo - b.lineNo).map((o) => {
          const rawOutputWeightBase = outputWeightOf(o);
          const kind = outputKindOf(o);
          const hasPortionControls = rawOutputWeightBase > 0 || safeNum(o.portionSize, 0) > 0 || Boolean(o.portionUomId);
          const outputWeightBase = kind === "good" && !hasPortionControls ? null : rawOutputWeightBase;
          const enteredActualQuantity = safeNum(o.actualQuantity ?? o.qty, 0);
          const actualQuantity = enteredActualQuantity > 0 ? enteredActualQuantity : (kind === "good" ? 0 : rawOutputWeightBase);
          return {
            id: o.id?.startsWith("new-output-") ? null : (o.id ?? null),
            lineNo: o.lineNo,
            itemId: o.itemId,
            uomId: o.uomId ?? "00000000-0000-0000-0000-000000000000",
            outputLocationId: o.outputLocationId || outputLocationId || null,
            qty: actualQuantity,
            plannedQuantity: safeNum(o.plannedQuantity, actualQuantity),
            actualQuantity,
            portionSize: safeNum(o.portionSize, 0),
            portionUomId: o.portionUomId || null,
            outputWeightBase,
            outputCategory: o.outputCategory || null,
            isRemainingBulk: outputKindOf(o) === "bulk",
            isWaste: outputKindOf(o) === "waste",
            isRework: outputKindOf(o) === "rework",
            costAllocationMethod: "Weight",
            batchNo: o.batchNo ?? null,
            expiryDate: o.expiryDate ?? null,
            notes: o.notes ?? null,
          };
        }),
      };
      await api.updateLines(id, req);
      await reloadBatch(id);
    } catch (e) {
      setError(extractApiError(e, tx("Failed to save production lines.")));
    } finally {
      setSavingLines(false);
    }
  }

  async function postBatch() {
    const id = normalizeBatchId(batchIdRef.current) ?? normalizeBatchId(activeBatchId);
    if (!api || !id) return setError(tx("Create or open a batch first."));
    if (batch && (issueLocationId !== batch.issueLocationId || outputLocationId !== batch.outputLocationId))
      return setError(tx("Save batch location changes before posting."));
    setLoading(true); setError(null);
    try { await api.post(id); await reloadBatch(id); }
    catch (e) { setError(extractApiError(e, tx("Failed to post batch."))); }
    finally { setLoading(false); }
  }

  async function reverseBatch() {
    const id = normalizeBatchId(batchIdRef.current) ?? normalizeBatchId(activeBatchId);
    if (!api || !id) return setError(tx("Create or open a batch first."));
    const reason = window.prompt(tx("Reason for reversing this production batch?"));
    if (reason === null) return;
    setLoading(true); setError(null);
    try { await api.reverse(id, reason.trim() || null); await reloadBatch(id); }
    catch (e) { setError(extractApiError(e, tx("Failed to reverse batch."))); }
    finally { setLoading(false); }
  }

  //  Guards 

  if (!companyId) return <ScopeGuard message={tx("Select a company first.")} />;
  if (!branchId)  return <ScopeGuard message={tx("Select a branch first.")} />;

  if (isRegisterPage) {
    return (
      <div className="p-page">
        <ProductionWorkflowBar active="batch" />

        <div className="p-page-header">
          <div>
            <p className="p-kicker">{tx("ERP Production | Batch Register")}</p>
            <h1 className="p-title">{tx("Production Batches")}</h1>
            <p className="p-subtitle">{tx("Review, reopen, post, and reverse branch production batches from one register.")}</p>
          </div>
          <div className="p-btn-row">
            <button className="p-btn p-btn--outline" onClick={() => window.location.reload()} disabled={registerLoading}>
              {tx("Refresh")}
            </button>
            <button className="p-btn p-btn--accent" onClick={() => nav("/production/batches/new")}>
              {tx("New Batch")}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-alert p-alert--error">
            <span className="p-alert__body">{error}</span>
            <button className="p-dismiss" onClick={() => setError(null)}></button>
          </div>
        )}

        <div className="p-card">
          <div className="p-card__head">
            <div>
              <p className="p-card__title">{tx("Batch Register")}</p>
              <p className="p-card__subtitle">{branchLabel} | {tx("latest 200 production batches")}</p>
            </div>
          </div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>{tx("Batch")}</th>
                  <th>{tx("Menu item")}</th>
                  <th>{tx("Status")}</th>
                  <th className="num">{tx("Planned")}</th>
                  <th className="num">{tx("Lines")}</th>
                  <th className="num">{tx("Cost")}</th>
                  <th>{tx("Produced")}</th>
                  <th className="num">{tx("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  <tr>
                    <td colSpan={8} className="p-table__empty">{tx("Loading production batches...")}</td>
                  </tr>
                ) : batchRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-table__empty">{tx("No production batches yet. Create the first batch for this branch.")}</td>
                  </tr>
                ) : batchRows.map((row) => {
                  const rowStatus = normaliseStatus(row.status);
                  const rowBadge = rowStatus === BatchStatus.Posted ? "p-badge--posted"
                    : rowStatus === BatchStatus.Reversed ? "p-badge--reversed"
                    : rowStatus === BatchStatus.Approved ? "p-badge--approved"
                    : "p-badge--draft";

                  return (
                    <tr key={row.id}>
                      <td><strong>{row.batchNo || row.id}</strong></td>
                      <td>{row.menuItemName || tx("Menu item")}</td>
                      <td><span className={`p-badge ${rowBadge}`}>{batchStatusLabel(rowStatus, tx)}</span></td>
                      <td className="num">{safeNum(row.plannedQty, 0).toFixed(2)}</td>
                      <td className="num">{row.inputLineCount}/{row.outputLineCount}</td>
                      <td className="num">{safeNum(row.totalInputCost, 0).toFixed(2)}</td>
                      <td>{fmtDate(row.producedAtUtc)}</td>
                      <td className="num">
                        <button className="p-btn p-btn--outline" onClick={() => nav(`/production/batches/${row.id}`)}>
                          {tx("Open")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const createDisabled = hasBatch || loading || catalogLoading || !nonEmptyGuid(recipeId)
    || !hasText(menuItemId) || !hasText(issueLocationId) || !hasText(outputLocationId) || plannedQty <= 0;

  //  Render 

  return (
    <div className="p-page">
      <ProductionWorkflowBar active="batch" menuItemId={menuItemId} recipeId={recipeId} batchId={activeBatchId} />

      {/* Header */}
      <div className="p-page-header">
        <div>
          <p className="p-kicker">{tx("ERP Production | Branch Execution")}</p>
          <h1 className="p-title">{tx("Production Batch Control")}</h1>
          <p className="p-subtitle">{tx("Execute recipe-controlled manufacturing, consume inputs, produce outputs, and post inventory with scoped ERP navigation.")}</p>
        </div>
        <div className="p-btn-row">
          <button className="p-btn p-btn--ghost" onClick={() => nav("/production")} disabled={loading}>{tx("Back")}</button>
          <button className="p-btn p-btn--outline"  onClick={() => void reloadBatch()}      disabled={!hasBatch || loading}>{tx("Refresh")}</button>
          {batch&&isDraft(batch)&&<RemovePlannedBatch key={batch.id} permission="production.remove" url={`/companies/${companyId}/branches/${branchId}/production/batches/${batch.id}/remove`} disabled={loading||savingLines} onBusyChange={setLoading} onRemoved={()=>reloadBatch()}/>}
        </div>
      </div>

      <section className="p-kitchen-hero" aria-label={tx("Kitchen batch command center")}>
        <div>
          <p className="p-kicker">{tx("Kitchen Batch Run")}</p>
          <h1 className="p-title">{tx("Prepare, produce, and post stock in one controlled flow")}</h1>
          <p className="p-subtitle">
            {tx("Start with the recipe, confirm where ingredients leave stock, confirm where finished output is received, then post when production is complete.")}
          </p>
        </div>

        <div className="p-kitchen-status-grid">
          <div className="p-kitchen-status">
            <span>{tx("Status")}</span>
            <strong>{tx(statusLabel)}</strong>
          </div>
          <div className="p-kitchen-status">
            <span>{tx("Menu item")}</span>
            <strong>{menuById.get(menuItemId) ?? tx("Not selected")}</strong>
          </div>
          <div className="p-kitchen-status">
            <span>{tx("Planned output")}</span>
            <strong>{plannedQty > 0 ? plannedQty : tx("Not set")}</strong>
          </div>
          <div className={`p-kitchen-status ${inputs.length ? "is-ready" : "is-warning"}`}>
            <span>{tx("Input lines")}</span>
            <strong>{inputs.length ? `${inputs.length} ${tx("loaded")}` : tx("Apply recipe")}</strong>
          </div>
        </div>
      </section>

      <section className="p-kitchen-steps" aria-label={tx("Batch workflow")}>
        <div className={`p-kitchen-step ${recipeId ? "is-active" : ""}`}>
          <span>1</span>
          <div>
            <strong>{tx("Recipe ready")}</strong>
            <small>{tx("Select a stocked production recipe.")}</small>
          </div>
        </div>
        <div className={`p-kitchen-step ${hasBatch ? "is-active" : ""}`}>
          <span>2</span>
          <div>
            <strong>{tx("Create batch")}</strong>
            <small>{tx("Lock planned quantity and locations.")}</small>
          </div>
        </div>
        <div className={`p-kitchen-step ${inputs.length ? "is-active" : ""}`}>
          <span>3</span>
          <div>
            <strong>{tx("Apply recipe")}</strong>
            <small>{tx("Load and adjust consumed ingredients.")}</small>
          </div>
        </div>
        <div className={`p-kitchen-step ${rawStatus === BatchStatus.Posted ? "is-active" : ""}`}>
          <span>4</span>
          <div>
            <strong>{tx("Post stock")}</strong>
            <small>{tx("Consume inputs and receive output.")}</small>
          </div>
        </div>
      </section>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}></button>
        </div>
      )}

      {/*  Batch header card  */}
      <div className="p-card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 20px 14px", borderBottom: "1px solid var(--p-border)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px", color: "var(--p-text)" }}>
              {batch?.batchNo ? `${tx("Batch #")}${batch.batchNo}` : tx("New Production Batch")}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className={`p-badge ${statusBadge}`}>{statusLabel}</span>
              {batch?.postedAtUtc && (
                <span style={{ fontFamily: "var(--p-mono)", fontSize: 12, color: "var(--p-text-muted)" }}>
                  {tx("Posted:")} {fmtDate(batch.postedAtUtc)}
                </span>
              )}
            </div>
          </div>

          <div className="p-btn-row">
            {isNewPage && (
              <button className="p-btn p-btn--accent" onClick={() => void createBatch()} disabled={createDisabled}>
                {loading && !hasBatch ? tx("Creating...") : tx("Create Batch")}
              </button>
            )}
            <button className="p-btn p-btn--outline" onClick={() => void applyRecipe()} disabled={loading || !hasBatch || !canEdit || !recipeId}>
              {tx("Apply Recipe")}
            </button>
            <button className="p-btn p-btn--outline" onClick={() => void saveLines()} disabled={savingLines || !hasBatch || !canEdit || !inputs.length || !outputs.length}>
              {savingLines ? tx("Saving...") : tx("Save Batch Lines")}
            </button>
            <div className="p-btn-divider" />
            <button className="p-btn p-btn--success" onClick={() => void postBatch()}    disabled={loading || !hasBatch || !isDraft(batch) || !inputs.length || outputOverTolerance}>{tx("Post")}</button>
            <button className="p-btn p-btn--danger"  onClick={() => void reverseBatch()} disabled={loading || !hasBatch || rawStatus !== BatchStatus.Posted}>{tx("Reverse")}</button>
          </div>
        </div>

        {/* Metrics strip */}
        <div className="p-metrics">
          <MetricBox label="Company" value={companyId ? companyLabel : "-"} />
          <MetricBox label="Branch"  value={branchId ? branchLabel : "-"} />
          <MetricBox label="Recipe"  value={recipeLabel || "-"} />
          <MetricBox label="Menu Item" value={menuItemLabel || "-"} />
          <MetricBox label="Planned Qty"    value={plannedQty > 0 ? String(plannedQty) : "-"} />
          <MetricBox label="Input Lines"    value={String(inputs.length)} />
          <MetricBox label="Output Units" value={outputs.length ? totalOutputUnits.toFixed(2) : "-"} />
          <MetricBox label={accountedOutputLabel} value={outputs.length ? totalAccountedOutput.toFixed(hasPortionedOutputs ? 4 : 2) : "-"} />
          <MetricBox label="Variance" value={outputs.length ? outputWeightVariance.toFixed(4) : "-"} />
        </div>
      </div>

      {/*  Batch configuration  */}
      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">{tx("Recipe, Batch & Posting Controls")}</p>
            <p className="p-card__subtitle">{tx("Recipe is the source of truth. Company and branch scope are retained for audit-safe posting.")}</p>
          </div>
        </div>
        <div className="p-card__body">
          <div className="p-grid-2">
            <Field label="Recipe" required>
              <input className="p-input p-input--locked" value={recipeLabel} placeholder={tx("Open from Recipe Editor or select a menu item")} readOnly disabled />
            </Field>

            <Field label="Menu Item Context" required>
              <select
                className="p-select"
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                disabled={catalogLoading || loading || !canEdit || Boolean(recipeIdFromQuery)}
              >
                <option value="">{catalogLoading ? tx("Loading menu items...") : tx("Select menu item")}</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ""}</option>
                ))}
              </select>
            </Field>

            <Field label="Planned Quantity" required>
              <input
                className="p-input p-input--num"
                type="number"
                min={0.01}
                step="0.01"
                value={plannedQty}
                onChange={(e) => setPlannedQty(safeNum(e.target.value, 0))}
                disabled={loading || !canEdit}
              />
            </Field>

            <Field label="Issue Location - Raw Materials" required>
              <select
                className="p-select"
                value={issueLocationId}
                onChange={(e) => setIssueLocationId(e.target.value)}
                disabled={catalogLoading || loading || !canEdit}
              >
                <option value="">{catalogLoading ? tx("Loading locations...") : tx("Select issue location")}</option>
                {issueLocations.map((l: any) => <option key={locationIdOf(l)} value={locationIdOf(l)}>{locationLabel(l)}</option>)}
              </select>
            </Field>

            <Field label="Output Location - Finished / Semi-Finished Goods" required>
              <select
                className="p-select"
                value={outputLocationId}
                onChange={(e) => {
                  const nextLocationId = e.target.value;
                  setOutputs((rows) => rows.map((row) =>
                    !row.outputLocationId || row.outputLocationId === outputLocationId
                      ? { ...row, outputLocationId: nextLocationId }
                      : row));
                  setOutputLocationId(nextLocationId);
                }}
                disabled={catalogLoading || loading || !canEdit}
              >
                <option value="">{catalogLoading ? tx("Loading locations...") : tx("Select output location")}</option>
                {outputLocations.filter((l: any) => locationIdOf(l) !== issueLocationId).map((l: any) => (
                  <option key={locationIdOf(l)} value={locationIdOf(l)}>{locationLabel(l)}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/*  Input lines table  */}
      <div className="p-card">
        <div className="p-toolbar">
          <div>
            <p className="p-card__title">{tx("Input Lines / Auditable Consumption")}</p>
            <p className="p-card__subtitle">{tx("Recipe lines are loaded by Apply Recipe. Manual adjustments remain auditable before posting.")}</p>
          </div>
          <button className="p-btn p-btn--outline" onClick={addManualLine} disabled={loading || !canEdit || !hasBatch}>
            {tx("+ Add Manual Line")}
          </button>
        </div>

        <div className="p-table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ minWidth: 280 }}>{tx("Item")}</th>
                <th style={{ width: 140 }}>{tx("UOM")}</th>
                <th className="num" style={{ width: 120 }}>{tx("Qty")}</th>
                <th style={{ width: 100 }}>{tx("Source")}</th>
                <th className="num" style={{ width: 90 }}>{tx("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {inputs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-table__empty">
                    {hasBatch ? tx("Apply Recipe to populate input lines.") : tx("Create the batch first, then apply recipe.")}
                  </td>
                </tr>
              ) : inputs
                .slice()
                .sort((a, b) => a.lineNo - b.lineNo)
                .map((line) => (
                  <tr key={line.id ?? line.lineNo}>
                    <td><span className="p-line-no">{line.lineNo}</span></td>
                    <td>
                      <select
                        className="p-select"
                        value={line.itemId ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => selectInputItem(line.lineNo, e.target.value)}
                      >
                        <option value="">{tx("Select item")}</option>
                        {inventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input className="p-input p-input--locked" value={line.uomName ?? ""} placeholder={tx("Auto")} readOnly disabled />
                    </td>
                    <td>
                      <input
                        className="p-input p-input--num"
                        value={String(line.qty)}
                        inputMode="decimal"
                        disabled={!canEdit}
                        onChange={(e) => updateLine(line.lineNo, { qty: e.target.value })}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n > 0) updateLine(line.lineNo, { qty: String(n) });
                        }}
                      />
                    </td>
                    <td>
                      <span className={`p-source-pill p-source-pill--${line.source === "recipe" ? "recipe" : "manual"}`}>
                        {tx(String(line.source ?? "manual"))}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="p-btn p-btn--danger p-btn--sm" onClick={() => removeLine(line.lineNo)} disabled={!canEdit}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>

            {inputs.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", color: "var(--p-text-muted)", fontFamily: "var(--p-mono)", fontSize: 11 }}>
                    {translateProductionText("INPUT LINES")}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--p-mono)" }}>{inputs.length}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/*  Output portion table  */}
      <div className="p-card">
        <div className="p-toolbar">
          <div>
            <p className="p-card__title">{tx("Finished Outputs / Multi-Portion Yield")}</p>
            <p className="p-card__subtitle">{tx("Split one bulk batch into multiple finished SKUs while preserving weight, lot, recipe version, and cost allocation.")}</p>
          </div>
          <button className="p-btn p-btn--outline" onClick={addOutputLine} disabled={loading || !canEdit || !hasBatch}>
            {tx("+ Add Portion Output")}
          </button>
        </div>

        <div className="p-metrics" style={{ borderTop: "1px solid var(--p-border)", borderBottom: "1px solid var(--p-border)" }}>
          <MetricBox label="Expected output" value={expectedOutputWeight > 0 ? expectedOutputWeight.toFixed(4) : "-"} />
          <MetricBox label="Accounted output" value={outputs.length ? totalAccountedOutput.toFixed(hasPortionedOutputs ? 4 : 2) : "-"} />
          <MetricBox label="Balance / variance" value={outputs.length ? outputWeightVariance.toFixed(4) : "-"} />
          <MetricBox label="Cost allocation" value="By weight" />
        </div>

        <div className="p-table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th style={{ minWidth: 260 }}>{tx("Finished item / SKU")}</th>
                <th style={{ width: 150 }}>{tx("Stock UOM")}</th>
                <th className="num" style={{ width: 110 }}>{tx("Planned")}</th>
                <th className="num" style={{ width: 110 }}>{tx("Actual")}</th>
                <th className="num" style={{ width: 130 }}>{tx("Portion size")}</th>
                <th style={{ width: 150 }}>{tx("Weight UOM")}</th>
                <th className="num" style={{ width: 140 }}>{tx("Output weight")}</th>
                <th style={{ width: 180 }}>{tx("Output type")}</th>
                <th style={{ minWidth: 230 }}>{tx("Destination")}</th>
                <th style={{ minWidth: 210 }}>{tx("Controls")}</th>
                <th className="num" style={{ width: 90 }}>{tx("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {outputOverTolerance && (
              <tr>
                <td colSpan={12} className="p-table__empty" style={{ color: "#b91c1c", textAlign: "left" }}>
                  {tx("Accounted output is above the expected output tolerance. Reduce output weight or record an approved overproduction variance.")}
                </td>
              </tr>
              )}
              {outputs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-table__empty">
                    {hasBatch ? tx("Add burger patty sizes, tray packs, bulk balance, waste, or rework outputs before saving.") : tx("Create the batch first, then define finished outputs.")}
                  </td>
                </tr>
              ) : outputs
                .slice()
                .sort((a, b) => a.lineNo - b.lineNo)
                .map((line) => (
                  <tr key={line.id ?? line.lineNo}>
                    <td><span className="p-line-no">{line.lineNo}</span></td>
                    <td>
                      <select className="p-select" value={line.itemId ?? ""} disabled={!canEdit} onChange={(e) => selectOutputItem(line.lineNo, e.target.value)}>
                        <option value="">{tx("Select finished item")}</option>
                        {outputItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="p-select" value={line.uomId ?? ""} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { uomId: e.target.value || null })}>
                        <option value="">{tx("Select UOM")}</option>
                        {uoms.map((uom) => <option key={uom.id} value={uom.id}>{uomLabel(uom)}</option>)}
                      </select>
                    </td>
                    <td><input className="p-input p-input--num" type="number" min={0} step="1" value={String(line.plannedQuantity ?? line.actualQuantity ?? line.qty)} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { plannedQuantity: e.target.value })} /></td>
                    <td><input className="p-input p-input--num" type="number" min={0} step="1" value={String(line.actualQuantity ?? line.qty)} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { actualQuantity: e.target.value, qty: e.target.value, outputWeightBase: null })} /></td>
                    <td><input className="p-input p-input--num" type="number" min={0} step="0.001" value={String(line.portionSize ?? 0)} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { portionSize: e.target.value, outputWeightBase: null })} /></td>
                    <td>
                      <select className="p-select" value={line.portionUomId ?? ""} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { portionUomId: e.target.value || null })}>
                        <option value="">{tx("Weight UOM")}</option>
                        {uoms.map((uom) => <option key={uom.id} value={uom.id}>{uomLabel(uom)}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="p-input p-input--num" type="number" min={0} step="0.001" value={String(outputWeightOf(line))} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { outputWeightBase: safeNum(e.target.value, 0) })} />
                      <div style={{ color: "var(--p-text-muted)", fontSize: 11, textAlign: "right" }}>{line.portionUomId ? uomById.get(line.portionUomId)?.code ?? tx("base") : tx("base")}</div>
                    </td>
                    <td>
                      <select className="p-select" value={outputKindOf(line)} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, outputKindPatch(e.target.value as OutputKind))}>
                        <option value="good">{tx("Good finished output")}</option>
                        <option value="bulk">{tx("Remaining bulk")}</option>
                        <option value="waste">{tx("Waste / production loss")}</option>
                        <option value="rework">{tx("Rework")}</option>
                      </select>
                    </td>
                    <td>
                      <select className="p-select" value={line.outputLocationId ?? outputLocationId ?? ""} disabled={!canEdit} onChange={(e) => updateOutputLine(line.lineNo, { outputLocationId: e.target.value || null })}>
                        <option value="">{tx("Select destination")}</option>
                        {outputLocations.map((location: any) => {
                          const id = locationIdOf(location);
                          return <option key={id} value={id}>{locationLabel(location)}</option>;
                        })}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 6, color: "var(--p-text-muted)", fontSize: 12 }}>
                        <span>{outputKindOf(line) === "good" ? tx("Receives sellable finished stock.") : outputKindOf(line) === "bulk" ? tx("Keeps unportioned balance in stock.") : outputKindOf(line) === "waste" ? tx("Posts/allocates production loss by policy.") : tx("Tracks material retained for rework.")}</span>
                        {outputWeightOf(line) > 0 && safeNum(line.portionSize, 0) > 0 && outputKindOf(line) === "good" && outputWeightOf(line) !== safeNum(line.portionSize, 0) * safeNum(line.actualQuantity ?? line.qty, 0) && (
                          <strong style={{ color: "#b45309" }}>{tx("Manual weight override")}</strong>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="p-btn p-btn--danger p-btn--sm" onClick={() => removeOutputLine(line.lineNo)} disabled={!canEdit}>
                        {tx("Remove")}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
            {outputs.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", color: "var(--p-text-muted)", fontFamily: "var(--p-mono)", fontSize: 11 }}>{tx("TOTAL OUTPUT")}</td>
                  <td className="num">{totalOutputUnits.toFixed(2)}</td>
                  <td colSpan={2} style={{ textAlign: "right", color: "var(--p-text-muted)", fontFamily: "var(--p-mono)", fontSize: 11 }}>{tx("TOTAL WEIGHT")}</td>
                  <td className="num">{totalPortionedWeight > 0 ? totalPortionedWeight.toFixed(4) : "-"}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}



