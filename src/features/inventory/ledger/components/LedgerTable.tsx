import type { InventoryLedgerDto } from "../types";

export default function LedgerTable({ items }: { items: InventoryLedgerDto[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Item</th>
          <th>Location</th>
          <th>Type</th>
          <th>Qty</th>
          <th>Unit Cost</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {items.map(x => (
          <tr key={x.id}>
            <td>{new Date(x.createdAtUtc).toLocaleString()}</td>
            <td>{x.itemName ?? x.itemId}</td>
            <td>{x.locationName ?? x.locationId}</td>
            <td>{x.movementType}</td>
            <td className={x.quantity < 0 ? "neg" : "pos"}>
              {x.quantity}
            </td>
            <td>{x.unitCost.toFixed(2)}</td>
            <td>{(x.quantity * x.unitCost).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
