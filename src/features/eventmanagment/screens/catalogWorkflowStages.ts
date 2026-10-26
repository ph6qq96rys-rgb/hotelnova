import type { CateringPackage } from "./PackagesScreen";
import type { CatalogItem } from "./CatalogCollection";

export type CatalogStage = "compose" | "cost" | "approval" | "availability" | "ready" | "archived";
export function itemPreparationIssues(item: CatalogItem): string[] {
  const issues: string[] = [];
  if (!item.isActive) issues.push("Item is inactive");
  if (["Food", "Beverage"].includes(item.itemType) && !item.recipeId && !item.inventoryItemId)
    issues.push("Link a recipe or inventory item");
  if ((item.recipeId || item.inventoryItemId) && !item.consumptionLocationId)
    issues.push("Choose a consumption location");
  if (!(item.estimatedUnitCost > 0)) issues.push("Review ingredient or service cost");
  if (!(item.sellingPrice > 0)) issues.push("Set a selling price");
  return issues;
}
export function packageWorkflow(p: CateringPackage, items: CatalogItem[], today: string): { stage: CatalogStage; reasons: string[] } {
  if (p.offering?.archived) return { stage: "archived", reasons: ["Archived; retained in the catalog and revision history"] };
  const offering = p.offering;
  if (!offering) return { stage: "compose", reasons: ["Import legacy package items before continuing"] };
  if (!offering.sections.length || offering.sections.some(s => !s.items.length || s.items.some(i => !(i.quantity > 0))))
    return { stage: "compose", reasons: ["Add menu sections, items and portion quantities"] };
  const costIssues: string[] = [];
  for (const id of new Set(offering.sections.flatMap(s => s.items.map(i => i.itemId)))) {
    const item = items.find(i => i.id === id);
    if (!item) costIssues.push("A package item is unavailable in this catalog");
    else {
      // An item price is required only when it determines this package's price.
      const issues = itemPreparationIssues(item).filter(issue => offering.pricingSource === "MenuItems" || issue !== "Set a selling price");
      if (issues.length) costIssues.push(`${item.name}: ${issues.join("; ")}`);
    }
  }
  if (offering.pricingSource === "CostPercent" && !offering.priceOverridden && offering.calculatedPrice == null)
    costIssues.push("Item costs are incomplete, so no price could be calculated from the target cost");
  else if (offering.pricingSource !== "MenuItems" && !((offering.pricingMode === "Fixed" ? offering.fixedPrice : p.pricePerPerson) > 0))
    costIssues.push("Set the package selling price");
  if (costIssues.length) return { stage: "cost", reasons: costIssues };
  if (!p.isApproved || p.approvedVersion !== p.catalogVersion) {
    const by = p.lastActionByName ? ` by ${p.lastActionByName}` : "";
    if (p.workflowStatus === "Returned")
      return { stage: "approval", reasons: [`Returned for changes${by}: ${p.workflowNote ?? "see history"}`, "Edit the package, save, and submit it again"] };
    if (p.workflowStatus === "PendingApproval")
      return { stage: "approval", reasons: [`Revision ${p.catalogVersion} submitted${by}${p.workflowNote ? `: ${p.workflowNote}` : ""}`, "Waiting for a catering manager to approve or return it"] };
    return { stage: "approval", reasons: [`Revision ${p.catalogVersion} is a draft. Submit it for approval after the cost and margin review`] };
  }
  if (!p.isActive) return { stage: "availability", reasons: ["Approved but inactive. Edit availability, save, then approve the changed revision"] };
  if (offering.effectiveDate && offering.effectiveDate.slice(0, 10) > today)
    return { stage: "availability", reasons: [`Scheduled from ${offering.effectiveDate.slice(0, 10)}`] };
  if (offering.expiryDate && offering.expiryDate.slice(0, 10) < today)
    return { stage: "availability", reasons: [`Availability ended ${offering.expiryDate.slice(0, 10)}. Revise dates and obtain approval again`] };
  return { stage: "ready", reasons: ["Current revision approved and active. Quotation validates dates, guest count, selections and current costs again"] };
}
