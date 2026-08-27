import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { posApi } from "../api/posApi";
import { useAppScope } from "../../../app/useAppScope";
import { extractApiError } from "../utils/posUtils";
import type { Guid, SaleInventoryConsumptionDto } from "../types/posTypes";
import { money, Spinner } from "./posUi";

export function SaleInventoryConsumptionPanel({
  saleId,
}: {
  saleId: Guid;
}) {
  const { companyId, branchId } = useAppScope();
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
        const data = await posApi.saleInventoryConsumption({ companyId, branchId }, saleId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            extractApiError(err, "Failed to load inventory consumption.")
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
  }, [saleId, companyId, branchId]);

  const totalCost = rows.reduce((sum, x) => sum + x.totalCost, 0);

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>Inventory Consumption</h3>
        {loading && (
          <span style={styles.spinner}>
            <Spinner />
          </span>
        )}
      </div>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div style={styles.empty}>
          No inventory consumption posted yet.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headRow}>
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
                  <tr key={x.id} style={styles.bodyRow}>
                    <td>{x.menuItemName}</td>
                    <td>{x.inventoryItemName}</td>
                    <td>{x.stockLocationName}</td>
                    <td>{x.quantityBase.toFixed(6)}</td>
                    <td>{x.baseUomName}</td>
                    <td>{money(x.unitCost)}</td>
                    <td>{money(x.totalCost)}</td>
                    <td>{x.batchNo || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.total}>
            Total COGS: {money(totalCost)}
          </div>
        </>
      )}
    </section>
  );
}

const styles = {
  panel: {
    marginTop: 14,
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 18,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.25,
  },
  spinner: {
    display: "inline-flex",
    borderRadius: 999,
    background: "#0f172a",
    padding: 4,
  },
  error: {
    marginTop: 10,
    color: "#b91c1c",
    fontSize: 13,
  },
  empty: {
    marginTop: 10,
    color: "#475569",
    fontSize: 13,
  },
  tableWrap: {
    marginTop: 12,
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    color: "#111827",
  },
  headRow: {
    color: "#475569",
    textAlign: "left",
    background: "#f8fafc",
  },
  bodyRow: {
    borderTop: "1px solid #e5e7eb",
  },
  total: {
    marginTop: 12,
    textAlign: "right",
    fontWeight: 800,
    color: "#0f172a",
  },
} satisfies Record<string, CSSProperties>;
