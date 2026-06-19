// src/features/sales/pages/SalesListPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";

import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../api/salesTypes";

import {
  Alert,
  Button,
  Card,
  InventoryBadge,
  Kpi,
  PaymentStatusBadge,
  SaleStatusBadge,
  dateTime,
  extractApiError,
  money,
} from "../components/pos-ui";

import "../components/pos.css";

const PAGE_SIZE = 20;

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "error"; message: string };

type SalesFilters = {
  q: string;
  status: string;
  fromDate: string;
  toDate: string;
};

type SalesPaths = {
  dashboard: string;
  pos: string;
  import: string;
  detail: (saleId: string) => string;
};

const initialFilters: SalesFilters = {
  q: "",
  status: "",
  fromDate: "",
  toDate: "",
};

export default function SalesListPage() {
  const nav = useErpNavigate();
  const { companyId, branchId } = useAppScope();

  const [items, setItems] = useState<SaleListItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<SalesFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<SalesFilters>(initialFilters);

  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const loading = pageState.status === "loading";
  const errorMessage = pageState.status === "error" ? pageState.message : null;

  const paths = useMemo<SalesPaths>(
    () => ({
      dashboard: "sales",
      pos: "pos",
      import: "sales/import",
      detail: (saleId: string) => `sales/details/${saleId}`,
    }),
    []
  );

  const go = useCallback(
    (path: string, replace = false) => {
      nav(path, { replace });
    },
    [nav]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const kpis = useMemo(() => {
    const total = items.reduce(
      (sum, sale) => sum + Number(sale.totalAmount || 0),
      0
    );

    const cogs = items.reduce(
      (sum, sale) => sum + Number(sale.totalCogs || 0),
      0
    );

    const grossProfit = total - cogs;
    const pending = items.filter((sale) => !sale.isInventoryPosted).length;
    const marginPct = total > 0 ? (grossProfit / total) * 100 : 0;

    return {
      total,
      cogs,
      grossProfit,
      pending,
      marginPct,
    };
  }, [items]);

  const updateFilter = useCallback(
    <K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const load = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      setTotalCount(0);
      setPageState({
        status: "error",
        message: "Company is not selected.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;

    setPageState({ status: "loading" });
    setNotice(null);

    try {
      const response = await salesApi.list(companyId, branchId || "", {
        page,
        pageSize: PAGE_SIZE,
        q: appliedFilters.q.trim() || undefined,
        status: appliedFilters.status
          ? Number(appliedFilters.status)
          : undefined,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
      });

      if (requestId !== requestIdRef.current) return;

      const data = (response as any).data ?? response;

      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotalCount(Number(data?.totalCount || 0));
      setPageState({ status: "loaded" });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      setItems([]);
      setTotalCount(0);
      setPageState({
        status: "error",
        message: extractApiError(error, "Failed to load sales."),
      });
    }
  }, [companyId, branchId, page, appliedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = useCallback(() => {
    setPage(1);
    setAppliedFilters(filters);
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  }, []);

  const postBulkCogs = useCallback(async () => {
    if (!companyId) {
      setPageState({
        status: "error",
        message: "Company is not selected.",
      });
      return;
    }

    setBulkBusy(true);
    setNotice(null);
    setPageState({ status: "loaded" });

    try {
      const response = await salesApi.postBulkCogs(companyId, branchId || "", {
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
      });

      const data = (response as any).data ?? response;

      setNotice(
        `Bulk COGS complete. Posted: ${data?.posted ?? 0}, skipped: ${
          data?.skipped ?? 0
        }, failed: ${data?.failed ?? 0}.`
      );

      await load();
    } catch (error) {
      setPageState({
        status: "error",
        message: extractApiError(error, "Bulk COGS posting failed."),
      });
    } finally {
      setBulkBusy(false);
    }
  }, [companyId, branchId, appliedFilters.fromDate, appliedFilters.toDate, load]);

  if (!companyId) {
    return (
      <div className="pos-page">
        <Alert tone="warning">
          Company is not selected. Open Sales from a company workspace.
        </Alert>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Register</h1>
          <p>
            POS, back-office, imported sales, COGS, and inventory posting status.
          </p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => go(paths.import)}>External Import</Button>

          <Button onClick={() => void postBulkCogs()} disabled={bulkBusy}>
            {bulkBusy ? "Posting..." : "Post Pending COGS"}
          </Button>

          <Button variant="primary" onClick={() => go(paths.pos)}>
            Open POS
          </Button>
        </div>
      </div>

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <SalesKpis kpis={kpis} />

      <Card title="Sales Register" subtitle={`${totalCount} records`}>
        <SalesFiltersBar
          filters={filters}
          loading={loading}
          onChange={updateFilter}
          onApply={applySearch}
          onClear={clearFilters}
        />

        <SalesTable
          items={items}
          loading={loading}
          onOpenSale={(saleId) => go(paths.detail(saleId))}
        />

        <PaginationBar
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        />
      </Card>
    </div>
  );
}

function SalesKpis({
  kpis,
}: {
  kpis: {
    total: number;
    cogs: number;
    grossProfit: number;
    pending: number;
    marginPct: number;
  };
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <Kpi label="Page Sales" value={money(kpis.total)} />
      <Kpi label="COGS" value={money(kpis.cogs)} />
      <Kpi label="Gross Profit" value={money(kpis.grossProfit)} />
      <Kpi label="Margin %" value={`${kpis.marginPct.toFixed(2)}%`} />
      <Kpi label="Inventory Pending" value={kpis.pending} />
    </div>
  );
}

function SalesFiltersBar({
  filters,
  loading,
  onChange,
  onApply,
  onClear,
}: {
  filters: SalesFilters;
  loading: boolean;
  onChange: <K extends keyof SalesFilters>(
    key: K,
    value: SalesFilters[K]
  ) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "end",
        marginBottom: 14,
      }}
    >
      <label className="pos-field" style={{ flex: "1 1 220px" }}>
        <span>Search</span>
        <input
          value={filters.q}
          onChange={(event) => onChange("q", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onApply();
          }}
          placeholder="Sale number or source..."
          disabled={loading}
        />
      </label>

      <label className="pos-field">
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(event) => onChange("status", event.target.value)}
          disabled={loading}
        >
          <option value="">All</option>
          <option value="1">Draft</option>
          <option value="2">Confirmed</option>
          <option value="3">Posted</option>
          <option value="4">Cancelled</option>
          <option value="5">Reversed</option>
        </select>
      </label>

      <label className="pos-field">
        <span>From</span>
        <input
          type="date"
          value={filters.fromDate}
          onChange={(event) => onChange("fromDate", event.target.value)}
          disabled={loading}
        />
      </label>

      <label className="pos-field">
        <span>To</span>
        <input
          type="date"
          value={filters.toDate}
          onChange={(event) => onChange("toDate", event.target.value)}
          disabled={loading}
        />
      </label>

      <Button onClick={onApply} disabled={loading}>
        {loading ? "Loading..." : "Search"}
      </Button>

      <Button onClick={onClear} disabled={loading}>
        Clear
      </Button>
    </div>
  );
}

function SalesTable({
  items,
  loading,
  onOpenSale,
}: {
  items: SaleListItemDto[];
  loading: boolean;
  onOpenSale: (saleId: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="pos-table">
        <thead>
          <tr>
            <th>Sale No</th>
            <th>Date</th>
            <th>Status</th>
            <th>Payment</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th style={{ textAlign: "right" }}>COGS</th>
            <th style={{ textAlign: "right" }}>Profit</th>
            <th style={{ textAlign: "right" }}>Margin</th>
            <th>Inventory</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={9}
                style={{
                  textAlign: "center",
                  color: "#6b7280",
                  padding: 30,
                }}
              >
                Loading sales...
              </td>
            </tr>
          ) : null}

          {!loading && items.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                style={{
                  textAlign: "center",
                  color: "#6b7280",
                  padding: 30,
                }}
              >
                No sales found.
              </td>
            </tr>
          ) : null}

          {!loading
            ? items.map((sale) => {
                const total = Number(sale.totalAmount || 0);
                const profit = Number(
                  sale.grossProfit ?? total - Number(sale.totalCogs || 0)
                );
                const margin = total > 0 ? (profit / total) * 100 : 0;

                return (
                  <tr
                    key={sale.id}
                    onClick={() => onOpenSale(sale.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "monospace" }}>{sale.saleNo}</td>
                    <td>{dateTime(sale.soldAtUtc)}</td>
                    <td>
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td>
                      <PaymentStatusBadge status={sale.paymentStatus} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {money(sale.totalAmount)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {money(sale.totalCogs)}
                    </td>
                    <td style={{ textAlign: "right" }}>{money(profit)}</td>
                    <td style={{ textAlign: "right" }}>{margin.toFixed(2)}%</td>
                    <td>
                      <InventoryBadge posted={sale.isInventoryPosted} />
                    </td>
                  </tr>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  loading,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 14,
      }}
    >
      <span style={{ color: "#6b7280", fontSize: 13 }}>
        Page {page} of {totalPages}
      </span>

      <div style={{ display: "flex", gap: 8 }}>
        <Button disabled={page <= 1 || loading} onClick={onPrevious}>
          Previous
        </Button>

        <Button disabled={page >= totalPages || loading} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}