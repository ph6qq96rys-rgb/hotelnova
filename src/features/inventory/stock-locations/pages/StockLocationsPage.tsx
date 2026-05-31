import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../../../app/AppContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useStockLocations } from "../hooks/useStockLocations";
import { stockLocationsApi } from "../api/stockLocationsApi";
import { branchesApi } from "../../../company/api/branchesApi";
import StockLocationForm from "../components/StockLocationForm";
import StockLocationsTable from "../components/StockLocationsTable";

import type {
  BranchDto,
  CreateStockLocationDto,
  StockLocationDto,
  UpdateStockLocationDto,
} from "../types";

type Modal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; item: StockLocationDto };

export default function StockLocationsPage() {
  const { companyId, branchId: scopeBranchId } = useAppContext();

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    scopeBranchId ?? null
  );

  const [branches,        setBranches]        = useState<BranchDto[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError,   setBranchesError]   = useState<string | null>(null);

  // Separate error state for create / update / toggle actions.
  // Prevents API failures from being silently swallowed.
  const [actionError, setActionError] = useState<string | null>(null);

  const [q,          setQ]          = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [modal,      setModal]      = useState<Modal>({ kind: "none" });

  const debouncedQ = useDebouncedValue(q, 250);

  // ── Branches ───────────────────────────────────────────────────────────────

  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const data = await branchesApi.list(companyId);
      setBranches(data ?? []);
    } catch (e: unknown) {
      setBranchesError(
        e instanceof Error ? e.message : "Failed to load branches."
      );
    } finally {
      setBranchesLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  // ── Stock locations ────────────────────────────────────────────────────────

  const { items: rawItems, loading, error, refresh } =
    useStockLocations(companyId ?? null, selectedBranchId);

  const items = useMemo(() => {
    let data = rawItems;
    if (activeOnly) data = data.filter(x => x.isActive !== false);
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return data;
    return data.filter(x =>
      `${x.name ?? ""} ${x.code ?? ""}`.toLowerCase().includes(term)
    );
  }, [rawItems, activeOnly, debouncedQ]);

  // ── Actions ────────────────────────────────────────────────────────────────

  // FIX: original create/update/toggleActive didn't pass companyId or branchId,
  // which the refactored stockLocationsApi now requires. All three are updated.

  const create = async (dto: CreateStockLocationDto | UpdateStockLocationDto) => {
    if (!companyId || !selectedBranchId) return;
    setActionError(null);
    try {
      await stockLocationsApi.create(
        companyId,
        selectedBranchId,
        dto as CreateStockLocationDto
      );
      setModal({ kind: "none" });
      await refresh();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to create location.");
    }
  };

  const update = async (dto: CreateStockLocationDto | UpdateStockLocationDto) => {
    if (modal.kind !== "edit" || !companyId || !selectedBranchId) return;
    setActionError(null);
    try {
      await stockLocationsApi.update(
        companyId,
        selectedBranchId,
        modal.item.id,
        dto as UpdateStockLocationDto
      );
      setModal({ kind: "none" });
      await refresh();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to update location.");
    }
  };

  const toggleActive = async (x: StockLocationDto) => {
    if (!companyId || !selectedBranchId) return;
    setActionError(null);
    try {
      // setActive requires the current DTO so it can patch only isActive
      // without overwriting the other fields.
      await stockLocationsApi.setActive(
        companyId,
        selectedBranchId,
        x.id,
        !x.isActive,
        x as unknown as UpdateStockLocationDto
      );
      await refresh();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to toggle active status.");
    }
  };

  const onChangeBranch = (id: string) => {
    setSelectedBranchId(id || null);
    setActionError(null);
  };

  // Branches rarely change — only refresh locations on manual refresh.
  const onRefresh = async () => { await refresh(); };

  // ── Early exit ─────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Stock Locations</h1>
            <p className="muted">Select a company first.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body muted">No CompanyId found in AppContext.</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Stock Locations</h1>
          <p className="muted">
            Warehouses, store rooms, kitchens and mini-stores used by GRN, SIV and stock transfers.
          </p>
        </div>
        <div className="row gap" style={{ alignItems: "center" }}>
          <button
            className="btn"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="btn primary"
            onClick={() => { setActionError(null); setModal({ kind: "create" }); }}
            disabled={!selectedBranchId}
            title={!selectedBranchId ? "Select a branch first" : undefined}
          >
            + New Location
          </button>
        </div>
      </div>

      {/* Errors */}
      {branchesError && (
        <div className="alert danger">
          <strong>Branches:</strong> {branchesError}
        </div>
      )}
      {error && (
        <div className="alert danger">
          <strong>Locations:</strong> {error?.message ?? "Request failed"}
          {error?.status ? ` (HTTP ${error.status})` : ""}
        </div>
      )}
      {actionError && (
        <div className="alert danger">{actionError}</div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body">
          <div className="row gap" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Branch
              </div>
              <select
                className="input"
                value={selectedBranchId ?? ""}
                onChange={e => onChangeBranch(e.target.value)}
                disabled={branchesLoading}
              >
                <option value="">
                  {branchesLoading ? "Loading branches…" : "Select branch…"}
                </option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Search
              </div>
              <input
                className="input"
                placeholder="Search name / code…"
                value={q}
                onChange={e => setQ(e.target.value)}
                disabled={!selectedBranchId}
              />
            </div>

            <label className="row" style={{ gap: 10, marginTop: 18 }}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={e => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>

            <div className="muted" style={{ marginTop: 18 }}>
              {selectedBranchId
                ? "Showing locations for the selected branch."
                : "Select a branch to load locations."}
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="muted">Loading…</div>}

      <StockLocationsTable
        items={items}
        onEdit={item => { setActionError(null); setModal({ kind: "edit", item }); }}
        onToggleActive={toggleActive}
      />

      {modal.kind !== "none" && (
        <div className="modal-backdrop" onClick={() => setModal({ kind: "none" })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {modal.kind === "create" && (
              <StockLocationForm
                mode="create"
                companyId={companyId}
                branchId={selectedBranchId}
                onCancel={() => setModal({ kind: "none" })}
                onSubmit={create}
              />
            )}
            {modal.kind === "edit" && (
              <StockLocationForm
                mode="edit"
                companyId={companyId}
                branchId={selectedBranchId}
                initial={modal.item}
                onCancel={() => setModal({ kind: "none" })}
                onSubmit={update}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}