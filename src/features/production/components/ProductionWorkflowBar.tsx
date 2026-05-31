// src/features/production/components/ProductionWorkflowBar.tsx

import { useNavigate } from "react-router-dom";
import "../production.css";

type Step = "menu" | "recipe" | "batch";

interface Props {
  active: Step;
  menuItemId?: string | null;
  recipeId?: string | null;
  batchId?: string | null;
}

const STEPS: { key: Step; label: string; no: number }[] = [
  { key: "menu",   label: "Menu Item",        no: 1 },
  { key: "recipe", label: "Recipe",           no: 2 },
  { key: "batch",  label: "Production Batch", no: 3 },
];

export default function ProductionWorkflowBar({ active, menuItemId, batchId }: Props) {
  const nav = useNavigate();

  function handleClick(step: Step) {
    switch (step) {
      case "menu":
        nav(menuItemId ? `/production/menu/items/${menuItemId}` : "/production/menu/items/new");
        break;
      case "recipe":
        nav(menuItemId ? `/production/menu/items/${menuItemId}/recipe` : "/production/recipes");
        break;
      case "batch":
        nav(batchId ? `/production/batches/${batchId}` : "/production/batches/new");
        break;
    }
  }

  return (
    <nav className="p-workflow-bar" aria-label="Production workflow">
      {STEPS.map((step) => (
        <button
          key={step.key}
          type="button"
          className={`p-workflow-step${active === step.key ? " p-workflow-step--active" : ""}`}
          onClick={() => handleClick(step.key)}
        >
          <span className="p-workflow-step__no">{step.no}</span>
          {step.label}
        </button>
      ))}
    </nav>
  );
}