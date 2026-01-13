import type { StockLocationDto } from "../types";

type Props = {
  items: StockLocationDto[];
  onEdit: (x: StockLocationDto) => void;
  onToggleActive: (x: StockLocationDto) => void;
};

export default function StockLocationsTable({ items, onEdit, onToggleActive }: Props) {
  return (
    <div className="card">
      <div className="card-header"><h2>Locations</h2></div>

      <div className="card-body">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map(x => (
              <tr key={x.id}>
                <td>{x.name}</td>
                <td>{x.code ?? "-"}</td>
                <td>{x.type}</td>
                <td>{x.isActive ? "Active" : "Disabled"}</td>
                <td className="actions">
                  <button className="btn" onClick={() => onEdit(x)}>Edit</button>
                  <button className="btn" onClick={() => onToggleActive(x)}>
                    {x.isActive ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr><td colSpan={5}><em>No locations found.</em></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
