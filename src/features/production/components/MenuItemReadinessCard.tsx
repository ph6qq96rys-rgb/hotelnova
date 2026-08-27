import type { MenuItemDto, RecipeDto } from "../types";

type Props = {
  item: MenuItemDto;
  recipe: RecipeDto | null;
  effectiveLocationName: string | null;
  posReady: boolean;
  onOpenRecipe: () => void;
};

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`p-check ${ok ? "p-check--ok" : "p-check--warn"}`}>
      <span className="p-check__icon">{ok ? "" : "!"}</span>
      <span>{text}</span>
    </div>
  );
}

export default function MenuItemReadinessCard({
  item,
  recipe,
  effectiveLocationName,
  posReady,
  onOpenRecipe,
}: Props) {
  const ingredientCount = recipe?.lines?.length ?? 0;
  const recipeExists = Boolean(recipe);

  return (
    <div className="p-card">
      <div className="p-card__head">
        <div>
          <p className="p-card__title">POS Readiness</p>
          <p className="p-card__subtitle">
            Shows why this item is sellable or blocked in POS.
          </p>
        </div>
      </div>

      <div className="p-card__body">
        <div className="p-checklist">
          <CheckRow ok={item.isActive === true} text="Menu item is active" />
          <CheckRow ok={item.isAvailableForSale === true} text="Available for POS sale" />
          <CheckRow
            ok={item.hasConsumptionLocation === true}
            text="Consumption location configured"
          />
          <CheckRow ok={item.hasRecipe === true || recipeExists} text="Recipe configured" />
          <CheckRow ok={ingredientCount > 0} text={`${ingredientCount} ingredient line(s)`} />
          <CheckRow ok={recipe?.isActive === true} text="Recipe active" />
        </div>

        <div className="p-action-panel" style={{ marginBottom: 12 }}>
          <div>
            <div className="p-action-panel__title">Governance Checklist</div>
            <p className="p-action-panel__text">
              Company scope and branch scope are enforced by the route layer. Save only after
              price, recipe, and stock-location controls are aligned.
            </p>
          </div>
        </div>

        <div className="p-action-panel">
          <div>
            <div className="p-action-panel__title">
              {posReady ? "Ready for POS" : "Blocked from POS"}
            </div>
            <p className="p-action-panel__text">
              Effective consumption location:{" "}
              <strong>{effectiveLocationName ?? "Missing"}</strong>
            </p>
          </div>

          <button className="p-btn p-btn--accent" onClick={onOpenRecipe} type="button">
            {recipeExists ? "Open Recipe Editor" : "Create Recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
