import { Link } from "react-router-dom";
import { Boxes, List, Ruler } from "lucide-react";
import "../../../styles/inventory-master.css";

export default function InventoryMasterHomePage() {
  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Inventory Master Data</h1>
        <p className="muted">
          Configure core inventory definitions used across purchasing, GRN,
          production, FIFO, and sales.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-3">
        <Link to="/inventory-master/uoms" className="card card-link">
          <div className="card-icon">
            <Ruler size={28} />
          </div>
          <h3>Units of Measure (UoM)</h3>
          <p>
            Define base and alternate units (kg, g, l, ml, pcs) used for stock,
            recipes, and FIFO calculations.
          </p>
        </Link>

        <Link to="/inventory-master/categories" className="card card-link">
          <div className="card-icon">
            <List size={28} />
          </div>
          <h3>Item Categories</h3>
          <p>
            Organize inventory items by type (Raw Material, Semi-Finished,
            Finished Goods, Packaging).
          </p>
        </Link>

        <Link to="/inventory-master/items" className="card card-link">
          <div className="card-icon">
            <Boxes size={28} />
          </div>
          <h3>Inventory Items</h3>
          <p>
            Create and manage stock items with default units, categories,
            costing, and FIFO tracking.
          </p>
        </Link>
          <Link to="/inventory-master/items" className="card card-link">
          <div className="card-icon">
            <Boxes size={28} />
          </div>
          <h3>Inventory Items</h3>
          <p>
            Create and manage stock items with default units, categories,
            costing, and FIFO tracking.
          </p>
        </Link>
          <Link to="/inventory-master/items" className="card card-link">
          <div className="card-icon">
            <Boxes size={28} />
          </div>
          <h3>Inventory Items</h3>
          <p>
            Create and manage stock items with default units, categories,
            costing, and FIFO tracking.
          </p>
        </Link>
      </div>
    </div>
  );
}
