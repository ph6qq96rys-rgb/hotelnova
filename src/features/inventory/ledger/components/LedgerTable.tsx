import React from "react";

type AnyRow = Record<string, any>;

export default function LedgerTable(props: { items: AnyRow[] }) {
  const { items } = props;

  return (
    <div style={wrap}>
      <table style={table}>
        <thead style={thead}>
          <tr>
            <th style={{ ...th, ...w120 }}>Date</th>
            <th style={{ ...th, ...w110 }}>Type</th>
            <th style={{ ...th, ...w160 }}>Document</th>
            <th style={{ ...th, ...w220 }}>Item</th>
            <th style={{ ...th, ...w180 }}>Location</th>

            <th style={{ ...th, ...w100 }}>Direction</th>
            <th style={{ ...th, ...w110, ...num }}>Quantity</th>
            <th style={{ ...th, ...w110, ...num }}>Qty Base</th>
            <th style={{ ...th, ...w110, ...num }}>Qty In</th>
            <th style={{ ...th, ...w110, ...num }}>Qty Out</th>

            <th style={{ ...th, ...w120, ...num }}>Balance</th>
            <th style={{ ...th, ...w140, ...num }}>Amount</th>
            <th style={{ ...th, ...w120, ...num }}>Unit Cost</th>
            <th style={{ ...th, ...w260 }}>Notes</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td style={empty} colSpan={14}>
                No ledger rows.
              </td>
            </tr>
          ) : (
            items.map((r, i) => {
              const date = r.postedAtUtc ?? r.postedAt ?? r.date ?? "";
              const type = r.referenceType ?? r.sourceType ?? r.type ?? "";
              const doc = r.referenceNo ?? r.sourceNo ?? r.documentNo ?? "";

              const item = r.itemName ?? r.itemCode ?? r.itemId ?? "";
              const loc = r.locationName ?? r.stockLocationName ?? r.locationId ?? "";

              const direction = r.direction ?? "";
              const quantity = n(r.quantity ?? r.qty);
              const quantityBase = n(r.quantityBase ?? r.qtyBase);

              const qtyIn = n(r.qtyInBase ?? (isIn(direction) ? r.quantityBase ?? r.qtyBase : 0));
              const qtyOut = n(r.qtyOutBase ?? (isOut(direction) ? r.quantityBase ?? r.qtyBase : 0));

              const balance = n(r.balanceBase ?? r.runningQty ?? r.remainingQty);
              const amount = money(r.valueChange ?? r.amount ?? r.totalAmount);
              const unitCost = money(r.unitCost ?? r.costPerUnit);
              const notes = r.notes ?? r.note ?? r.memo ?? "";

              return (
                <tr key={r.id ?? `${i}-${doc}-${date}`} style={row(i)}>
                  <td style={td}><span style={mono}>{fmtDate(date)}</span></td>
                  <td style={td}><span style={pill}>{String(type || "—")}</span></td>
                  <td style={td}><span style={truncate} title={String(doc)}>{String(doc || "—")}</span></td>
                  <td style={td}><span style={truncate} title={String(item)}>{String(item || "—")}</span></td>
                  <td style={td}><span style={truncate} title={String(loc)}>{String(loc || "—")}</span></td>

                  <td style={td}>
                    <span style={directionPill(direction)}>{String(direction || "—")}</span>
                  </td>

                  <td style={{ ...td, ...num }}><span style={mono}>{quantity}</span></td>
                  <td style={{ ...td, ...num }}><span style={mono}>{quantityBase}</span></td>
                  <td style={{ ...td, ...num }}><span style={mono}>{qtyIn}</span></td>
                  <td style={{ ...td, ...num }}><span style={mono}>{qtyOut}</span></td>

                  <td style={{ ...td, ...num }}><span style={mono}>{balance}</span></td>
                  <td style={{ ...td, ...num }}><span style={mono}>{amount}</span></td>
                  <td style={{ ...td, ...num }}><span style={mono}>{unitCost}</span></td>

                  <td style={td}>
                    <span style={truncate} title={String(notes)}>
                      {String(notes || "—")}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function fmtDate(value: any): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function n(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  const x = Number(value);
  if (!Number.isFinite(x)) return String(value);
  return x.toFixed(3).replace(/\.?0+$/, "");
}

function money(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  const x = Number(value);
  if (!Number.isFinite(x)) return String(value);
  return x.toFixed(2);
}

function isIn(value: any): boolean {
  return String(value ?? "").trim().toLowerCase() === "in";
}

function isOut(value: any): boolean {
  return String(value ?? "").trim().toLowerCase() === "out";
}

function directionPill(value: any): React.CSSProperties {
  const input = String(value ?? "").trim().toLowerCase();

  return {
    ...pill,
    fontWeight: 900,
    background:
      input === "in"
        ? "rgba(22, 163, 74, 0.08)"
        : input === "out"
        ? "rgba(220, 38, 38, 0.08)"
        : "rgba(0,0,0,0.03)",
  };
}

const wrap: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  minWidth: 1650,
  background: "white",
};

const thead: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "white",
};

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  letterSpacing: 0.2,
  fontWeight: 800,
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.10)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  fontSize: 13,
  verticalAlign: "middle",
};

const empty: React.CSSProperties = {
  padding: 16,
  fontSize: 13,
  opacity: 0.7,
  textAlign: "center",
};

const num: React.CSSProperties = {
  textAlign: "right",
};

const mono: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 12.5,
};

const truncate: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pill: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(0,0,0,0.03)",
  fontSize: 12,
  fontWeight: 700,
};

function row(index: number): React.CSSProperties {
  return {
    background: index % 2 === 0 ? "white" : "rgba(0,0,0,0.015)",
  };
}

const w100: React.CSSProperties = { width: 100 };
const w110: React.CSSProperties = { width: 110 };
const w120: React.CSSProperties = { width: 120 };
const w140: React.CSSProperties = { width: 140 };
const w160: React.CSSProperties = { width: 160 };
const w180: React.CSSProperties = { width: 180 };
const w220: React.CSSProperties = { width: 220 };
const w260: React.CSSProperties = { width: 260 };