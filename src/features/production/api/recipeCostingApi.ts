// src/features/production/api/recipeCostingApi.ts
//
// Theoretical food-cost calculation based on latest FIFO unit costs.
// Base path: /companies/{companyId}/recipes/costing/{menuItemId}

import { http } from "../../../api/http";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecipeLineCostDto {
  lineId:          string;
  itemId:          string;
  itemName:        string;
  uomId:           string;
  uomName:         string;
  qtyPerMenuUnit:  number;
  unitCost:        number;
  effectiveQty:    number;
  lineCost:        number;
  wastePct:        number | null;
}

export interface RecipeCostDto {
  recipeId:              string;
  menuItemId:            string;
  totalRecipeCost:       number;
  currentSellingPrice:   number;
  targetFoodCostPct:     number;
  lines:                 RecipeLineCostDto[];
  suggestedSellingPrice: number | null;
  foodCostPct:           number | null;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const recipeCostingApi = {
  /** Fetch the latest stored cost snapshot. */
  get(companyId: string, menuItemId: string, targetFoodCostPct = 0.3): Promise<RecipeCostDto> {
    return http
      .get<RecipeCostDto>(`/companies/${companyId}/recipes/costing/${menuItemId}`, { params: { targetFoodCostPct } })
      .then((r) => r.data);
  },

  /** Recalculate and persist the cost snapshot, then return the updated result. */
  recalculate(companyId: string, menuItemId: string, targetFoodCostPct = 0.3): Promise<RecipeCostDto> {
    return http
      .post<RecipeCostDto>(`/companies/${companyId}/recipes/costing/${menuItemId}/recalculate`, null, { params: { targetFoodCostPct } })
      .then((r) => r.data);
  },
};