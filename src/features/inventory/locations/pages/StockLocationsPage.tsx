import { useMemo, useState } from "react";
import { stockLocationsApi } from "../api/stockLocationsApi";
import { useStockLocations } from "../hooks/useStockLocations";
import StockLocationForm from "../components/StockLocationForm";
import StockLocationsTable from "../components/StockLocationsTable";
import type { CreateStockLocationDto, StockLocationDto, UpdateStockLocationDto } from "../types";

type Modal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; item: StockLocationDto };

export default function StockLocationsPage() {
  // ✅ Replace with your real selection context later (Company onboarding selection)
  const [companyId, setCompanyId] = useState<string>("");

  const [q, setQ] = useState("");
  const { items, loading, error, refresh } = useStockLocations({ companyId: companyId || undefined, q: q || undefined });

  const [modal, setModal] = useState<Modal>({ kind: "none" });

  const canCreate = useMemo(() => !!companyId.trim(), [companyId]);

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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Stock Locations</h1>
          <p className="muted">Manage Stores and Warehouses used for GRN/SIV/Transfers.</p>
        </div>

        <div className="row gap">
          <input
            className="input"
            placeholder="CompanyId (required)"
            value={companyId}
            onChange={e => setCompanyId(e.target.value)}
          />
          <input
            className="input"
            placeholder="Search..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <button className="btn primary" disabled={!canCreate} onClick={() => setModal({ kind: "create" })}>
            + New Location
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert danger">
          <strong>Error:</strong> {error?.message ?? "Request failed"} (HTTP {error?.status ?? "?"})
        </div>
      ) : null}

      {loading ? <div className="muted">Loading...</div> : null}

      <StockLocationsTable
        items={items}
        onEdit={(item) => setModal({ kind: "edit", item })}
        onToggleActive={toggleActive}
      />

      {modal.kind !== "none" ? (
        <div className="modal-backdrop" onClick={() => setModal({ kind: "none" })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal.kind === "create" ? (
              <StockLocationForm
                mode="create"
                companyId={companyId}
                onCancel={() => setModal({ kind: "none" })}
                onSubmit={create}
              />
            ) : null}

            {modal.kind === "edit" ? (
              <StockLocationForm
                mode="edit"
                companyId={companyId}
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
