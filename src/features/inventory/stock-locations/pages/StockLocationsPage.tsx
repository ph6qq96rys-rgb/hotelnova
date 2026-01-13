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

  // ✅ Branch is selectable (defaults to scoped branch if present)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    scopeBranchId ?? null
  );

  // Branch list
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const debouncedQ = useDebouncedValue(q, 250);

  // Modal
  const [modal, setModal] = useState<Modal>({ kind: "none" });

  // Load branches
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const data = await branchesApi.list(companyId);
      setBranches(data ?? []);
    } catch (e: any) {
      setBranchesError(e?.message ?? "Failed to load branches");
    } finally {
      setBranchesLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // ✅ Load stock locations for selected branch only
  const {
    items: rawItems,
    loading,
    error,
    refresh,
  } = useStockLocations(companyId ?? null, selectedBranchId);

  // Client-side filtering for q + activeOnly
  const items = useMemo(() => {
    let data = rawItems;

    if (activeOnly) data = data.filter((x) => x.isActive !== false);

    const term = debouncedQ.trim().toLowerCase();
    if (!term) return data;

    return data.filter((x: any) => {
      const hay = `${x.name ?? ""} ${x.code ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rawItems, activeOnly, debouncedQ]);

  const onChangeBranch = (id: string) => {
    const next = id || null;
    setSelectedBranchId(next);
  };

  const onRefresh = async () => {
    await loadBranches();
    await refresh();
  };

  const create = async (dto: CreateStockLocationDto | UpdateStockLocationDto) => {
  await stockLocationsApi.create(dto as CreateStockLocationDto);
  setModal({ kind: "none" });
  await refresh();
};

const update = async (dto: CreateStockLocationDto | UpdateStockLocationDto) => {
  if (modal.kind !== "edit") return;
  await stockLocationsApi.update(modal.item.id, dto as UpdateStockLocationDto);
  setModal({ kind: "none" });
  await refresh();
};

const toggleActive = async (x: StockLocationDto) => {
  await stockLocationsApi.setActive(x.id, !x.isActive);
  await refresh();
};
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

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Stock Locations</h1>
          <p className="muted">
            Warehouses, store rooms, kitchens and mini-stores used by GRN, SIV and stock transfers.
          </p>
        </div>

        <div className="row gap" style={{ alignItems: "center" }}>
          <button className="btn" onClick={onRefresh} disabled={loading || branchesLoading}>
            {loading || branchesLoading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="btn primary"
            onClick={() => setModal({ kind: "create" })}
            disabled={!selectedBranchId}
            title={!selectedBranchId ? "Select a branch first" : ""}
          >
            + New Location
          </button>
        </div>
      </div>

      {/* Errors */}
      {branchesError ? (
        <div className="alert danger">
          <strong>Branches:</strong> {branchesError}
        </div>
      ) : null}

      {error ? (
        <div className="alert danger">
          <strong>Locations:</strong> {error?.message ?? "Request failed"} (HTTP {error?.status ?? "?"})
        </div>
      ) : null}

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body">
          <div className="row gap" style={{ alignItems: "center", flexWrap: "wrap" }}>
            {/* Branch picker */}
            <div style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Branch
              </div>
              <select
                className="input"
                value={selectedBranchId ?? ""}
                onChange={(e) => onChangeBranch(e.target.value)}
                disabled={branchesLoading}
              >
                <option value="">
                  {branchesLoading ? "Loading branches..." : "Select branch…"}
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Search
              </div>
              <input
                className="input"
                placeholder="Search name/code..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={!selectedBranchId}
              />
            </div>

            {/* Active Only */}
            <label className="row" style={{ gap: 10, marginTop: 18 }}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>

            {/* Scope hint */}
            <div className="muted" style={{ marginTop: 18 }}>
              {selectedBranchId ? (
                <>
                  Showing locations for the selected branch.
                </>
              ) : (
                <>
                  Select a branch to load locations.
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? <div className="muted">Loading...</div> : null}

      {/* Table */}
      <StockLocationsTable
        items={items}
        onEdit={(item) => setModal({ kind: "edit", item })}
        onToggleActive={toggleActive}
      />

      {/* Modal */}
      {modal.kind !== "none" ? (
        <div className="modal-backdrop" onClick={() => setModal({ kind: "none" })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal.kind === "create" ? (
              <StockLocationForm
                mode="create"
                companyId={companyId}
                branchId={selectedBranchId}
                onCancel={() => setModal({ kind: "none" })}
                onSubmit={create}
              />
            ) : null}

            {modal.kind === "edit" ? (
              <StockLocationForm
                mode="edit"
                companyId={companyId}
                branchId={selectedBranchId}
                initial={modal.item}
                onCancel={() => setModal({ kind: "none" })}
                onSubmit={update}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
