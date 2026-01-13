// src/features/production/pages/ProductionBatchPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { productionApi } from "../api/productionApi";
import { http } from "../../../api/http";
import type {LocationLite,MenuItemLite,ApplyRecipeRequest,
  CreateProductionBatchRequest,ProductionLineVm,ProductionBatchDto,UpdateProductionLinesRequest} from "../types";

// -----------------------------
// Types (keep minimal & strict)
// -----------------------------


async function fetchLocations(companyId: string): Promise<LocationLite[]> {
  if (!companyId) return [];
  return http.get<LocationLite[]>(`/companies/${companyId}/locations`).then((r) => r.data);
}

async function fetchMenuItems(companyId: string): Promise<MenuItemLite[]> {
  if (!companyId) return [];
  return http.get<MenuItemLite[]>(`/companies/${companyId}/menu/items`).then((r) => r.data);
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function safeNum(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function nextLineNo(lines: ProductionLineVm[]) {
  const max = lines.reduce((m, l) => Math.max(m, l.lineNo), 0);
  return max + 1;
}

export default function ProductionBatchPage() {
  const nav = useNavigate();
  const { batchId: batchIdParam } = useParams<{ batchId?: string }>();
  const { companyId } = useAppScope();

  // Company guard (fix TS2345)
  if (!companyId) {
    return (
      <div className="page">
        <div className="card">
          <div style={{ fontSize: 18, fontWeight: 700 }}>Company not selected</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Please select a company to create or open a production batch.
          </div>
        </div>
      </div>
    );
  }
  const cid = companyId;

  // -----------------------------
  // Catalogs
  // -----------------------------
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemLite[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);

  // -----------------------------
  // Batch state
  // -----------------------------
  const [loading, setLoading] = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [batch, setBatch] = useState<ProductionBatchDto | null>(null);

  // Create form (top card)
  const [menuItemId, setMenuItemId] = useState<string>("");
  const [plannedQty, setPlannedQty] = useState<number>(1);

  const [issueLocationId, setIssueLocationId] = useState<string>("");
  const [outputLocationId, setOutputLocationId] = useState<string>("");

  // Editable lines (inputs)
  const [inputs, setInputs] = useState<ProductionLineVm[]>([]);

  /*const locationById = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations]
  );*/
  const menuById = useMemo(
    () => new Map(menuItems.map((m) => [m.id, m.name])),
    [menuItems]
  );

  // -----------------------------
  // Load catalogs
  // -----------------------------
  useEffect(() => {
    let mounted = true;
    setCatalogLoading(true);
    setCatalogErr(null);

    Promise.all([fetchLocations(cid), fetchMenuItems(cid)])
      .then(([locs, menus]) => {
        if (!mounted) return;

        const activeLocs = locs.filter((x) => x.isActive);
        const activeMenus = menus.filter((x) => x.isActive);

        setLocations(activeLocs);
        setMenuItems(activeMenus);

        // defaults
        if (!issueLocationId && activeLocs.length > 0) setIssueLocationId(activeLocs[0].id);
        if (!outputLocationId && activeLocs.length > 0) setOutputLocationId(activeLocs[0].id);
        if (!menuItemId && activeMenus.length > 0) setMenuItemId(activeMenus[0].id);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setCatalogErr(e instanceof Error ? e.message : "Failed to load catalogs");
      })
      .finally(() => {
        if (!mounted) return;
        setCatalogLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  // -----------------------------
  // Load batch if route has id
  // -----------------------------
  useEffect(() => {
    if (!batchIdParam) return;

    let mounted = true;
    setLoading(true);
    setErr(null);

    productionApi
      .getBatch(cid, batchIdParam)
      .then((b: ProductionBatchDto) => {
        if (!mounted) return;

        setBatch(b);

        // hydrate form selections from batch
        setMenuItemId(b.menuItemId ?? "");
        setPlannedQty(safeNum(b.plannedQty, 1));
        setIssueLocationId(b.issueLocationId ?? "");
        setOutputLocationId(b.outputLocationId ?? "");

        // hydrate inputs
        const lines = (b.inputs ?? []).map((x, idx) => ({
          id: x.id ?? `${x.lineNo}-${idx}`,
          lineNo: x.lineNo,
          itemId: x.itemId,
          itemName: x.itemName,
          uomId: x.uomId ?? null,
          uomName: x.uomName ?? null,
          qty: safeNum(x.qty, 0),
          qtyBase: x.qtyBase ?? null,
          source: (x.source as any) ?? "manual",
          recipeLineId: x.recipeLineId ?? null,
        }));
        setInputs(lines);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Failed to load batch");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [cid, batchIdParam]);

  // -----------------------------
  // Actions
  // -----------------------------
  async function createNewBatch() {
    setErr(null);

    if (!menuItemId) return setErr("Select a menu item.");
    if (!issueLocationId) return setErr("Select Issue Location.");
    if (!outputLocationId) return setErr("Select Output Location.");
    if (plannedQty <= 0) return setErr("Planned Qty must be greater than 0.");

    setLoading(true);
    try {
      const req: CreateProductionBatchRequest = {
        menuItemId,
        plannedQty: safeNum(plannedQty, 1),
        issueLocationId,
        outputLocationId,
      };

      const id = await productionApi.createBatch(cid, req);
      // navigate to detail route (adjust to your route)
      nav(`/production/batches/${id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create batch");
    } finally {
      setLoading(false);
    }
  }

  async function reloadBatch() {
    if (!batch?.id) return;
    setLoading(true);
    setErr(null);
    try {
      const b = await productionApi.getBatch(cid, batch.id);
      setBatch(b);

      const lines = (b.inputs ?? []).map((x, idx) => ({
        id: x.id ?? `${x.lineNo}-${idx}`,
        lineNo: x.lineNo,
        itemId: x.itemId,
        itemName: x.itemName,
        uomId: x.uomId ?? null,
        uomName: x.uomName ?? null,
        qty: safeNum(x.qty, 0),
        qtyBase: x.qtyBase ?? null,
        source: (x.source as any) ?? "manual",
        recipeLineId: x.recipeLineId ?? null,
      }));
      setInputs(lines);

      // keep selections aligned
      setMenuItemId(b.menuItemId ?? menuItemId);
      setPlannedQty(safeNum(b.plannedQty, plannedQty));
      setIssueLocationId(b.issueLocationId ?? issueLocationId);
      setOutputLocationId(b.outputLocationId ?? outputLocationId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to reload batch");
    } finally {
      setLoading(false);
    }
  }

  async function applyRecipe() {
    if (!batch?.id) return setErr("Create or open a batch first.");
    if (!menuItemId) return setErr("Select a menu item.");
    if (plannedQty <= 0) return setErr("Planned Qty must be greater than 0.");

    setLoading(true);
    setErr(null);
    try {
      const req: ApplyRecipeRequest = {
        menuItemId,
        plannedQty: safeNum(plannedQty, 1),
      };

      await productionApi.applyRecipe(cid, batch.id, req);
      await reloadBatch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to apply recipe");
    } finally {
      setLoading(false);
    }
  }

  async function saveLines() {
    if (!batch?.id) return setErr("Create or open a batch first.");

    // basic validation
    const bad = inputs.find((x) => !x.itemId || x.qty <= 0);
    if (bad) return setErr("All input lines must have Item and Qty > 0.");

    setSavingLines(true);
    setErr(null);
    try {
      const req: UpdateProductionLinesRequest = {
        inputs: inputs
          .slice()
          .sort((a, b) => a.lineNo - b.lineNo)
          .map((x) => ({
            lineNo: x.lineNo,
            itemId: x.itemId,
            qty: safeNum(x.qty, 0),
            uomId: x.uomId ?? null,
            source: x.source ?? "manual",
            recipeLineId: x.recipeLineId ?? null,
          })),
      };

      await productionApi.updateLines(cid, batch.id, req);
      await reloadBatch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save lines");
    } finally {
      setSavingLines(false);
    }
  }

  async function postBatch() {
    if (!batch?.id) return setErr("Create or open a batch first.");
    setLoading(true);
    setErr(null);
    try {
      await productionApi.post(cid, batch.id);
      await reloadBatch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setLoading(false);
    }
  }

  async function reverseBatch() {
    if (!batch?.id) return setErr("Create or open a batch first.");
    setLoading(true);
    setErr(null);
    try {
      await productionApi.reverse(cid, batch.id);
      await reloadBatch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to reverse");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // Inputs table helpers
  // -----------------------------
  function addManualLine() {
    setInputs((prev) => {
      const ln = nextLineNo(prev);
      return [
        ...prev,
        {
          id: `new-${Date.now()}-${ln}`,
          lineNo: ln,
          itemId: "",
          itemName: "",
          qty: 1,
          source: "manual",
          uomId: null,
          uomName: null,
          recipeLineId: null,
        },
      ];
    });
  }

  function removeLine(lineNo: number) {
    setInputs((prev) => prev.filter((x) => x.lineNo !== lineNo));
  }

  function updateLine(lineNo: number, patch: Partial<ProductionLineVm>) {
    setInputs((prev) =>
      prev.map((x) => (x.lineNo === lineNo ? { ...x, ...patch } : x))
    );
  }

  // --------------------------------
  // GRN-style UI blocks
  // --------------------------------
  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Production Batch</div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            Create, apply recipe, edit inputs, then post (issues stock + creates outputs).
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => nav("/production")} disabled={loading}>
            Back
          </button>
          <button className="btn" onClick={reloadBatch} disabled={!batch?.id || loading}>
            Refresh
          </button>
        </div>
      </div>

      {/* Errors */}
      {(catalogErr || err) && (
        <div className="alert alert-danger" style={{ marginTop: 10 }}>
          {catalogErr ?? err}
        </div>
      )}

      {/* Card: Create / Summary */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {batch?.id ? `Batch # ${batch.batchNo ?? batch.id}` : "New Batch"}
            </div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>
              Status: <b>{batch?.status ?? "draft"}</b> · Created: {fmtDate(batch?.createdAt)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={createNewBatch} disabled={loading || catalogLoading}>
              + Create Batch
            </button>
            <button className="btn" onClick={applyRecipe} disabled={loading || !batch?.id}>
              Apply Recipe
            </button>
            <button className="btn" onClick={saveLines} disabled={savingLines || !batch?.id}>
              {savingLines ? "Saving…" : "Save Inputs"}
            </button>
            <button className="btn btn-success" onClick={postBatch} disabled={loading || !batch?.id}>
              Post
            </button>
            <button className="btn btn-danger" onClick={reverseBatch} disabled={loading || !batch?.id}>
              Reverse
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 14 }}>
          {/* Menu Item */}
          <div>
            <label className="label">Menu Item</label>
            <select
              className="input"
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              disabled={catalogLoading || loading}
            >
              {catalogLoading ? (
                <option value="">Loading…</option>
              ) : menuItems.length === 0 ? (
                <option value="">No menu items</option>
              ) : (
                menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.code ? ` (${m.code})` : ""}
                  </option>
                ))
              )}
            </select>
            <div className="hint">Recipe is attached to the selected menu item.</div>
          </div>

          {/* Planned Qty */}
          <div>
            <label className="label">Planned Qty</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={plannedQty}
              onChange={(e) => setPlannedQty(safeNum(e.target.value, 0))}
              disabled={loading}
            />
            <div className="hint">Used to scale recipe quantities.</div>
          </div>

          {/* Quick info */}
          <div style={{ borderLeft: "1px solid rgba(0,0,0,0.06)", paddingLeft: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Selected</div>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>{menuById.get(menuItemId) ?? "—"}</div>
              <div style={{ opacity: 0.75, marginTop: 2 }}>Qty: {plannedQty}</div>
            </div>
          </div>
        </div>

        {/* Locations */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <label className="label">Issue Location (Raw materials)</label>
            <select
              className="input"
              value={issueLocationId}
              onChange={(e) => setIssueLocationId(e.target.value)}
              disabled={catalogLoading || loading}
            >
              {catalogLoading ? (
                <option value="">Loading…</option>
              ) : locations.length === 0 ? (
                <option value="">No active locations</option>
              ) : (
                locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              )}
            </select>
            <div className="hint">Ingredients will be deducted from this location.</div>
          </div>

          <div>
            <label className="label">Output Location (Finished goods)</label>
            <select
              className="input"
              value={outputLocationId}
              onChange={(e) => setOutputLocationId(e.target.value)}
              disabled={catalogLoading || loading}
            >
              {catalogLoading ? (
                <option value="">Loading…</option>
              ) : locations.length === 0 ? (
                <option value="">No active locations</option>
              ) : (
                locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              )}
            </select>
            <div className="hint">Finished goods will be received into this location.</div>
          </div>
        </div>
      </div>

      {/* Card: Inputs */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Inputs (Consumption)</div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>
              Recipe lines will appear after <b>Apply Recipe</b>. You can add manual lines too.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={addManualLine} disabled={loading}>
              + Add Line
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Line</th>
                <th>Item</th>
                <th style={{ width: 140, textAlign: "right" }}>Qty</th>
                <th style={{ width: 120 }}>Source</th>
                <th style={{ width: 120, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inputs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, opacity: 0.7 }}>
                    No input lines yet. Click <b>Apply Recipe</b> or <b>Add Line</b>.
                  </td>
                </tr>
              ) : (
                inputs
                  .slice()
                  .sort((a, b) => a.lineNo - b.lineNo)
                  .map((ln) => (
                    <tr key={ln.id ?? ln.lineNo}>
                      <td>{ln.lineNo}</td>
                      <td>
                        <input
                          className="input"
                          placeholder="Item name (display only)"
                          value={ln.itemName}
                          onChange={(e) => updateLine(ln.lineNo, { itemName: e.target.value })}
                        />
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                          ItemId:{" "}
                          <input
                            className="input"
                            style={{ maxWidth: 360 }}
                            placeholder="Paste ItemId (GUID)"
                            value={ln.itemId}
                            onChange={(e) => updateLine(ln.lineNo, { itemId: e.target.value })}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="0.0001"
                          value={ln.qty}
                          onChange={(e) => updateLine(ln.lineNo, { qty: safeNum(e.target.value, 0) })}
                          style={{ textAlign: "right" }}
                        />
                      </td>
                      <td>
                        <span className="badge">{ln.source ?? "manual"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm btn-danger" onClick={() => removeLine(ln.lineNo)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, opacity: 0.75 }}>
          <div>
            Total lines: <b>{inputs.length}</b>
          </div>
          <div>
            Tip: Keep <b>ItemId</b> correct; posting will FIFO-consume by location + item.
          </div>
        </div>
      </div>

      {/* Card: Outputs (read-only from backend) */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Outputs (Produced)</div>
        <div style={{ opacity: 0.7, marginTop: 2 }}>This section updates after posting.</div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ width: 160, textAlign: "right" }}>Qty (Base)</th>
              </tr>
            </thead>
            <tbody>
              {(batch?.outputs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 14, opacity: 0.7 }}>
                    No outputs yet. Post the batch to create finished goods.
                  </td>
                </tr>
              ) : (
                (batch?.outputs ?? []).map((o, idx) => (
                  <tr key={`${o.itemId}-${idx}`}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{o.itemName}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{o.itemId}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>{o.qtyBase}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer space */}
      <div style={{ height: 30 }} />
    </div>
  );
}
