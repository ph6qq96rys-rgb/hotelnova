// src/features/production/components/ProductionWorkflowBar.tsx

import { useNavigate } from "react-router-dom";
import "../layout/production.css";

type Step = "menu" | "recipe" | "batch";

interface Props {
  active: Step;
  menuItemId?: string | null;
  recipeId?: string | null;
  batchId?: string | null;
}

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

const STEPS: { key: Step; label: string; no: number }[] = [
  { key: "menu", label: "Menu Item", no: 1 },
  { key: "recipe", label: "Recipe", no: 2 },
  { key: "batch", label: "Production Batch", no: 3 },
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isRealId(value?: string | null): value is string {
  const id = clean(value).toLowerCase();

  return Boolean(
    id &&
      id !== "new" &&
      id !== "create" &&
      id !== ":id" &&
      id !== EMPTY_GUID
  );
}

export default function ProductionWorkflowBar({ active, menuItemId, batchId }: Props) {
  const nav = useNavigate();
  const hasMenuItem = isRealId(menuItemId);
  const hasBatch = isRealId(batchId);

  function handleClick(step: Step) {
    switch (step) {
      case "menu":
        nav(hasMenuItem ? `/production/menu/items/${menuItemId}` : "/production/menu/items/new");
        break;

      case "recipe":
        nav(hasMenuItem ? `/production/menu/items/${menuItemId}/recipe` : "/production/recipes");
        break;

      case "batch":
        nav(hasBatch ? `/production/batches/${batchId}` : "/production/batches/new");
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
          aria-current={active === step.key ? "step" : undefined}
        >
          <span className="p-workflow-step__no">{step.no}</span>
          {step.label}
        </button>
      ))}
    </nav>
  );
}
