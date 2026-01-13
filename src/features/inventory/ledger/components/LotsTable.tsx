import type { InventoryLotDto } from "../types";

export default function LotsTable({ lots }: { lots: InventoryLotDto[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Received</th>
          <th>Item</th>
          <th>Remaining Qty</th>
          <th>Unit Cost</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {lots.map(l => (
          <tr key={l.id}>
            <td>{new Date(l.receivedAtUtc).toLocaleDateString()}</td>
            <td>{l.itemName ?? l.itemId}</td>
            <td>{l.remainingQty}</td>
            <td>{l.unitCost.toFixed(2)}</td>
            <td>{(l.remainingQty * l.unitCost).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
