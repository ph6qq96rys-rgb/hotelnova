// src/features/production/api/menuEngineeringApi.ts
//
// Boston Matrix (menu engineering) analysis.
// Endpoint: /companies/{companyId}/branches/{branchId}/menu-engineering

import { http } from "../../../api/http";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MenuEngineeringCategory = "STAR" | "PUZZLE" | "PLOWHORSE" | "DOG";

export interface MenuEngineeringItem {
  menuItemId:         string;
  itemName:           string;
  category:           MenuEngineeringCategory;
  categoryLabel:      string;
  cost:               number;
  sellingPrice:       number;
  contributionMargin: number;
  foodCostPct:        number;
  quantitySold:       number;
  popularityIndex:    number;
  profitabilityIndex: number;
  totalRevenue:       number;
  totalCost:          number;
  totalMargin:        number;
  itemCode?:          string | null;
  recommendation?:    string | null;
  analysedAtUtc:      string;
}

export interface CategorySummary {
  count:        number;
  totalRevenue: number;
  totalMargin:  number;
}

export interface AnalysisSummary {
  stars:         CategorySummary;
  plowhorses:    CategorySummary;
  puzzles:       CategorySummary;
  dogs:          CategorySummary;
  totalRevenue:  number;
  totalMargin:   number;
  avgFoodCostPct:number;
}

export interface AnalysisResponse {
  companyId:  string;
  branchId:   string;
  analysedAt: string;
  totalItems: number;
  summary:    AnalysisSummary;
  items:      MenuEngineeringItem[];
}

// ── Category metadata (display only) ─────────────────────────────────────────

export const CAT_META: Record<MenuEngineeringCategory, { color: string; bg: string; icon: string; label: string }> = {
  STAR:      { color: "#f5c542", bg: "rgba(245,197,66,0.12)",  icon: "⭐", label: "Stars" },
  PUZZLE:    { color: "#7c6ef5", bg: "rgba(124,110,245,0.12)", icon: "🔮", label: "Puzzles" },
  PLOWHORSE: { color: "#3ecfb2", bg: "rgba(62,207,178,0.12)",  icon: "🐴", label: "Plowhorses" },
  DOG:       { color: "#f56e6e", bg: "rgba(245,110,110,0.12)", icon: "🐕", label: "Dogs" },
};

// ── API ───────────────────────────────────────────────────────────────────────

export const menuEngineeringApi = {
  get(companyId: string, branchId: string): Promise<AnalysisResponse> {
    return http
      .get<AnalysisResponse>(`/companies/${companyId}/branches/${branchId}/menu-engineering`)
      .then((r) => r.data);
  },

  recalculate(companyId: string, branchId: string): Promise<AnalysisResponse> {
    return http
      .post<AnalysisResponse>(`/companies/${companyId}/branches/${branchId}/menu-engineering/recalculate`)
      .then((r) => r.data);
  },
};