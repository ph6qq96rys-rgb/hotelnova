import type { MenuItemDto, RecipeDto } from "../types";
import { useI18n } from "../../../i18n";

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
  const { tx } = useI18n();
  const ingredientCount = recipe?.lines?.length ?? 0;
  const recipeExists = Boolean(recipe);

  return (
    <div className="p-card">
      <div className="p-card__head">
        <div>
          <p className="p-card__title">{tx("POS Readiness")}</p>
          <p className="p-card__subtitle">
            {tx("Shows why this item is sellable or blocked in POS.")}
          </p>
        </div>
      </div>

      <div className="p-card__body">
        <div className="p-checklist">
          <CheckRow ok={item.isActive === true} text={tx("Menu item is active")} />
          <CheckRow ok={item.isAvailableForSale === true} text={tx("Available for POS sale")} />
          <CheckRow
            ok={item.hasConsumptionLocation === true}
            text={tx("Consumption location configured")}
          />
          <CheckRow ok={item.hasRecipe === true || recipeExists} text={tx("Recipe configured")} />
          <CheckRow ok={ingredientCount > 0} text={tx("{count} ingredient line(s)", { count: ingredientCount })} />
          <CheckRow ok={recipe?.isActive === true} text={tx("Recipe active")} />
        </div>

        <div className="p-action-panel" style={{ marginBottom: 12 }}>
          <div>
            <div className="p-action-panel__title">{tx("Governance Checklist")}</div>
            <p className="p-action-panel__text">
              {tx("Company scope and branch scope are enforced by the route layer. Save only after price, recipe, and stock-location controls are aligned.")}
            </p>
          </div>
        </div>

        <div className="p-action-panel">
          <div>
            <div className="p-action-panel__title">
              {posReady ? tx("Ready for POS") : tx("Blocked from POS")}
            </div>
            <p className="p-action-panel__text">
              {tx("Effective consumption location:")} {" "}
              <strong>{effectiveLocationName ?? tx("Missing")}</strong>
            </p>
          </div>

          <button className="p-btn p-btn--accent" onClick={onOpenRecipe} type="button">
            {recipeExists ? tx("Open Recipe Editor") : tx("Create Recipe")}
          </button>
        </div>
      </div>
    </div>
  );
}
