import { useMemo, useState } from "react";

import { useAppScope } from "../../../../app/useAppScope";
import { useInventoryLedger } from "../hooks/useInventoryLedger";
import LedgerTable from "../components/LedgerTable";
import type { InventoryLedgerQuery } from "../api/inventoryLedgerApi";

type LedgerMovementType =
  | ""
  | "Receipt"
  | "Production"
  | "Transfer"
  | "Adjustment"
  | "Sale"
  | "Consumption";

type LedgerFilters = {
  locationId: string;
  itemId: string;
  movementType: LedgerMovementType;
  fromDate: string;
  toDate: string;
};

const initialFilters: LedgerFilters = {
  locationId: "",
  itemId: "",
  movementType: "",
  fromDate: "",
  toDate: "",
};

export default function InventoryLedgerPage() {
  const { companyId } = useAppScope();

  const [filters, setFilters] = useState<LedgerFilters>(initialFilters);

  const query = useMemo<InventoryLedgerQuery>(
    () => ({
      locationId: cleanOrNull(filters.locationId),
      itemId: cleanOrNull(filters.itemId),
      movementType: cleanOrNull(filters.movementType),
      fromDate: cleanOrNull(filters.fromDate),
      toDate: cleanOrNull(filters.toDate),
      page: 1,
      pageSize: 50,
    }),
    [filters]
  );

  const { data, paging, loading, error } = useInventoryLedger(
    companyId ?? null,
    query
  );

  const items = data?.items ?? [];

  const hasFilters = Object.values(filters).some((value) => value.trim());

  function updateFilter<K extends keyof LedgerFilters>(
    key: K,
    value: LedgerFilters[K]
  ) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function clearFilters() {
    setFilters(initialFilters);
  }

  if (!companyId) {
    return (
      <div className="page">
        <div className="card">
          <div className="card-title">Select Company</div>
          <div className="card-subtitle">
            Please select a company before viewing the inventory ledger.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Inventory Control</div>
          <div className="page-title">Inventory Ledger</div>
          <div className="page-sub">
            Trace receipts, production, transfers, adjustments, sales,
            consumption, costing, and FIFO impact.
          </div>
        </div>

        <div className="kpi" style={{ minWidth: 140 }}>
          <div className="kpi-label">Rows Loaded</div>
          <div className="kpi-val">{items.length}</div>
          <div className="kpi-sub">{paging?.totalCount ?? 0} total records</div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label="Records"
          value={paging?.totalCount ?? 0}
          sub={`Page ${paging?.page ?? 1} of ${paging?.totalPages ?? 1}`}
        />

        <KpiCard
          label="Rows Loaded"
          value={items.length}
          sub="Current page"
        />

        <KpiCard
          label="Scope"
          value={filters.locationId ? "Filtered" : "All"}
          sub={filters.locationId ? "Location selected" : "All locations"}
        />

        <KpiCard
          label="Movement"
          value={filters.movementType || "All"}
          sub="Inventory flow type"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Ledger Filters</div>
            <div className="card-subtitle">
              Filter by location, item, movement type, and date range to
              investigate inventory flow and FIFO costing.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={clearFilters}
            disabled={!hasFilters || loading}
          >
            Clear
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <TextField
            label="Location"
            value={filters.locationId}
            onChange={(value) => updateFilter("locationId", value)}
            placeholder="Optional location id"
            disabled={loading}
          />

          <TextField
            label="Item"
            value={filters.itemId}
            onChange={(value) => updateFilter("itemId", value)}
            placeholder="Optional item id"
            disabled={loading}
          />

          <SelectField
            label="Movement Type"
            value={filters.movementType}
            onChange={(value) =>
              updateFilter("movementType", value as LedgerMovementType)
            }
            disabled={loading}
            options={[
              { value: "", label: "All movements" },
              { value: "Receipt", label: "Receipt" },
              { value: "Production", label: "Production" },
              { value: "Transfer", label: "Transfer" },
              { value: "Adjustment", label: "Adjustment" },
              { value: "Sale", label: "Sale" },
              { value: "Consumption", label: "Consumption" },
            ]}
          />

          <TextField
            label="From Date"
            type="date"
            value={filters.fromDate}
            onChange={(value) => updateFilter("fromDate", value)}
            disabled={loading}
          />

          <TextField
            label="To Date"
            type="date"
            value={filters.toDate}
            onChange={(value) => updateFilter("toDate", value)}
            disabled={loading}
          />
        </div>

        {loading ? (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            Loading ledger records…
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-danger" style={{ marginTop: 12 }}>
            <strong>Error:</strong> {String(error)}
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Ledger Movements</div>
            <div className="card-subtitle">
              Stock movement history, quantities, costing, and source document
              trail.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <LedgerTable items={items} />
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <span>
            {paging?.totalCount ?? 0} records • Page {paging?.page ?? 1} /{" "}
            {paging?.totalPages ?? 1}
          </span>

          <span>{items.length} rows loaded</span>
        </div>
      </div>

      <div
        className="card"
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10,
          backdropFilter: "blur(6px)",
          background: "rgba(255,255,255,0.95)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div className="card-subtitle">
            <strong>Debug Tip:</strong> Filter by item, location, movement type,
            and date range to trace FIFO costing and inventory flow.
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={clearFilters}
            disabled={!hasFilters || loading}
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "date";
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="form-label">{props.label}</label>
      <input
        className="form-control"
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="form-label">{props.label}</label>
      <select
        className="form-control"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        disabled={props.disabled}
      >
        {props.options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

function cleanOrNull(value: string): string | null {
  const clean = value.trim();
  return clean ? clean : null;
}