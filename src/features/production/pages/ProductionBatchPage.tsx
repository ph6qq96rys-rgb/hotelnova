// src/features/production/pages/ProductionBatchPage.tsx

import { useCallback, useEffect, useMemo,  useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAppScope } from "../../../app/useAppScope";
import { http } from "../../../api/http";
import {
  ApiError,
  createScopedProductionBatchesApi,
  type ProductionBatchDto,
  type CreateProductionBatchRequest,
  type UpdateProductionLinesRequest,
  type ApplyRecipeRequest,
} from "../api/productionBatchesApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import type { LocationLite, MenuItemLite, ProductionLineVm } from "../types";

// ── Local types ───────────────────────────────────────────────────────────────

type InventoryItemLite = {
  id: string;
  name: string;
  code?: string | null;
  uomId?: string | null;
  uomName?: string | null;
  defaultUomId?: string | null;
  defaultUomName?: string | null;
  isActive?: boolean;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function hasText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function safeNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function isDraft(batch: ProductionBatchDto | null): boolean {
  if (!batch) return false; // no batch loaded = not editable as draft
  return String(batch.status).toLowerCase() === "draft";
}

function isAbortError(e: unknown): boolean {
  return (e as { name?: string })?.name === "AbortError";
}

function getApiError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.errors) {
      return Object.entries(e.errors)
        .flatMap(([field, msgs]) => msgs.map((m) => `${field}: ${m}`))
        .join("\n");
    }
    return e.detail ?? e.title ?? fallback;
  }
  const err = e as any;
  return (
    err?.response?.data?.message ??
    err?.response?.data?.title ??
    err?.message ??
    fallback
  );
}

function nextLineNo(lines: ProductionLineVm[]): number {
  return lines.reduce((max, l) => Math.max(max, l.lineNo ?? 0), 0) + 1;
}

function mapBatchInputs(batch: ProductionBatchDto): ProductionLineVm[] {
  return (batch.inputs ?? []).map((l, i) => ({
    id: l.id ?? `${l.lineNo ?? i + 1}-${i}`,
    lineNo: l.lineNo ?? i + 1,
    itemId: l.itemId ?? "",
    itemName: l.itemName ?? "",
    uomId: l.uomId ?? null,
    uomName: l.uomName ?? null,
    qty: safeNum(l.qty, 0),
    qtyBase: l.qtyBase ?? null,
    source: (l.source as ProductionLineVm["source"]) ?? "manual",
    recipeLineId: l.recipeLineId ?? null,
  }));
}

// ── Catalog fetchers ──────────────────────────────────────────────────────────

async function fetchLocations(cid: string, bid: string): Promise<LocationLite[]> {
  return stockLocationsApi.list(cid, bid);
}

async function fetchMenuItems(cid: string, bid: string): Promise<MenuItemLite[]> {
  const res = await http.get<MenuItemLite[]>(
    `/companies/${cid}/branches/${bid}/menu/items`,
    { params: { activeOnly: true } }
  );
  return res.data ?? [];
}

