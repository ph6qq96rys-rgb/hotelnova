// src/features/sales/pages/SaleDetailPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
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

type PageState = "idle" | "loading" | "ready" | "notFound" | "error";

export default function SaleDetailPage() {
  const navigate = useNavigate();
  const { saleId } = useParams<{ saleId: string }>();
  const { companyId, branchId } = useAppScope();

  const [sale, setSale] = useState<SaleDto | null>(null);
  const [state, setState] = useState<PageState>("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasScope = Boolean(companyId && branchId);
  const hasSaleId = Boolean(saleId?.trim());

  const grossProfit = useMemo(() => {
    if (!sale) return 0;
    return sale.grossProfit ?? sale.totalAmount - sale.totalCogs;
  }, [sale]);

  const marginPct = useMemo(() => {
    if (!sale || sale.totalAmount <= 0) return "0.00%";
    return `${((grossProfit / sale.totalAmount) * 100).toFixed(2)}%`;
  }, [sale, grossProfit]);

  const load = useCallback(async () => {
    setErr(null);
    setNotice(null);

    if (!hasScope) {
      setSale(null);
      setState("error");
      setErr("Missing company or branch scope. Please reopen the sale from the sales register.");
      return;
    }

    if (!hasSaleId) {
      setSale(null);
      setState("error");
      setErr("Missing sale id. Please reopen the sale from the sales register.");
      return;
    }

    setState("loading");

    try {
      const response = await salesApi.get(companyId, branchId, saleId!);
      const data = (response as any).data ?? response ?? null;

      setSale(data);
      setState(data ? "ready" : "notFound");
    } catch (e: any) {
      setSale(null);

      if (e?.response?.status === 404) {
        setState("notFound");
        setErr("Sale not found for the selected company and branch.");
      } else {
        setState("error");
        setErr(extractApiError(e, "Failed to load sale."));
      }
    }
  }, [companyId, branchId, saleId, hasScope, hasSaleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryInventoryPosting() {
    if (!sale || !companyId || !branchId) return;

    setBusy(true);
    setErr(null);
    setNotice(null);

    try {
      await salesApi.postCogs(companyId, branchId, sale.id);
      setNotice("Inventory posting retry completed.");
      await load();
    } catch (e) {
      setErr(extractApiError(e, "Inventory posting retry failed."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelSale() {
    if (!sale || !companyId || !branchId) return;

    const confirmed = window.confirm(`Cancel sale ${sale.saleNo}?`);
    if (!confirmed) return;

    setBusy(true);
    setErr(null);
    setNotice(null);

    try {
      await salesApi.cancel(companyId, branchId, sale.id, "Cancelled from UI");
      navigate("/sales");
    } catch (e) {
      setErr(extractApiError(e, "Failed to cancel sale."));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "idle") {
    return (
      <div className="pos-page">
        <Alert>Loading sale...</Alert>
      </div>
    );
  }

  if (state === "error" || state === "notFound" || !sale) {
    return (
      <div className="pos-page">
        <Alert tone="danger">
          {err ?? "Sale could not be loaded."}
        </Alert>
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate("/sales")}>Back to Sales</Button>
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
          <Button onClick={() => navigate("/sales")}>Back</Button>

          {!sale.isInventoryPosted && (
            <Button onClick={retryInventoryPosting} disabled={busy}>
              {busy ? "Retrying..." : "Retry Inventory Posting"}
            </Button>
          )}

          <Button variant="danger" onClick={cancelSale} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>

      {err && <Alert tone="danger">{err}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

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

      <Card title="Sale Status">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SaleStatusBadge status={sale.status} />
          <PaymentStatusBadge status={sale.paymentStatus} />
          <InventoryBadge posted={sale.isInventoryPosted} />
        </div>
      </Card>

      <div style={{ height: 14 }} />

      <Card title="Inventory Status">
        {sale.isInventoryPosted ? (
          <Alert tone="success">
            Inventory and COGS were posted automatically by the backend workflow.
          </Alert>
        ) : (
          <Alert tone="warning">
            Inventory posting did not complete during sale processing. Review recipe setup,
            FIFO stock, and consumption locations, then retry inventory posting.
          </Alert>
        )}
      </Card>

      <div style={{ height: 14 }} />

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
            {(sale.saleItems ?? []).length === 0 ? (
              <tr>
                <td colSpan={5}>No sale items found.</td>
              </tr>
            ) : (
              sale.saleItems.map((item) => (
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

      <div style={{ height: 14 }} />

      <Card title="Inventory Consumption Audit">
        {sale.isInventoryPosted ? (
          <SaleInventoryConsumptionPanel saleId={sale.id} />
        ) : (
          <Alert tone="warning">
            Inventory audit is not available until inventory posting succeeds.
          </Alert>
        )}
      </Card>

      <div style={{ height: 14 }} />

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
            {(sale.payments ?? []).length === 0 ? (
              <tr>
                <td colSpan={4}>No payments found.</td>
              </tr>
            ) : (
              sale.payments.map((payment) => (
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
    </div>
  );
}