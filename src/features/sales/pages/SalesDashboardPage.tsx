// src/features/sales/pages/SalesDashboardPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  Monitor,
  ShoppingCart,
  Upload,
  AlertTriangle,
} from "lucide-react";

import { useAppScope } from "../../../app/useAppScope";
import { salesApi } from "../api/salesApi";
import type { SaleListItemDto } from "../api/salesTypes";
import {
  Alert,
  Button,
  Card,
  Kpi,
  InventoryBadge,
  SaleStatusBadge,
  PaymentStatusBadge,
  money,
  dateTime,
  extractApiError,
} from "../components/pos-ui";

import "../components/pos.css";

const TODAY = new Date().toISOString().slice(0, 10);

export default function SalesDashboardPage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [sales, setSales] = useState<SaleListItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!companyId || !branchId) return;

    setLoading(true);
    setErr(null);

    try {
      const response = await salesApi.list(companyId, branchId, {
        page: 1,
        pageSize: 50,
        fromDate: TODAY,
        toDate: TODAY,
      });

      const data = (response as any).data ?? response;
      setSales(data.items ?? []);
    } catch (e) {
      setErr(extractApiError(e, "Failed to load dashboard."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId, branchId]);

  const summary = useMemo(() => {
    const totalSales = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);
    const totalCogs = sales.reduce((s, x) => s + (x.totalCogs || 0), 0);
    const grossProfit = totalSales - totalCogs;
    const avgTicket = sales.length > 0 ? totalSales / sales.length : 0;
    const pendingInventory = sales.filter((x) => !x.isInventoryPosted).length;
    const postedInventory = sales.filter((x) => x.isInventoryPosted).length;

    return {
      totalSales,
      totalCogs,
      grossProfit,
      margin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
      transactions: sales.length,
      avgTicket,
      pendingInventory,
      postedInventory,
    };
  }, [sales]);

  return (
    <div className="pos-page">
      <div className="pos-topbar">
        <div className="pos-title">
          <h1>Sales Dashboard</h1>
          <p>Today&apos;s sales, COGS, gross profit, and POS activity.</p>
        </div>

        <div className="pos-actions">
          <Button onClick={() => nav("/sales/pos")}>
            <Monitor size={16} /> POS Terminal
          </Button>
          <Button onClick={() => nav("/sales/pos/session")}>
            <CalendarClock size={16} /> Session
          </Button>
          <Button onClick={() => nav("/sales/import")}>
            <Upload size={16} /> Import
          </Button>
          <Button variant="primary" onClick={() => nav("/sales/list")}>
            <ShoppingCart size={16} /> Sales Register
          </Button>
        </div>
      </div>

      {err && <Alert tone="danger">{err}</Alert>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Kpi label="Today's Sales" value={money(summary.totalSales)} />
        <Kpi label="COGS" value={money(summary.totalCogs)} />
        <Kpi label="Gross Profit" value={money(summary.grossProfit)} />
        <Kpi label="Margin" value={`${summary.margin.toFixed(1)}%`} />
        <Kpi label="Transactions" value={summary.transactions} />
        <Kpi label="Average Ticket" value={money(summary.avgTicket)} />
        <Kpi label="Inventory Posted" value={summary.postedInventory} />
        <Kpi label="Inventory Pending" value={summary.pendingInventory} />
      </div>

      {summary.pendingInventory > 0 && (
        <Alert tone="warning">
          <AlertTriangle size={16} /> {summary.pendingInventory} sale(s) still need
          inventory/COGS posting.
        </Alert>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 0.8fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <Card
          title="Recent Sales"
          subtitle={loading ? "Loading..." : `${sales.length} sale(s) today`}
          action={
            <Button size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <div style={{ overflowX: "auto" }}>
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Sale No</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th>Inventory</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 28 }}>
                      No sales found for today.
                    </td>
                  </tr>
                ) : (
                  sales.slice(0, 10).map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => nav(`/sales/${sale.id}`)}
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
                      <td>
                        <InventoryBadge posted={sale.isInventoryPosted} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Quick Actions" subtitle="Restaurant POS workflow">
          <div style={{ display: "grid", gap: 10 }}>
            <Button variant="primary" size="lg" block onClick={() => nav("/sales/pos")}>
              <Monitor size={16} /> Start New Order
            </Button>

            <Button block onClick={() => nav("/sales/pos/session")}>
              <CalendarClock size={16} /> Open / Close Session
            </Button>

            <Button block onClick={() => nav("/sales/list")}>
              <ShoppingCart size={16} /> View Sales Register
            </Button>

            <Button block onClick={() => nav("/sales/reports")}>
              <BarChart3 size={16} /> Sales Reports
            </Button>

            <Button block onClick={() => nav("/sales/import")}>
              <Upload size={16} /> External POS Import
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}