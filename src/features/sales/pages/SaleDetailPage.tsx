// src/features/sales/pages/SaleDetailPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useAppScope } from "../../../app/useAppScope";
import { useErpNavigate } from "../../../routes/useErpNavigation";

import { salesApi } from "../api/salesApi";
import type { SaleDto } from "../api/salesTypes";
import { SaleInventoryConsumptionPanel } from "../../pos/components/SaleInventoryConsumptionPanel";

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

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "notFound"; message: string }
  | { status: "error"; message: string };

type SalePaths = {
  dashboard: string;
  register: string;
  saleDetail: (saleId: string) => string;
};

export default function SaleDetailPage() {
  const nav = useErpNavigate();
  const { saleId } = useParams<{ saleId: string }>();
  const { companyId, branchId } = useAppScope();

  const [sale, setSale] = useState<SaleDto | null>(null);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const paths = useMemo<SalePaths>(
    () => ({
      dashboard: "sales",
      register: "sales/list",
      saleDetail: (id: string) => `sales/details/${id}`,
    }),
    []
  );

  const go = useCallback(
    (path: string, replace = false) => {
      nav(path, { replace });
    },
    [nav]
  );

  const normalizedSaleId = saleId?.trim() ?? "";
  const hasCompanyScope = Boolean(companyId);

  const grossProfit = useMemo(() => {
    if (!sale) return 0;

    return Number(
      sale.grossProfit ??
        Number(sale.totalAmount || 0) - Number(sale.totalCogs || 0)
    );
  }, [sale]);

  const marginPct = useMemo(() => {
    if (!sale || Number(sale.totalAmount || 0) <= 0) return "0.00%";

    return `${((grossProfit / Number(sale.totalAmount || 0)) * 100).toFixed(2)}%`;
  }, [sale, grossProfit]);

  const errorMessage =
    pageState.status === "error" || pageState.status === "notFound"
      ? pageState.message
      : null;

  const load = useCallback(async () => {
    setNotice(null);

    if (!hasCompanyScope || !companyId) {
      setSale(null);
      setPageState({
        status: "error",
        message:
          "Missing company scope. Please reopen the sale from the sales register.",
      });
      return;
    }

    if (!normalizedSaleId) {
      setSale(null);
      setPageState({
        status: "error",
        message: "Missing sale id. Please reopen the sale from the sales register.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;

    setPageState({ status: "loading" });

    try {
      const response = await salesApi.get(
        companyId,
        branchId || "",
        normalizedSaleId
      );

      const data = (response as any).data ?? response ?? null;

      if (requestId !== requestIdRef.current) return;

      if (!data) {
        setSale(null);
        setPageState({
          status: "notFound",
          message: "Sale not found for the selected company.",
        });
        return;
      }

      setSale(data);
      setPageState({ status: "ready" });
    } catch (error: any) {
      if (requestId !== requestIdRef.current) return;

      setSale(null);

      if (error?.response?.status === 404) {
        setPageState({
          status: "notFound",
          message: "Sale not found for the selected company.",
        });
        return;
      }

      setPageState({
        status: "error",
        message: extractApiError(error, "Failed to load sale."),
      });
    }
  }, [companyId, branchId, hasCompanyScope, normalizedSaleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryInventoryPosting = useCallback(async () => {
    if (!sale || !companyId) return;

    setBusy(true);
    setNotice(null);

    try {
      await salesApi.postCogs(companyId, branchId || "", sale.id);
      setNotice("Inventory posting retry completed.");
      await load();
    } catch (error) {
      setPageState({
        status: "error",
        message: extractApiError(error, "Inventory posting retry failed."),
      });
    } finally {
      setBusy(false);
    }
  }, [sale, companyId, branchId, load]);

  const cancelSale = useCallback(async () => {
    if (!sale || !companyId) return;

    const confirmed = window.confirm(`Cancel sale ${sale.saleNo}?`);
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);

    try {
      await salesApi.cancel(companyId, branchId || "", sale.id, "Cancelled from UI");
      go(paths.register, true);
    } catch (error) {
      setPageState({
        status: "error",
        message: extractApiError(error, "Failed to cancel sale."),
      });
    } finally {
      setBusy(false);
    }
  }, [sale, companyId, branchId, paths.register, go]);

  if (!companyId) {
    return (
      <div className="pos-page">
        <Alert tone="warning">
          Company context is required before opening sale details.
        </Alert>
      </div>
    );
  }

  if (pageState.status === "idle" || pageState.status === "loading") {
    return (
      <div className="pos-page">
        <Alert>Loading sale...</Alert>
      </div>
    );
  }

  if (!sale || pageState.status === "error" || pageState.status === "notFound") {
    return (
      <div className="pos-page">
        <Alert tone="danger">{errorMessage ?? "Sale could not be loaded."}</Alert>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Button onClick={() => go(paths.register)}>Back to Sales Register</Button>
          <Button onClick={() => void load()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>{sale.saleNo}</h1>
          <p>{dateTime(sale.soldAtUtc)}</p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => go(paths.register)}>Back</Button>

          {!sale.isInventoryPosted ? (
            <Button onClick={() => void retryInventoryPosting()} disabled={busy}>
              {busy ? "Retrying..." : "Retry Inventory Posting"}
            </Button>
          ) : null}

          <Button variant="danger" onClick={() => void cancelSale()} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <SaleKpis sale={sale} grossProfit={grossProfit} marginPct={marginPct} />

      <Card title="Sale Status">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SaleStatusBadge status={sale.status} />
          <PaymentStatusBadge status={sale.paymentStatus} />
          <InventoryBadge posted={sale.isInventoryPosted} />
        </div>
      </Card>

      <Spacer />

      <Card title="Inventory Status">
        {sale.isInventoryPosted ? (
          <Alert tone="success">
            Inventory and COGS were posted automatically by the backend workflow.
          </Alert>
        ) : (
          <Alert tone="warning">
            Inventory posting did not complete during sale processing. Review
            recipe setup, FIFO stock, and consumption locations, then retry
            inventory posting.
          </Alert>
        )}
      </Card>

      <Spacer />

      <SaleItemsCard sale={sale} />

      <Spacer />

      <Card title="Inventory Consumption Audit">
        {sale.isInventoryPosted ? (
          <SaleInventoryConsumptionPanel saleId={sale.id} />
        ) : (
          <Alert tone="warning">
            Inventory audit is not available until inventory posting succeeds.
          </Alert>
        )}
      </Card>

      <Spacer />

      <PaymentsCard sale={sale} />
    </div>
  );
}

function SaleKpis({
  sale,
  grossProfit,
  marginPct,
}: {
  sale: SaleDto;
  grossProfit: number;
  marginPct: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(130px, 1fr))",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <Kpi label="Total" value={money(sale.totalAmount)} />
      <Kpi label="COGS" value={money(sale.totalCogs)} />
      <Kpi label="Gross Profit" value={money(grossProfit)} />
      <Kpi label="Margin %" value={marginPct} />
      <Kpi label="Menu Lines" value={sale.saleItems?.length ?? 0} />
      <Kpi label="Payments" value={sale.payments?.length ?? 0} />
    </div>
  );
}

function SaleItemsCard({ sale }: { sale: SaleDto }) {
  const items = sale.saleItems ?? [];

  return (
    <Card title="Items">
      <table className="pos-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style={{ textAlign: "right" }}>Qty</th>
            <th style={{ textAlign: "right" }}>Price</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th style={{ textAlign: "right" }}>COGS</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5}>No sale items found.</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.menuItemName}</td>
                <td style={{ textAlign: "right" }}>{item.quantity}</td>
                <td style={{ textAlign: "right" }}>{money(item.unitPrice)}</td>
                <td style={{ textAlign: "right" }}>{money(item.lineTotal)}</td>
                <td style={{ textAlign: "right" }}>{money(item.lineCogs)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function PaymentsCard({ sale }: { sale: SaleDto }) {
  const payments = sale.payments ?? [];

  return (
    <Card title="Payments">
      <table className="pos-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Reference</th>
            <th>Date</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>

        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={4}>No payments found.</td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.method}</td>
                <td>{payment.referenceCode || "—"}</td>
                <td>{dateTime(payment.paidAt)}</td>
                <td style={{ textAlign: "right" }}>{money(payment.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function Spacer() {
  return <div style={{ height: 14 }} />;
}