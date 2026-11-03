// src/features/inventory/adjustments/pages/AdjustmentListPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { adjustmentApi, getApiError } from "../api/adjustmentApi";
import { stockLocationsApi } from "../../stock-locations/api/stockLocationsApi";
import {
  ADJUSTMENT_TYPE_LABELS,
  normalizeAdjustmentStatus,
  STATUS_BADGE,
  useAdjustmentPermissions,
} from "../utils/adjustmentWorkflow";
import type { InventoryAdjustmentDto, StockLocationOption } from "../types";

const STATUS_OPTIONS = ["Draft", "Submitted", "Approved", "Posted", "Rejected", "Reversed", "Cancelled"] as const;

type LocationOption = {
  id: string;
  name: string;
  code?: string;
  isActive: boolean;
  branchName?: string;
  branchLocationName?: string;
};

function cleanString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function normalizeLocation(row: StockLocationOption | Record<string, unknown>): LocationOption | null {
  const source = row as Record<string, unknown>;
  const id = String(source.id ?? source.stockLocationId ?? source.locationId ?? source.branchLocationId ?? "").trim();
  if (!id) return null;

  return {
    id,
    name: String(source.name ?? source.locationName ?? source.stockLocationName ?? source.branchLocationName ?? "Unnamed stock location"),
    code: cleanString(source.code ?? source.locationCode ?? source.stockLocationCode),
    isActive: source.isActive !== false && source.active !== false && source.isEnabled !== false,
    branchName: cleanString(source.branchName ?? (source.branch as Record<string, unknown> | undefined)?.["name"]),
    branchLocationName: cleanString(source.branchLocationName ?? (source.branchLocation as Record<string, unknown> | undefined)?.["name"]),
  };
}

