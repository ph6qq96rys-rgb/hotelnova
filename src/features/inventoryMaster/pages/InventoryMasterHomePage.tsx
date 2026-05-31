import { Link } from "react-router-dom";
import { Boxes, List, Ruler, ArrowRight } from "lucide-react";

const cards = [
  {
    to: "/inventory-master/uoms",
    icon: <Ruler size={18} />,
    title: "Units of measure",
    description:
      "Define base and alternate units (kg, g, l, ml, pcs) used for stock, recipes, and FIFO calculations.",
    cta: "Manage UoMs",
  },
  {
    to: "/inventory-master/categories",
    icon: <List size={18} />,
    title: "Item categories",
    description:
      "Organize inventory items by type — raw material, semi-finished, finished goods, and packaging.",
    cta: "Manage categories",
  },
  {
    to: "/inventory-master/items",
    icon: <Boxes size={18} />,
    title: "Inventory items",
    description:
      "Create and manage stock items with default units, categories, costing, and FIFO tracking.",
    cta: "Manage items",
  },
];

export default function InventoryMasterHomePage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Inventory master data</h1>
        <p className="muted">
          Configure core inventory definitions used across purchasing, GRN,
          production, FIFO, and sales.
        </p>
      </div>

      <div className="grid grid-3">
        {cards.map((card) => (
          <Link key={card.to} to={card.to} className="card card-link">
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <span className="card-cta">
              <ArrowRight size={14} /> {card.cta}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}