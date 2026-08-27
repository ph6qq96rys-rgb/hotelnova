import { memo } from "react";
import type { InventoryLotDto } from "../types";

function LotsTable({ lots }: { lots: InventoryLotDto[] }) {
  if (!lots.length) {
    return <div className="inventory-ledger-empty-state" role="status"><div className="card-title">No open FIFO lots</div><div className="card-subtitle">Remaining layers appear after receipts or production output are posted.</div></div>;
  }

  return <div style={{ width: "100%", overflowX: "auto" }}><table className="table" style={{ minWidth: 760 }}><thead><tr><th>Received</th><th>Item</th><th style={numeric}>Remaining Qty</th><th style={numeric}>Unit Cost</th><th style={numeric}>Remaining Value</th></tr></thead><tbody>{lots.map((lot) => <tr key={lot.id}><td>{date(lot.receivedAtUtc)}</td><td>{lot.itemName ?? "Unnamed item"}</td><td style={numeric}>{quantity(lot.remainingQty)}</td><td style={numeric}>{money(lot.unitCost)}</td><td style={numeric}>{money(lot.remainingQty * lot.unitCost)}</td></tr>)}</tbody></table></div>;
}
export default memo(LotsTable);

const numeric: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };
function date(value: string | Date) { const d = value instanceof Date ? value : new Date(value); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
function quantity(value: number) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value); }
function money(value: number) { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
