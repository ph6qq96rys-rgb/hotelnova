import type { CateringPackageSummaryDto, EventInquiryDto, EventQuotationSummaryDto } from "../../api/cateringManagementApi";
import type { LiteRequirement, LiteReservationLine } from "./eventManagementTypes";

export const fallbackInquiries: EventInquiryDto[] = [
  { id: "demo-inquiry-1", companyId: "demo", reference: "INQ-2026-1042", customerName: "Aster Group", customerEmail: "events@aster.example", customerPhone: "+251 911 000 104", eventType: "Corporate gala dinner", eventDate: "2026-09-18T17:00:00Z", eventLocation: "Grand Ballroom", guestCount: 240, budget: 680000, serviceStyle: "Buffet with plated VIP table", specialRequirements: "Premium beef station and late-night snack table", dietaryRequirements: "18 vegetarian, 6 gluten-free, 2 nut allergy", equipmentRequirements: "Carving station, buffet risers, chafers, coffee station", transportRequirements: "One refrigerated van, one dry van", status: "New", assignedCoordinatorId: null, followUpAtUtc: "2026-08-31T08:00:00Z", lostReason: null, confirmationSentAtUtc: "2026-08-29T11:30:00Z" },
  { id: "demo-inquiry-2", companyId: "demo", reference: "INQ-2026-1037", customerName: "Blue Nile Foundation", customerEmail: "procurement@bnf.example", eventType: "Donor luncheon", eventDate: "2026-09-05T10:30:00Z", eventLocation: "Garden pavilion", guestCount: 90, budget: 210000, serviceStyle: "Plated lunch", specialRequirements: "Board table service before public lunch", dietaryRequirements: "Halal service and vegan starter option", allergenRequirements: "Sesame labeling required", equipmentRequirements: "Portable induction warmers", transportRequirements: "Single dry van", status: "Qualified", confirmationSentAtUtc: "2026-08-28T09:10:00Z" },
];

export const fallbackQuotations: EventQuotationSummaryDto[] = [
  { id: "demo-quote-1", companyId: "demo", branchId: "demo-branch", eventInquiryId: "demo-inquiry-1", reference: "QUO-2026-0884", customerName: "Aster Group", customerEmail: "events@aster.example", customerPhone: "+251 911 000 104", eventType: "Corporate gala dinner", eventStartUtc: "2026-09-18T17:00:00Z", eventEndUtc: "2026-09-18T22:30:00Z", guestCount: 240, status: "Accepted", acceptedVersionId: "demo-version-1", acceptedAtUtc: "2026-08-29T15:00:00Z", confirmedAtUtc: null, postponedAtUtc: null, cancelledAtUtc: null, cancellationReason: null, currentVersion: { id: "demo-version-1", versionNo: 3, status: "Accepted", totalAmount: 712500, depositAmount: 213750, requiresApproval: false, approvalStatus: "Approved" } },
  { id: "demo-quote-2", companyId: "demo", branchId: "demo-branch", eventInquiryId: "demo-inquiry-2", reference: "QUO-2026-0879", customerName: "Blue Nile Foundation", customerEmail: "procurement@bnf.example", eventType: "Donor luncheon", eventStartUtc: "2026-09-05T10:30:00Z", eventEndUtc: "2026-09-05T14:00:00Z", guestCount: 90, status: "Draft", acceptedVersionId: null, acceptedAtUtc: null, confirmedAtUtc: null, postponedAtUtc: null, cancelledAtUtc: null, cancellationReason: null, currentVersion: { id: "demo-version-2", versionNo: 1, status: "Draft", totalAmount: 198000, depositAmount: 59400, requiresApproval: true, approvalStatus: "Pending" } },
];

export const fallbackPackages: CateringPackageSummaryDto[] = [
  { id: "demo-package-1", companyId: "demo", branchId: "demo-branch", code: "PKG-EXEC-BUFFET", name: "Executive Buffet", description: "Three-course buffet with two proteins, dessert, soft beverages, and staffed service line.", isActive: true, publishToPortal: true, currentVersion: { id: "demo-pv-1", versionNo: 4, versionLabel: "2026-Q3", effectiveFromUtc: "2026-07-01T00:00:00Z", effectiveToUtc: null, minimumGuests: 80, maximumGuests: 400, pricingType: "PerGuest", basePrice: 2850, isCurrent: true, isActive: true, items: [{ id: "demo-line-1", itemType: "Menu", name: "Prime beef carving station", pricingType: "Included", quantity: 1, unitPrice: 0, isOptional: false, sortOrder: 1 }, { id: "demo-line-2", itemType: "Equipment", name: "Buffet risers and chafers", pricingType: "Included", quantity: 8, unitPrice: 0, isOptional: false, sortOrder: 2 }] } },
  { id: "demo-package-2", companyId: "demo", branchId: "demo-branch", code: "PKG-PLATED-LUNCH", name: "Boardroom Plated Lunch", description: "Compact plated lunch package for formal meetings and donor sessions.", isActive: true, publishToPortal: true, currentVersion: { id: "demo-pv-2", versionNo: 2, versionLabel: "2026-Q3", effectiveFromUtc: "2026-07-01T00:00:00Z", minimumGuests: 20, maximumGuests: 120, pricingType: "PerGuest", basePrice: 2200, isCurrent: true, isActive: true, items: [{ id: "demo-line-3", itemType: "Menu", name: "Soup or salad starter", pricingType: "Included", quantity: 1, unitPrice: 0, isOptional: false, sortOrder: 1 }, { id: "demo-line-4", itemType: "Service", name: "Table captain service", pricingType: "Included", quantity: 2, unitPrice: 0, isOptional: false, sortOrder: 2 }] } },
];

export function demoRequirementLines(): LiteRequirement[] {
  return [
    { id: "req-1", requirementType: "Dietary", description: "Vegetarian, gluten-free, and nut allergy meals must be labeled separately.", severity: "High" },
    { id: "req-2", requirementType: "Service", description: "VIP table receives plated service while main hall uses buffet line.", severity: "Medium" },
    { id: "req-3", requirementType: "Equipment", description: "Carving station requires heat lamp and carving board at service point.", severity: "Medium" },
  ];
}

export function demoReservationLines(): LiteReservationLine[] {
  return [
    { id: "res-1", inventoryItemName: "Prime beef side", reservedQuantity: 48, status: "Reserved" },
    { id: "res-2", inventoryItemName: "Vegetable garnish pack", reservedQuantity: 22, status: "Reserved" },
    { id: "res-3", inventoryItemName: "Compostable dinner plate", reservedQuantity: 280, status: "Pending" },
  ];
}
