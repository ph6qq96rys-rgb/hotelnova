// src/features/production/pages/ProductionBatchPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { http } from "../../../api/http";
import {
  ApiError,
  createScopedProductionBatchesApi,
  type ProductionBatchDto,
  type CreateProductionBatchRequest,
  type UpdateProductionLinesRequest,
} from "../api/productionBatchesApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import { fetchInventoryItems } from "../api/lookups";
import type { InventoryItemLite } from "../api/lookups";
import { productionRecipesApi } from "../api/recipesApi";
import type { LocationLite, MenuItemLite, ProductionLineVm } from "../types";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import "./production-batch.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const BatchStatus = { Draft: 2, Approved: 3, Posted: 4, Reversed: 5 } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const hasText       = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const safeNum       = (value: unknown, fallback = 0): number => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
const nonEmptyGuid  = (v: string | null | undefined): string | null =>
  (!v || v === "00000000-0000-0000-0000-000000000000") ? null : v;

function normaliseStatus(status: unknown): number {
  if (typeof status === "string") return BatchStatus[status as keyof typeof BatchStatus] ?? -1;
  return (status as number) ?? -1;
}

const isDraft       = (batch: ProductionBatchDto | null) => batch ? normaliseStatus(batch.status) === BatchStatus.Draft : false;
const isAbortError  = (e: unknown) => (e as any)?.name === "AbortError";

