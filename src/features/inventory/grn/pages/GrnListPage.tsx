import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../api/grnApi";
import GrnRegisterTable from "../components/GrnRegisterTable";
import type { GrnListDto } from "../types/grn.types";
import {
  canReverseGrn,
  formatGrnStatusLabel,
  GRN_STATUS_OPTIONS,
  normalizeGrnStatus,
} from "../helpers/grn.status";
import type { GrnStatus, GrnStatusFilter } from "../helpers/grn.status";
import {
  formatMoney,
  getGrnBranchWarehouse,
  getGrnNumber,
  getGrnReceiptDate,
  getGrnTotal,
} from "../helpers/grn.formatters";

import "../styles/GrnPages.erp.css";

export default function GrnListPage() {
  const navigate = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [rows, setRows] = useState<GrnListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<GrnStatusFilter>("ALL");

  const scope = useMemo(
    () => ({
      companyId: companyId ?? "",
      branchId: branchId ?? undefined,
    }),
    [branchId, companyId],
  );

  const load = useCallback(async () => {
    if (!scope.companyId) return;

    setLoading(true);
    setError("");

    try {
      const data = await grnApi.list(scope, {
        status: toApiStatusFilter(statusFilter),
      });

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(
    () => searchGrnRows(rows, query),
    [query, rows],
  );

  const dashboard = useMemo(() => buildGrnDashboard(rows), [rows]);

  const openReceipt = useCallback(
    (row: GrnListDto) => {
      if (!scope.companyId) return;
      navigate(buildGrnDetailPath(scope.companyId, row.id, scope.branchId));
    },
    [navigate, scope],
  );

  const createReceipt = useCallback(() => {
    if (!scope.companyId) return;
    navigate(buildGrnNewPath(scope.companyId, scope.branchId));
  }, [navigate, scope]);

  if (!companyId) {
    return (
      <main className="page erp-grn-page">
        <section className="erp-empty-state">
          <h2>Select a company</h2>
          <p>Select a company workspace before viewing goods receipts.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page erp-grn-page">
      <header className="erp-grn-hero">
        <div>
          <div className="erp-kicker">Inventory - Receiving</div>
          <h1>Goods Receipts</h1>
          <p>
            Track supplier receipts, posting, FIFO creation, and reversal readiness
            from one operational register.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={createReceipt}>
          + New Goods Receipt
        </button>
      </header>

      <section className="erp-grn-kpis" aria-label="Goods receipt summary">
        <Kpi label="Today's Receipts" value={dashboard.todaysReceipts} />
        <Kpi label="Awaiting Posting" value={dashboard.awaitingPosting} />
        <Kpi label="Posted Today" value={dashboard.postedToday} />
        <Kpi label="Reversible" value={dashboard.reversible} />
        <Kpi label="Inventory Value" value={formatMoney(dashboard.inventoryValue)} />
      </section>

      <section className="card erp-grn-card">
        <div className="erp-grn-toolbar">
          <div>
            <h2>Receipt Register</h2>
            <p>Open a receipt to review items, post drafts, or reverse posted receipts.</p>
          </div>

          <div className="erp-grn-filters">
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GRN, supplier, warehouse, or status"
              disabled={loading}
              aria-label="Search goods receipts"
            />

            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as GrnStatusFilter)}
              disabled={loading}
              aria-label="Filter by status"
            >
              {GRN_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button type="button" className="btn btn-sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <GrnRegisterTable rows={visibleRows} loading={loading} onOpen={openReceipt} />
      </section>
    </main>
  );
}


type GrnDashboard = {
  todaysReceipts: number;
  awaitingPosting: number;
  postedToday: number;
  reversible: number;
  inventoryValue: number;
};

function buildGrnDashboard(rows: GrnListDto[]): GrnDashboard {
  const today = new Date().toISOString().slice(0, 10);

  return rows.reduce<GrnDashboard>(
    (dashboard, row) => {
      const status = normalizeGrnStatus(row.status);
      const receiptDate = getGrnReceiptDate(row);
      const receiptDay = receiptDate ? receiptDate.slice(0, 10) : "";

      if (receiptDay === today) {
        dashboard.todaysReceipts += 1;
      }

      if (status === "DRAFT" || status === "SUBMITTED" || status === "APPROVED") {
        dashboard.awaitingPosting += 1;
      }

      if (status === "POSTED" && receiptDay === today) {
        dashboard.postedToday += 1;
      }

      if (canReverseGrn(row)) {
        dashboard.reversible += 1;
      }

      dashboard.inventoryValue += getGrnTotal(row);
      return dashboard;
    },
    {
      todaysReceipts: 0,
      awaitingPosting: 0,
      postedToday: 0,
      reversible: 0,
      inventoryValue: 0,
    },
  );
}

function buildGrnDetailPath(companyId: string, grnId: string, branchId?: string): string {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);

  const queryString = params.toString();
  return `/companies/${companyId}/grns/${grnId}${queryString ? `?${queryString}` : ""}`;
}

function buildGrnNewPath(companyId: string, branchId?: string): string {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);

  const queryString = params.toString();
  return `/companies/${companyId}/grns/new${queryString ? `?${queryString}` : ""}`;
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load goods receipts. Please try again.";
}

function searchGrnRows(rows: GrnListDto[], query: string): GrnListDto[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((row) => {
    const status = normalizeGrnStatus(row.status);
    const searchableText = [
      getGrnNumber(row),
      row.supplierName,
      getGrnBranchWarehouse(row),
      formatGrnStatusLabel(status),
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(needle);
  });
}

export function toApiStatusFilter(
  status: GrnStatusFilter,
): GrnStatus | undefined {
  return status === "ALL" ? undefined : status;
}
function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="erp-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