function locationLabel(location: LocationOption): string {
  const left = location.code ? `${location.code} - ${location.name}` : location.name;
  const scope = location.branchLocationName || location.branchName;
  return scope ? `${left} (${scope})` : left;
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(value: number) {
  return `ETB ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The document's value (planned until posted, then what the stock ledger posted). */
function rowAmount(row: InventoryAdjustmentDto): number {
  return Number(row.totalAdjustmentValue ?? 0);
}

function getRowLocation(row: InventoryAdjustmentDto): string {
  const source = row as InventoryAdjustmentDto & Record<string, unknown>;
  return String(source.locationName ?? source.stockLocationName ?? source.branchLocationName ?? "Unassigned location");
}

export default function AdjustmentListPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();
  const permissions = useAdjustmentPermissions();

  const [items, setItems] = useState<InventoryAdjustmentDto[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const basePath = companyId ? `/companies/${companyId}/inventory/adjustments` : "";

  const goToCreate = useCallback(() => {
    if (basePath) navigate(`${basePath}/new`);
  }, [basePath, navigate]);

  const goToDetail = useCallback((id: string) => {
    if (basePath && id) navigate(`${basePath}/${id}`);
  }, [basePath, navigate]);

  const loadLocations = useCallback(async () => {
    if (!companyId || !branchId) {
      setLocations([]);
      return;
    }

    setLocationLoading(true);
    try {
      const rows = await stockLocationsApi.list(companyId, branchId);
      setLocations(
        (Array.isArray(rows) ? rows : [])
          .map((row) => normalizeLocation(row as StockLocationOption & Record<string, unknown>))
          .filter((row): row is LocationOption => Boolean(row))
          .filter((row) => row.isActive)
      );
    } catch (error) {
      setLocations([]);
      setErr(getApiError(error, "Failed to load branch stock locations."));
    } finally {
      setLocationLoading(false);
    }
  }, [companyId, branchId]);

  const load = useCallback(async () => {
    if (!companyId || !branchId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const data = await adjustmentApi.list(companyId, branchId, {
        status: status || undefined,
        locationId: locationId || undefined,
      } as never);
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setErr(getApiError(error, "Failed to load adjustments."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, status, locationId]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const posted = items.filter((row) => normalizeAdjustmentStatus(row.docStatus) === "Posted");
    const postedValue = posted.reduce((sum, row) => sum + rowAmount(row), 0);
    const highVariance = items.filter((row) => row.hasHighVariance).length;
    const pendingApproval = items.filter((row) => normalizeAdjustmentStatus(row.docStatus) === "Submitted").length;
    const readyToPost = items.filter((row) => normalizeAdjustmentStatus(row.docStatus) === "Approved").length;
    return { postedValue, highVariance, pendingApproval, readyToPost };
  }, [items]);

  const canCreate = Boolean(companyId && branchId) && permissions.create;

  return (
    <main className="adj-page page">
      <header className="adj-header">
        <div className="adj-header-left">
          <div className="adj-kicker">Inventory</div>
          <h1>Adjustments</h1>
          <div className="adj-subtitle">Stock counts, waste, damage, and variance corrections by branch stock location.</div>
        </div>

        {permissions.create && (
          <button type="button" className="btn btn-primary" disabled={!canCreate} onClick={goToCreate}>
            <i className="ti ti-plus" aria-hidden /> New adjustment
          </button>
        )}
      </header>

      <section className="adj-metrics" aria-label="Adjustment summary">
        <Metric label="Documents" value={items.length} />
        <Metric label="Posted value" value={fmtMoney(kpis.postedValue)} sign={kpis.postedValue < 0 ? "neg" : kpis.postedValue > 0 ? "pos" : undefined} />
        <Metric label="Waiting for approval" value={kpis.pendingApproval} badge={kpis.pendingApproval > 0 ? "Action needed" : undefined} />
        <Metric label="Ready to post" value={kpis.readyToPost} badge={kpis.readyToPost > 0 ? "Action needed" : undefined} />
        <Metric label="High variance" value={kpis.highVariance} badge={kpis.highVariance > 0 ? "Review" : undefined} />
      </section>

      <section className="adj-toolbar" aria-label="Adjustment filters">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label>
          Stock location
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)} disabled={locationLoading}>
            <option value="">{locationLoading ? "Loading locations..." : "All branch stock locations"}</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
          </select>
        </label>

        <button type="button" className="btn" disabled={loading || !companyId || !branchId} onClick={() => void load()}>
          <i className="ti ti-refresh" aria-hidden /> {loading ? "Loading..." : "Refresh"}
        </button>
      </section>

      {!companyId && <div className="alert alert-warning">Select a company before opening inventory adjustments.</div>}
      {companyId && !branchId && <div className="alert alert-warning">Select a branch before loading inventory adjustments.</div>}
      {err && <div className="alert alert-danger">{err}</div>}

      <section className="adj-card adj-card-flush">
        <div className="adj-table-wrap">
          <table className="adj-table adj-list-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Document</th>
                <th>Location</th>
                <th>Type</th>
                <th>Status</th>
                <th className="num">Highest variance</th>
                <th className="num">Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="adj-empty">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="adj-empty">No adjustments found.{canCreate && <> <button type="button" className="link-button" onClick={goToCreate}>Create one</button></>}</td></tr>
              ) : (
                items.map((row) => {
                  const normalizedStatus = normalizeAdjustmentStatus(row.docStatus);
                  const amount = rowAmount(row);

                  return (
                    <tr key={row.id} className="adj-click-row" onClick={() => goToDetail(row.id)}>
                      <td className="adj-mono muted">{fmtDate(row.adjustmentDate)}</td>
                      <td>
                        <div className="adj-strong">{row.adjustmentNo || "-"}</div>
                        {row.referenceNo && <div className="adj-subline">Ref: {row.referenceNo}</div>}
                        {row.hasHighVariance && <div className="adj-warning-line">Warning: High variance {row.highestVariancePercent?.toFixed(1) ?? "0.0"}%</div>}
                      </td>
                      <td>{getRowLocation(row)}</td>
                      <td>{ADJUSTMENT_TYPE_LABELS[String(row.adjustmentType)] ?? row.adjustmentType ?? "-"}</td>
                      <td>
                        <span className={STATUS_BADGE[normalizedStatus]}>{normalizedStatus}</span>
                        {normalizedStatus === "Rejected" && row.rejectionNote && <div className="adj-danger-line" title={row.rejectionNote}>{row.rejectionNote}</div>}
                        {normalizedStatus === "Approved" && row.autoApproved && <div className="adj-subline">Within policy</div>}
                      </td>
                      <td className="num adj-mono">{Number(row.highestVariancePercent ?? 0).toFixed(1)}%</td>
                      <td className="num adj-mono adj-strong" data-sign={amount < 0 ? "neg" : amount > 0 ? "pos" : undefined}>{fmtMoney(amount)}</td>
                      <td className="num"><button type="button" className="btn btn-sm" onClick={(event) => { event.stopPropagation(); goToDetail(row.id); }}>Open</button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, sign, badge }: { label: string; value: string | number; sign?: "neg" | "pos"; badge?: string }) {
  return (
    <div className="adj-metric">
      <div className="adj-metric-label">{label}</div>
      <div className="adj-metric-value" data-sign={sign}>{value}</div>
      {badge && <div className="kpi-badge badge-warn">{badge}</div>}
    </div>
  );
}