function fmtDate(value?: string | null): string {
  if (!value) return "—";
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

function batchStatusLabel(status: number): string {
  if (status === BatchStatus.Posted)   return "Posted";
  if (status === BatchStatus.Reversed) return "Reversed";
  if (status === BatchStatus.Approved) return "Approved";
  return "Draft";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScopeGuard({ message }: { message: string }) {
  return (
    <div className="p-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div className="p-guard"><div className="p-guard__icon">⚙</div>{message}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="p-field">
      <label className="p-field__label">
        {label}{required && <span className="p-field__required"> *</span>}
      </label>
      {children}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-metric">
      <div className="p-metric__label">{label}</div>
      <div className="p-metric__value">{value}</div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductionBatchPage() {
  const nav = useNavigate();
  const { batchId: routeBatchId } = useParams<{ batchId?: string }>();
  const [sp] = useSearchParams();

  const recipeIdFromQuery   = nonEmptyGuid(sp.get("recipeId"));
  const menuItemIdFromQuery = nonEmptyGuid(sp.get("menuItemId"));

  const scope     = useAppScope();
  const companyId = scope.companyId?.trim() ?? "";
  const branchId  = scope.branchId?.trim()  ?? "";
  const hasScope  = Boolean(companyId && branchId);

  const batchIdRef    = useRef<string | null>(hasText(routeBatchId) ? routeBatchId.trim() : null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(hasText(routeBatchId) ? routeBatchId.trim() : null);
  const isNewPage = !hasText(routeBatchId);

  const api = useMemo(
    () => hasScope ? createScopedProductionBatchesApi(companyId, branchId) : null,
    [hasScope, companyId, branchId]
  );

  // ── State ─────────────────────────────────────────────────────────────────

  const [locations,     setLocations]     = useState<LocationLite[]>([]);
  const [menuItems,     setMenuItems]     = useState<MenuItemLite[]>([]);
  const [inventoryItems,setInventoryItems]= useState<InventoryItemLite[]>([]);
  const [catalogLoading,setCatalogLoading]= useState(false);
  const [catalogReady,  setCatalogReady]  = useState(false);

  const [batch,         setBatch]         = useState<ProductionBatchDto | null>(null);
  const [inputs,        setInputs]        = useState<ProductionLineVm[]>([]);

  const [menuItemId,      setMenuItemId]      = useState(menuItemIdFromQuery ?? "");
  const [recipeId,        setRecipeId]        = useState<string | null>(recipeIdFromQuery);
  const [plannedQty,      setPlannedQty]      = useState<number>(1);
  const [issueLocationId, setIssueLocationId] = useState("");
  const [outputLocationId,setOutputLocationId]= useState("");

  const [loading,     setLoading]     = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  const hasBatch = Boolean(activeBatchId);
  const canEdit  = !hasBatch || batch === null || isDraft(batch);

  const menuById = useMemo(() => new Map(menuItems.map((m) => [m.id, m.name])), [menuItems]);
  const itemById = useMemo(() => new Map(inventoryItems.map((i) => [i.id, i])), [inventoryItems]);

  const totalInputQty = useMemo(() => inputs.reduce((s, l) => s + safeNum(l.qty, 0), 0), [inputs]);

  const rawStatus  = batch ? normaliseStatus(batch.status) : BatchStatus.Draft;
  const statusLabel= batchStatusLabel(rawStatus);
  const statusBadge= rawStatus === BatchStatus.Posted    ? "p-badge--posted"
                   : rawStatus === BatchStatus.Reversed  ? "p-badge--reversed"
                   : rawStatus === BatchStatus.Approved  ? "p-badge--approved"
                   : "p-badge--draft";

  // ── Sync form from batch ──────────────────────────────────────────────────

  const syncFormFromBatch = useCallback((dto: ProductionBatchDto) => {
    setBatch(dto);
    setInputs(mapBatchInputs(dto));
    setIssueLocationId(dto.issueLocationId ?? "");
    setOutputLocationId(dto.outputLocationId ?? "");
    const rid = nonEmptyGuid(dto.recipeId);
    if (rid) setRecipeId(rid);
    const mid = nonEmptyGuid((dto as any).menuItemId);
    if (mid) setMenuItemId(mid);
  }, []);

  const reloadBatch = useCallback(
    async (batchId?: string, signal?: AbortSignal) => {
      const id = batchId ?? batchIdRef.current ?? activeBatchId;
      if (!api || !id) return;
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

  // ── Load catalog ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasScope) { setLocations([]); setMenuItems([]); setInventoryItems([]); setCatalogReady(false); return; }
    const ctrl = new AbortController();
    setCatalogReady(false); setCatalogLoading(true); setError(null);

    Promise.all([
      fetchLocations(companyId, branchId),
      fetchMenuItems(companyId, branchId),
      fetchInventoryItems(companyId, branchId, ""),
    ])
      .then(([locs, menus, items]) => {
        if (ctrl.signal.aborted) return;
        const activeLocs  = locs.filter((l) => l.isActive !== false);
        const activeMenus = menus.filter((m) => m.isActive !== false);
        const activeItems = items.filter((i) => i.isActive !== false);
        setLocations(activeLocs); setMenuItems(activeMenus); setInventoryItems(activeItems);
        setCatalogReady(true);
        if (isNewPage) {
          setIssueLocationId((prev) => activeLocs.some((l) => l.id === prev) ? prev : activeLocs[0]?.id ?? "");
          setOutputLocationId((prev) => activeLocs.some((l) => l.id === prev) ? prev : activeLocs[1]?.id ?? activeLocs[0]?.id ?? "");
          if (menuItemIdFromQuery) setMenuItemId(menuItemIdFromQuery);
          else setMenuItemId((prev) => activeMenus.some((m) => m.id === prev) ? prev : activeMenus[0]?.id ?? "");
          if (recipeIdFromQuery) setRecipeId(recipeIdFromQuery);
        }
      })
      .catch((e) => { if (!ctrl.signal.aborted) setError(extractApiError(e, "Failed to load catalogs.")); })
      .finally(() => { if (!ctrl.signal.aborted) setCatalogLoading(false); });

    return () => ctrl.abort();
  }, [hasScope, companyId, branchId, isNewPage, menuItemIdFromQuery, recipeIdFromQuery]);

  // ── Load existing batch ───────────────────────────────────────────────────

  useEffect(() => {
    const id = hasText(routeBatchId) ? routeBatchId.trim() : null;
    if (!id || !api || !catalogReady) return;
    const ctrl = new AbortController();
    setLoading(true); setError(null);
    api.get(id, ctrl.signal)
      .then(syncFormFromBatch)
      .catch((e) => { if (!ctrl.signal.aborted) setError(extractApiError(e, "Failed to load batch.")); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [routeBatchId, api, catalogReady, syncFormFromBatch]);

  // ── Auto-resolve recipe from menu item ───────────────────────────────────

  useEffect(() => {
    if (!companyId || !menuItemId) {
      if (!recipeIdFromQuery) setRecipeId(null);
      return;
    }

    let cancelled = false;

    productionRecipesApi.getByMenuItem(companyId, menuItemId)
      .then((recipe) => {
        if (cancelled) return;

        const mode = String((recipe as any)?.mode ?? "directSale").toLowerCase();
        if (mode === "directsale" || mode === "direct-sale" || mode === "direct_sale") {
          setRecipeId(null);
          setError("This menu item uses a direct-sale recipe. It is consumed at POS sale and does not use production batches.");
          return;
        }

        const rid = nonEmptyGuid(recipe.id);
        if (!rid) { setRecipeId(null); return; }

        if (!recipe.isActive) {
          setRecipeId(null);
          setError("The selected recipe is inactive. Activate it in the Recipe Editor first.");
        } else {
          setRecipeId(recipeIdFromQuery ?? rid);
          setError(null);
        }
      })
      .catch(() => { if (!cancelled && !recipeIdFromQuery) setRecipeId(null); });

    return () => { cancelled = true; };
  }, [companyId, menuItemId, recipeIdFromQuery]);

  // ── Line operations ───────────────────────────────────────────────────────

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

  // ── Validation ────────────────────────────────────────────────────────────

  function validateCreate(): string | null {
    if (!nonEmptyGuid(recipeId))     return "Production recipe is required.";
    if (!hasText(menuItemId))        return "Menu item is required.";
    if (!hasText(issueLocationId))   return "Issue location is required.";
    if (!hasText(outputLocationId))  return "Output location is required.";
    if (issueLocationId === outputLocationId) return "Issue and output locations cannot be the same.";
    if (!plannedQty || plannedQty <= 0) return "Planned quantity must be greater than zero.";
    return null;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function createBatch() {
    if (!api) return setError("Select company and branch first.");
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

      const newId = await api.create(req);
      batchIdRef.current = newId;
      setActiveBatchId(newId);
      if (isNewPage) nav(`/production/batches/${newId}`, { replace: true });
      await reloadBatch(newId);
    } catch (e) {
      setError(extractApiError(e, "Failed to create batch."));
    } finally {
      setLoading(false);
    }
  }

  async function applyRecipe() {
    const id = batchIdRef.current ?? activeBatchId;
    if (!api || !id)               return setError("Create or open a batch first.");
    if (!nonEmptyGuid(recipeId))   return setError("Select a recipe first.");
    if (plannedQty <= 0)           return setError("Planned quantity must be greater than zero.");
    setLoading(true); setError(null);
    try {
      await api.applyRecipe(id, { recipeId: nonEmptyGuid(recipeId)!, outputQty: safeNum(plannedQty, 1), replaceExistingInputs: true });
      await reloadBatch(id);
    } catch (e) {
      setError(extractApiError(e, "Failed to apply recipe."));
    } finally {
      setLoading(false);
    }
  }

  async function saveLines() {
    const id = batchIdRef.current ?? activeBatchId;
    if (!api || !id) return setError("Create or open a batch first.");
    if (!batch?.outputs?.length) return setError("Apply Recipe first to generate output lines.");

    const badLine = inputs.find((l) => !l.itemId || !l.uomId || safeNum(l.qty, 0) <= 0);
    if (badLine) return setError("Every line needs an item, UOM, and quantity > 0. Re-select the item to auto-fill UOM.");

    setSavingLines(true); setError(null);
    try {
      const req: UpdateProductionLinesRequest = {
        inputs: inputs.slice().sort((a, b) => a.lineNo - b.lineNo).map((l) => ({
          id:     l.id?.startsWith("new-") ? null : (l.id ?? null),
          lineNo: l.lineNo,
          itemId: l.itemId,
          qty:    safeNum(l.qty, 1),
          uomId:  l.uomId ?? "00000000-0000-0000-0000-000000000000",
          notes:  null,
        })),
        outputs: (batch?.outputs ?? []).map((o) => ({ id: o.id, lineNo: o.lineNo, itemId: o.itemId, uomId: o.uomId, qty: o.qty })),
      };
      await api.updateLines(id, req);
      await reloadBatch(id);
    } catch (e) {
      setError(extractApiError(e, "Failed to save input lines."));
    } finally {
      setSavingLines(false);
    }
  }

  async function postBatch() {
    const id = batchIdRef.current ?? activeBatchId;
    if (!api || !id) return setError("Create or open a batch first.");
    setLoading(true); setError(null);
    try { await api.post(id); await reloadBatch(id); }
    catch (e) { setError(extractApiError(e, "Failed to post batch.")); }
    finally { setLoading(false); }
  }

  async function reverseBatch() {
    const id = batchIdRef.current ?? activeBatchId;
    if (!api || !id) return setError("Create or open a batch first.");
    if (!window.confirm("Reverse this batch? This will reinstate all consumed stock.")) return;
    setLoading(true); setError(null);
    try { await api.reverse(id); await reloadBatch(id); }
    catch (e) { setError(extractApiError(e, "Failed to reverse batch.")); }
    finally { setLoading(false); }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!companyId) return <ScopeGuard message="Select a company first." />;
  if (!branchId)  return <ScopeGuard message="Select a branch first." />;

  const createDisabled = hasBatch || loading || catalogLoading || !nonEmptyGuid(recipeId)
    || !hasText(menuItemId) || !hasText(issueLocationId) || !hasText(outputLocationId) || plannedQty <= 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-page">
      <ProductionWorkflowBar active="batch" menuItemId={menuItemId} recipeId={recipeId} batchId={activeBatchId} />

      {/* Header */}
      <div className="p-page-header">
        <div>
          <p className="p-kicker">Production · Operations</p>
          <h1 className="p-title">Production Batch</h1>
          <p className="p-subtitle">Execute a recipe, consume inputs, produce outputs, and post inventory.</p>
        </div>
        <div className="p-btn-row">
          <button className="p-btn p-btn--ghost"    onClick={() => nav("/production")}      disabled={loading}>← Back</button>
          <button className="p-btn p-btn--outline"  onClick={() => void reloadBatch()}      disabled={!hasBatch || loading}>Refresh</button>
        </div>
      </div>

      {error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{error}</span>
          <button className="p-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Batch header card ── */}
      <div className="p-card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 20px 14px", borderBottom: "1px solid var(--p-border)" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px", color: "var(--p-text)" }}>
              {batch?.batchNo ? `Batch #${batch.batchNo}` : "New Production Batch"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className={`p-badge ${statusBadge}`}>{statusLabel}</span>
              {batch?.postedAtUtc && (
                <span style={{ fontFamily: "var(--p-mono)", fontSize: 12, color: "var(--p-text-muted)" }}>
                  Posted: {fmtDate(batch.postedAtUtc)}
                </span>
              )}
            </div>
          </div>

          <div className="p-btn-row">
            {isNewPage && (
              <button className="p-btn p-btn--accent" onClick={() => void createBatch()} disabled={createDisabled}>
                {loading && !hasBatch ? "Creating…" : "Create Batch"}
              </button>
            )}
            <button className="p-btn p-btn--outline" onClick={() => void applyRecipe()} disabled={loading || !hasBatch || !canEdit || !recipeId}>
              Apply Recipe
            </button>
            <button className="p-btn p-btn--outline" onClick={() => void saveLines()} disabled={savingLines || !hasBatch || !canEdit || !inputs.length || !batch?.outputs?.length}>
              {savingLines ? "Saving…" : "Save Inputs"}
            </button>
            <div className="p-btn-divider" />
            <button className="p-btn p-btn--success" onClick={() => void postBatch()}    disabled={loading || !hasBatch || !isDraft(batch) || !inputs.length}>Post</button>
            <button className="p-btn p-btn--danger"  onClick={() => void reverseBatch()} disabled={loading || !hasBatch || rawStatus !== BatchStatus.Posted}>Reverse</button>
          </div>
        </div>

        {/* Metrics strip */}
        <div className="p-metrics">
          <MetricBox label="Recipe ID"      value={recipeId ? `${recipeId.slice(0, 8)}…` : "—"} />
          <MetricBox label="Menu Item"      value={menuById.get(menuItemId) ?? "—"} />
          <MetricBox label="Planned Qty"    value={plannedQty > 0 ? String(plannedQty) : "—"} />
          <MetricBox label="Input Lines"    value={String(inputs.length)} />
          <MetricBox label="Total Input Qty" value={inputs.length ? totalInputQty.toFixed(4) : "—"} />
        </div>
      </div>

      {/* ── Batch configuration ── */}
      <div className="p-card">
        <div className="p-card__head">
          <div>
            <p className="p-card__title">Recipe & Batch Information</p>
            <p className="p-card__subtitle">Recipe is the source of truth. Menu item retained as sales context.</p>
          </div>
        </div>
        <div className="p-card__body">
          <div className="p-grid-2">
            <Field label="Recipe ID" required>
              <input className="p-input p-input--locked" value={recipeId ?? ""} placeholder="Open from Recipe Editor or select a menu item" readOnly disabled />
            </Field>

            <Field label="Menu Item Context" required>
              <select
                className="p-select"
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                disabled={catalogLoading || loading || !canEdit || Boolean(recipeIdFromQuery)}
              >
                <option value="">{catalogLoading ? "Loading menu items…" : "Select menu item"}</option>
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

            <Field label="Issue Location — Raw Materials" required>
              <select
                className="p-select"
                value={issueLocationId}
                onChange={(e) => setIssueLocationId(e.target.value)}
                disabled={catalogLoading || loading || !canEdit}
              >
                <option value="">{catalogLoading ? "Loading locations…" : "Select issue location"}</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>

            <Field label="Output Location — Finished Goods" required>
              <select
                className="p-select"
                value={outputLocationId}
                onChange={(e) => setOutputLocationId(e.target.value)}
                disabled={catalogLoading || loading || !canEdit}
              >
                <option value="">{catalogLoading ? "Loading locations…" : "Select output location"}</option>
                {locations.filter((l) => l.id !== issueLocationId).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Input lines table ── */}
      <div className="p-card">
        <div className="p-toolbar">
          <div>
            <p className="p-card__title">Input Lines / Consumption</p>
            <p className="p-card__subtitle">Recipe lines are loaded by Apply Recipe. Manual adjustments remain auditable.</p>
          </div>
          <button className="p-btn p-btn--outline" onClick={addManualLine} disabled={loading || !canEdit || !hasBatch}>
            + Add Manual Line
          </button>
        </div>

        <div className="p-table-wrap">
          <table className="p-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ minWidth: 280 }}>Item</th>
                <th style={{ width: 140 }}>UOM</th>
                <th className="num" style={{ width: 120 }}>Qty</th>
                <th style={{ width: 100 }}>Source</th>
                <th className="num" style={{ width: 90 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {inputs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-table__empty">
                    {hasBatch ? "Apply Recipe to populate input lines." : "Create the batch first, then apply recipe."}
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
                        <option value="">— select item —</option>
                        {inventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input className="p-input p-input--locked" value={line.uomName ?? ""} placeholder="Auto" readOnly disabled />
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
                        {line.source ?? "manual"}
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
                    TOTAL INPUT QTY
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--p-mono)" }}>{totalInputQty.toFixed(4)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}