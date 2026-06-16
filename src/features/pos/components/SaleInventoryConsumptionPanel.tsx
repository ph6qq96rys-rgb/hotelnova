import { useEffect, useState } from "react";
import { posApi } from "../api/posApi";
import type { Guid, SaleInventoryConsumptionDto } from "../types/posTypes";
import { Card, money, Spinner } from "./posUi";

export function SaleInventoryConsumptionPanel({
  saleId,
}: {
  saleId: Guid;
}) {
  const [rows, setRows] = useState<SaleInventoryConsumptionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!saleId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await posApi.saleInventoryConsumption(saleId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load inventory consumption."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const totalCost = rows.reduce((sum, x) => sum + x.totalCost, 0);

  return (
    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ marginTop: 0 }}>Inventory Consumption</h3>
        {loading && <Spinner />}
      </div>

      {error && (
        <div style={{ color: "#F87171", fontSize: 13 }}>{error}</div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div style={{ color: "#71717A", fontSize: 13 }}>
          No inventory consumption posted yet.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#A1A1AA", textAlign: "left" }}>
                  <th>Menu Item</th>
                  <th>Ingredient</th>
                  <th>Location</th>
                  <th>Qty</th>
                  <th>UOM</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                  <th>Batch</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <td>{x.menuItemName}</td>
                    <td>{x.inventoryItemName}</td>
                    <td>{x.stockLocationName}</td>
                    <td>{x.quantityBase.toFixed(6)}</td>
                    <td>{x.baseUomName}</td>
                    <td>{money(x.unitCost)}</td>
                    <td>{money(x.totalCost)}</td>
                    <td>{x.batchNo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, textAlign: "right", fontWeight: 800 }}>
            Total COGS: {money(totalCost)}
          </div>
        </>
      )}
    </Card>
  );
}