async function fetchInventoryItems(cid: string, bid: string): Promise<InventoryItemLite[]> {
  const res = await http.get<InventoryItemLite[]>(
    `/companies/${cid}/inventory-items/search`,
    { params: { branchId: bid, activeOnly: true, q: " " } }
  );
  return res.data ?? [];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductionBatchPage() {
  const nav = useNavigate();
  const { batchId: routeBatchId } = useParams<{ batchId?: string }>();
  const scope = useAppScope();

  const companyId = scope.companyId?.trim() ?? "";
  const branchId  = scope.branchId?.trim()  ?? "";
  const hasScope  = Boolean(companyId) && Boolean(branchId);

  // The route param tells us whether we are editing an existing batch
  const existingBatchId = hasText(routeBatchId) ? routeBatchId.trim() : null;
  const isNewPage = !existingBatchId;

  // ── Scoped API ──────────────────────────────────────────────────────────────

  const api = useMemo(
    () =>
      hasScope
        ? createScopedProductionBatchesApi(companyId, branchId)
        : null,
    [hasScope, companyId, branchId]
  );

  // ── Catalog state ───────────────────────────────────────────────────────────

  const [locations,      setLocations]      = useState<LocationLite[]>([]);
  const [menuItems,      setMenuItems]      = useState<MenuItemLite[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemLite[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogReady,   setCatalogReady]   = useState(false);

  // ── Batch / form state ──────────────────────────────────────────────────────

  const [batch,            setBatch]           = useState<ProductionBatchDto | null>(null);
  const [inputs,           setInputs]          = useState<ProductionLineVm[]>([]);
  const [menuItemId,       setMenuItemId]      = useState("");
  const [plannedQty,       setPlannedQty]      = useState<number>(1);
  const [issueLocationId,  setIssueLocationId] = useState("");
  const [outputLocationId, setOutputLocationId] = useState("");

  // ── Loading / error state ───────────────────────────────────────────────────

  const [loading,     setLoading]     = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hasBatch = Boolean(batch?.id);
  // On a new page: form is always editable until batch is created.
  // On an existing page: only editable if batch status is Draft.
  const canEdit = isNewPage ? !hasBatch : isDraft(batch);

  const menuById = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m.name])),
    [menuItems]
  );

  const totalInputQty = useMemo(
    () => inputs.reduce((sum, l) => sum + safeNum(l.qty, 0), 0),
    [inputs]
  );

  // ── Sync form from a loaded batch ───────────────────────────────────────────

  const syncFormFromBatch = useCallback((b: ProductionBatchDto) => {
    setBatch(b);
    setInputs(mapBatchInputs(b));
    setMenuItemId(b.menuItemId ?? "");
    setPlannedQty(safeNum(b.plannedQty, 1));
    setIssueLocationId(b.issueLocationId ?? "");
    setOutputLocationId(b.outputLocationId ?? "");
  }, []);

  // ── Reload batch after mutations ────────────────────────────────────────────

  const reloadBatch = useCallback(
    async (signal?: AbortSignal) => {
      const id = batch?.id;
      if (!api || !id) return;
      setLoading(true);
      setError(null);
      try {
        syncFormFromBatch(await api.get(id, signal));
      } catch (e) {
        if (!isAbortError(e)) setError(getApiError(e, "Failed to reload batch."));
      } finally {
        setLoading(false);
      }
    },
    [api, batch?.id, syncFormFromBatch]
  );

  // ── Load catalogs ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasScope) {
      setLocations([]);
      setMenuItems([]);
      setInventoryItems([]);
      setCatalogReady(false);
      return;
    }

    const ctrl = new AbortController();
    setCatalogReady(false);

    async function load() {
      setCatalogLoading(true);
      setError(null);

      try {
        const [locs, menus, items] = await Promise.all([
          fetchLocations(companyId, branchId),
          fetchMenuItems(companyId, branchId),
          fetchInventoryItems(companyId, branchId),
        ]);

        if (ctrl.signal.aborted) return;

        const activeLocs  = locs.filter((l) => l.isActive !== false);
        const activeMenus = menus.filter((m) => m.isActive !== false);
        const activeItems = items.filter((i) => i.isActive !== false);

        setLocations(activeLocs);
        setMenuItems(activeMenus);
        setInventoryItems(activeItems);
        setCatalogReady(true);

        // Only seed defaults on a new (no route param) page
        if (isNewPage) {
          setIssueLocationId((prev) =>
            activeLocs.some((l) => l.id === prev) ? prev : activeLocs[0]?.id ?? ""
          );
          setOutputLocationId((prev) =>
            activeLocs.some((l) => l.id === prev) ? prev : activeLocs[0]?.id ?? ""
          );
          setMenuItemId((prev) =>
            activeMenus.some((m) => m.id === prev) ? prev : activeMenus[0]?.id ?? ""
          );
        }
      } catch (e) {
        if (!ctrl.signal.aborted)
          setError(getApiError(e, "Failed to load catalogs."));
      } finally {
        if (!ctrl.signal.aborted) setCatalogLoading(false);
      }
    }

    void load();
    return () => ctrl.abort();
  }, [hasScope, companyId, branchId, isNewPage]);

  // ── Load existing batch ─────────────────────────────────────────────────────
  // Waits for catalogs to be ready so selects render with the correct value
  // already highlighted rather than showing "Select…" on first paint.

  useEffect(() => {
    if (!existingBatchId || !api || !catalogReady) return;

    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        syncFormFromBatch(await api!.get(existingBatchId!, ctrl.signal));
      } catch (e) {
        if (!ctrl.signal.aborted)
          setError(getApiError(e, "Failed to load production batch."));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => ctrl.abort();
  }, [existingBatchId, api, catalogReady, syncFormFromBatch]);

  // ── Line helpers ─────────────────────────────────────────────────────────────

  function updateLine(lineNo: number, patch: Partial<ProductionLineVm>) {
    setInputs((prev) =>
      prev.map((l) => (l.lineNo === lineNo ? { ...l, ...patch } : l))
    );
  }

  function selectInputItem(lineNo: number, itemId: string) {
    const item = inventoryItems.find((x) => x.id === itemId);
    updateLine(lineNo, {
      itemId,
      itemName: item?.name ?? "",
      uomId:    item?.defaultUomId ?? item?.uomId ?? null,
      uomName:  item?.defaultUomName ?? item?.uomName ?? null,
    });
  }

  function addManualLine() {
    setInputs((prev) => {
      const lineNo = nextLineNo(prev);
      return [
        ...prev,
        {
          id: `new-${Date.now()}-${lineNo}`,
          lineNo,
          itemId: "",
          itemName: "",
          qty: 1,
          qtyBase: null,
          source: "manual" as const,
          uomId: null,
          uomName: null,
          recipeLineId: null,
        },
      ];
    });
  }

  function removeLine(lineNo: number) {
    setInputs((prev) => prev.filter((l) => l.lineNo !== lineNo));
  }

  // ── Validation ────────────────────────────────────────────────────────────────

  function validateCreate(): string | null {
    if (!hasText(menuItemId))       return "Menu item is required.";
    if (!hasText(issueLocationId))  return "Issue location is required.";
    if (!hasText(outputLocationId)) return "Output location is required.";
    if (issueLocationId === outputLocationId)
      return "Issue and output locations cannot be the same.";
    if (!plannedQty || plannedQty <= 0)
      return "Planned quantity must be greater than zero.";
    return null;
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function createBatch() {
    if (!api) return setError("Select company and branch first.");

    const validationError = validateCreate();
    if (validationError) return setError(validationError);

    setLoading(true);
    setError(null);

    try {
      const req: CreateProductionBatchRequest = {
        menuItemId:      menuItemId.trim(),
        plannedQty:      safeNum(plannedQty, 1),
        issueLocationId:  issueLocationId.trim(),
        outputLocationId: outputLocationId.trim(),
      };

      const id = await api.create(req);
      // Navigate to the edit page — the batch load effect will fire there
      nav(`/production/batches/${id}`);
    } catch (e) {
      setError(getApiError(e, "Failed to create production batch."));
    } finally {
      setLoading(false);
    }
  }

  async function applyRecipe() {
    const id = batch?.id;
    if (!api || !id)     return setError("Create or open a batch first.");
    if (!menuItemId)     return setError("Select a menu item.");
    if (plannedQty <= 0) return setError("Planned quantity must be greater than zero.");

    setLoading(true);
    setError(null);
    try {
      const req: ApplyRecipeRequest = { menuItemId, plannedQty: safeNum(plannedQty, 1) };
      await api.applyRecipe(id, req);
      await reloadBatch();
    } catch (e) {
      setError(getApiError(e, "Failed to apply recipe."));
    } finally {
      setLoading(false);
    }
  }

  async function saveLines() {
    const id = batch?.id;
    if (!api || !id) return setError("Create or open a batch first.");

    const badLine = inputs.find((l) => !l.itemId || safeNum(l.qty, 0) <= 0);
    if (badLine)
      return setError("Every line must have an item and quantity greater than zero.");

    setSavingLines(true);
    setError(null);
    try {
      const req: UpdateProductionLinesRequest = {
        inputs: inputs
          .slice()
          .sort((a, b) => a.lineNo - b.lineNo)
          .map((l) => ({
            lineNo:       l.lineNo,
            itemId:       l.itemId,
            qty:          safeNum(l.qty, 0),
            uomId:        l.uomId ?? null,
            source:       l.source ?? "manual",
            recipeLineId: l.recipeLineId ?? null,
          })),
      };
      await api.updateLines(id, req);
      await reloadBatch();
    } catch (e) {
      setError(getApiError(e, "Failed to save input lines."));
    } finally {
      setSavingLines(false);
    }
  }

  async function postBatch() {
    const id = batch?.id;
    if (!api || !id) return setError("Create or open a batch first.");
    if (inputs.length === 0) return setError("Add at least one input line before posting.");

    setLoading(true);
    setError(null);
    try {
      await api.post(id);
      await reloadBatch();
    } catch (e) {
      setError(getApiError(e, "Failed to post production batch."));
    } finally {
      setLoading(false);
    }
  }

  async function reverseBatch() {
    const id = batch?.id;
    if (!api || !id) return setError("Create or open a batch first.");
    if (!window.confirm("Reverse this batch? This will reinstate all consumed stock."))
      return;

    setLoading(true);
    setError(null);
    try {
      await api.reverse(id);
      await reloadBatch();
    } catch (e) {
      setError(getApiError(e, "Failed to reverse production batch."));
    } finally {
      setLoading(false);
    }
  }

  // ── Create-button disabled logic ─────────────────────────────────────────────
  // Disabled once a batch exists on this page (already created),
  // or while fields are missing / loading.

  const createDisabled =
    hasBatch ||
    loading ||
    catalogLoading ||
    !hasText(menuItemId) ||
    !hasText(issueLocationId) ||
    !hasText(outputLocationId) ||
    (plannedQty ?? 0) <= 0;

  // ── Guard renders ─────────────────────────────────────────────────────────────

  if (!companyId) return <ScopeMessage message="Select a company first." />;
  if (!branchId)  return <ScopeMessage message="Select a branch first." />;

  // ── Render ────────────────────────────────────────────────────────────────────

  const batchStatus = batch?.status ?? "Draft";
  const statusColor =
    batchStatus === "Posted"   ? "#16a34a" :
    batchStatus === "Reversed" ? "#dc2626" : "#92400e";

  return (
    <div className="page">

      {/* ── Page header ── */}
      <div style={pageHeaderStyle}>
        <div>
          <div style={titleStyle}>Production Batch</div>
          <div style={subtitleStyle}>
            Create production batches, apply recipes, consume inputs, and post
            finished goods.
          </div>
        </div>

        <div style={actionRowStyle}>
          <button className="btn" onClick={() => nav("/production")} disabled={loading}>
            ← Back
          </button>
          <button
            className="btn"
            onClick={() => void reloadBatch()}
            disabled={!hasBatch || loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="alert alert-danger"
          style={{ marginTop: 12, whiteSpace: "pre-line" }}
          role="alert"
        >
          {error}
          <button
            style={dismissBtnStyle}
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Batch header card ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={docHeaderStyle}>
          <div>
            <div style={sectionTitleStyle}>
              {batch?.batchNo ? `Batch #${batch.batchNo}` : "New Production Batch"}
            </div>
            <div style={docMetaStyle}>
              Status:{" "}
              <b style={{ color: statusColor }}>{batchStatus}</b>
              {" · "}
              Created: {fmtDate(batch?.createdAt)}
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div style={actionRowStyle}>
            {/* Create — only relevant on the /new page */}
            {isNewPage && (
              <button
                className="btn btn-primary"
                onClick={() => void createBatch()}
                disabled={createDisabled}
                title={hasBatch ? "Batch already created" : ""}
              >
                {loading && !hasBatch ? "Creating…" : "Create Batch"}
              </button>
            )}

            <button
              className="btn"
              onClick={() => void applyRecipe()}
              disabled={loading || !hasBatch || !canEdit}
              title="Populate input lines from the selected menu item's recipe"
            >
              Apply Recipe
            </button>

            <button
              className="btn"
              onClick={() => void saveLines()}
              disabled={savingLines || !hasBatch || !canEdit || inputs.length === 0}
            >
              {savingLines ? "Saving…" : "Save Inputs"}
            </button>

            <button
              className="btn btn-success"
              onClick={() => void postBatch()}
              disabled={loading || !hasBatch || !isDraft(batch)}
              title="Post batch and update inventory"
            >
              Post
            </button>

            <button
              className="btn btn-danger"
              onClick={() => void reverseBatch()}
              disabled={loading || !hasBatch || batchStatus !== "Posted"}
              title="Reverse a posted batch"
            >
              Reverse
            </button>
          </div>
        </div>

        {/* ── Summary boxes ── */}
        <div style={summaryGridStyle}>
          <SummaryBox label="Menu Item"      value={menuById.get(menuItemId) ?? "—"} />
          <SummaryBox label="Planned Qty"    value={plannedQty > 0 ? String(plannedQty) : "—"} />
          <SummaryBox label="Input Lines"    value={String(inputs.length)} />
          <SummaryBox label="Total Input Qty" value={inputs.length ? totalInputQty.toFixed(4) : "—"} />
        </div>
      </div>

      {/* ── Document information ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={sectionTitleStyle}>Document Information</div>

        <div style={formGridStyle}>
          <Field label="Menu Item" required>
            <select
              className="input"
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              disabled={catalogLoading || loading || !canEdit}
            >
              <option value="">
                {catalogLoading ? "Loading menu items…" : "Select menu item"}
              </option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.code ? ` (${m.code})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Planned Quantity" required>
            <input
              className="input"
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
              className="input"
              value={issueLocationId}
              onChange={(e) => setIssueLocationId(e.target.value)}
              disabled={catalogLoading || loading || !canEdit}
            >
              <option value="">
                {catalogLoading ? "Loading locations…" : "Select issue location"}
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Output Location — Finished Goods" required>
            <select
              className="input"
              value={outputLocationId}
              onChange={(e) => setOutputLocationId(e.target.value)}
              disabled={catalogLoading || loading || !canEdit}
            >
              <option value="">
                {catalogLoading ? "Loading locations…" : "Select output location"}
              </option>
              {locations
                .filter((l) => l.id !== issueLocationId) // prevent same-location selection
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
            </select>
          </Field>
        </div>
      </div>

      {/* ── Input lines ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={tableHeaderStyle}>
          <div>
            <div style={sectionTitleStyle}>Input Lines / Consumption</div>
            <div style={subtitleStyle}>
              Select an inventory item — UoM fills automatically.
            </div>
          </div>

          <button
            className="btn"
            onClick={addManualLine}
            disabled={loading || !canEdit || !hasBatch}
            title={!hasBatch ? "Create batch first" : ""}
          >
            + Add Line
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th style={{ minWidth: 300 }}>Item</th>
                <th style={{ width: 160 }}>UoM</th>
                <th style={{ width: 140, textAlign: "right" }}>Qty</th>
                <th style={{ width: 120 }}>Source</th>
                <th style={{ width: 100, textAlign: "right" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {inputs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={emptyCellStyle}>
                    {hasBatch
                      ? <>No input lines yet — click <b>Apply Recipe</b> or <b>+ Add Line</b>.</>
                      : "Create the batch first, then add input lines."}
                  </td>
                </tr>
              ) : (
                inputs
                  .slice()
                  .sort((a, b) => a.lineNo - b.lineNo)
                  .map((line) => (
                    <tr key={line.id ?? line.lineNo}>
                      <td style={{ color: "#6b7280", fontSize: 13 }}>{line.lineNo}</td>

                      <td>
                        <select
                          className="input"
                          value={line.itemId ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => selectInputItem(line.lineNo, e.target.value)}
                        >
                          <option value="">— select item —</option>
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}{item.code ? ` (${item.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          className="input"
                          value={line.uomName ?? ""}
                          placeholder="Auto"
                          readOnly
                          disabled
                          style={{ background: "rgba(0,0,0,0.03)", cursor: "default" }}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="0.0001"
                          value={line.qty}
                          disabled={!canEdit}
                          style={{ textAlign: "right" }}
                          onChange={(e) =>
                            updateLine(line.lineNo, { qty: safeNum(e.target.value, 0) })
                          }
                        />
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              line.source === "recipe" ? "#dbeafe" : "#f3f4f6",
                            color:
                              line.source === "recipe" ? "#1d4ed8" : "#374151",
                            borderRadius: 6,
                            padding: "2px 8px",
                            fontSize: 12,
                          }}
                        >
                          {line.source ?? "manual"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => removeLine(line.lineNo)}
                          disabled={!canEdit}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>

            {inputs.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, padding: "8px 12px" }}>
                    Total
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, padding: "8px 12px" }}>
                    {totalInputQty.toFixed(4)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div style={{ height: 30 }} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScopeMessage({ message }: { message: string }) {
  return (
    <div className="page">
      <div className="card" style={{ padding: 24, color: "#92400e" }}>{message}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
        {label}{required && <span style={{ color: "crimson", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryBoxStyle}>
      <div style={{ fontSize: 12, opacity: 0.6, letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.65,
  marginTop: 3,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "center",
};

const docHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
};

const docMetaStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.7,
  marginTop: 4,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginTop: 16,
};

const summaryBoxStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 10,
  padding: "10px 14px",
  background: "rgba(0,0,0,0.02)",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  marginTop: 14,
};

const tableHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const emptyCellStyle: React.CSSProperties = {
  padding: 20,
  textAlign: "center",
  opacity: 0.6,
  fontSize: 13,
};

const dismissBtnStyle: React.CSSProperties = {
  float: "right",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  opacity: 0.6,
};
