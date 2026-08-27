import { memo } from "react";
import type { InventoryLedgerDto } from "../types";

function LedgerTable({ items }: { items: InventoryLedgerDto[] }) {
  return (
    <div style={styles.wrap}>
      <table style={styles.table}>
        <thead><tr>
          <Th>Posted</Th><Th>Activity</Th><Th>Document</Th><Th>Item</Th><Th>Location</Th><Th>Direction</Th>
          <Th numeric>Quantity</Th><Th numeric>Base Qty</Th><Th numeric>Qty In</Th><Th numeric>Qty Out</Th>
          <Th numeric>Balance</Th><Th numeric>Value Change</Th><Th numeric>Unit Cost</Th><Th numeric>Balance Value</Th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={14} style={styles.empty}>No ledger rows.</td></tr> : items.map((row, index) => (
            <tr key={`${index}-${row.referenceNo ?? "doc"}-${row.postedAtUtc ?? "date"}`} style={{ background: index % 2 ? "rgba(0,0,0,.015)" : "white" }}>
              <Td mono>{formatDate(row.postedAtUtc)}</Td>
              <Td><span style={styles.pill}>{humanize(row.referenceType)}</span></Td>
              <Td>{show(row.referenceNo)}</Td><Td>{show(row.itemName)}</Td><Td>{show(row.locationName)}</Td>
              <Td><Direction value={row.direction} /></Td>
              <Td numeric>{qty(row.quantity)}</Td><Td numeric>{qty(row.quantityBase)}</Td><Td numeric>{qty(row.qtyInBase)}</Td><Td numeric>{qty(row.qtyOutBase)}</Td>
              <Td numeric>{qty(row.balanceBase)}</Td><Td numeric>{money(row.valueChange)}</Td><Td numeric>{money(row.unitCost)}</Td><Td numeric>{money(row.balanceValue)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default memo(LedgerTable);

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) { return <th style={{ ...styles.th, ...(numeric ? styles.numeric : {}) }}>{children}</th>; }
function Td({ children, numeric, mono }: { children: React.ReactNode; numeric?: boolean; mono?: boolean }) { return <td style={{ ...styles.td, ...(numeric ? styles.numeric : {}), ...(mono ? styles.mono : {}) }}>{children}</td>; }
function Direction({ value }: { value: unknown }) { const v = String(value ?? "").toLowerCase(); return <span style={{ ...styles.pill, background: v === "in" ? "rgba(22,163,74,.08)" : v === "out" ? "rgba(220,38,38,.08)" : "rgba(0,0,0,.03)" }}>{show(value)}</span>; }
function show(value: unknown) { return value === null || value === undefined || value === "" ? "-" : String(value); }
function humanize(value: string | null | undefined) { return value ? value.replace("_", " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase()) : "-"; }
function formatDate(value: string | Date | null | undefined) { if (!value) return "-"; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date); }
function qty(value: unknown) { const n = Number(value); return value === null || value === undefined || value === "" ? "-" : Number.isFinite(n) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n) : String(value); }
function money(value: unknown) { const n = Number(value); return value === null || value === undefined || value === "" ? "-" : Number.isFinite(n) ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : String(value); }

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: "100%", maxHeight: "70vh", overflow: "auto", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12 },
  table: { width: "100%", minWidth: 1740, tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0, background: "white" },
  th: { position: "sticky", top: 0, zIndex: 2, background: "white", textAlign: "left", fontSize: 12, fontWeight: 800, padding: 10, borderBottom: "1px solid rgba(0,0,0,.1)", whiteSpace: "nowrap" },
  td: { padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)", fontSize: 13, verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  empty: { padding: 16, textAlign: "center", opacity: .7 },
  numeric: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12.5 },
  pill: { display: "inline-block", padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(0,0,0,.12)", background: "rgba(0,0,0,.03)", fontSize: 12, fontWeight: 700 },
};
