import { listQuotations, listInquiries } from "../sales/salesApi";
import type { CateringPackage } from "../screens/PackagesScreen";
import { http } from "../../../api/http";

export type CateringSeverity = "critical" | "warning" | "success" | "info" | string;

export type EventDashboardCardDto = {
  key: string;
  title: string;
  value: number;
  unit: string;
  severity: CateringSeverity;
  route: string;
};

export type EventDashboardTaskDto = {
  key: string;
  area: string;
  title: string;
  severity: CateringSeverity;
  entityId?: string | null;
  eventQuotationId?: string | null;
  dueAtUtc?: string | null;
  route: string;
};

export type EventDashboardEventDto = {
  eventQuotationId: string;
  reference: string;
  customerName: string;
  eventType: string;
  eventStartUtc?: string | null;
  eventEndUtc?: string | null;
  guestCount: number;
  status: string;
};

export type EventDashboardDto = {
  generatedAtUtc: string;
  landingRoute: string;
  roleViews: string[];
  cards: EventDashboardCardDto[];
  tasks: EventDashboardTaskDto[];
  upcomingEvents: EventDashboardEventDto[];
};

export type CateringExperienceDto = {
  generatedAtUtc: string;
  moduleRoute: string;
  defaultLandingRoute: string;
  navigation: Array<{
    key: string;
    label: string;
    route: string;
    icon: string;
    queueKey: string;
    requiredPermission: string;
    roles: string[];
  }>;
  statusTracker: Array<{
    key: string;
    label: string;
    sortOrder: number;
    tone: string;
    isTerminal: boolean;
    nextActionHint: string;
  }>;
};

export type EventQuotationSummaryDto = {
  id: string;
  companyId: string;
  branchId: string;
  eventInquiryId?: string | null;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  eventType: string;
  eventStartUtc?: string | null;
  eventEndUtc?: string | null;
  guestCount: number;
  status: string;
  acceptedVersionId?: string | null;
  acceptedAtUtc?: string | null;
  confirmedAtUtc?: string | null;
  postponedAtUtc?: string | null;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
  currentVersion?: {
    id: string;
    versionNo: number;
    status: string;
    totalAmount: number;
    depositAmount: number;
    requiresApproval: boolean;
    approvalStatus: string;
  } | null;
};

export type EventInquiryDto = {
  id: string;
  companyId: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  eventType: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  guestCount: number;
  budget?: number | null;
  serviceStyle?: string | null;
  specialRequirements?: string | null;
  dietaryRequirements?: string | null;
  allergenRequirements?: string | null;
  accessibilityRequirements?: string | null;
  equipmentRequirements?: string | null;
  transportRequirements?: string | null;
  status: string;
  assignedCoordinatorId?: string | null;
  followUpAtUtc?: string | null;
  lostReason?: string | null;
  confirmationSentAtUtc: string;
};

export type EventLiveWorkspaceDto = {
  eventQuotationId: string;
  eventReference: string;
  customerName: string;
  eventStatus: string;
  eventStartUtc?: string | null;
  eventEndUtc?: string | null;
  statusCards: Array<{
    area: string;
    status: string;
    totalCount: number;
    completedCount: number;
    attentionCount: number;
    summary?: string | null;
  }>;
  timeline: Array<{
    id: string;
    entryType: string;
    area: string;
    severity: string;
    title: string;
    details?: string | null;
    occurredAtUtc: string;
    status: string;
  }>;
};

export type EventConsumptionForecastDto = {
  id: string;
  status: string;
  guestCount: number;
  totalEstimatedCost: number;
  costPerGuest: number;
  calculatedAtUtc: string;
  notificationSummary?: string | null;
  lines: Array<{
    id: string;
    inventoryItemName: string;
    uomName: string;
    requiredQuantity: number;
    availableQuantity: number;
    shortageQuantity: number;
    estimatedCost: number;
  }>;
};

export type EventConsumptionForecastExtraItemDto = {
  requirementSource: string;
  inventoryItemId: string;
  uomId?: string | null;
  quantityPerGuest: number;
  fixedQuantity: number;
  productionLocationId?: string | null;
  sourceStockLocationId?: string | null;
  preparationLossPercent?: number | null;
  wastageAllowancePercent?: number | null;
  sortOrder: number;
};

export type CalculateEventConsumptionForecastDto = {
  guestCountOverride?: number | null;
  productionLocationId?: string | null;
  sourceStockLocationId?: string | null;
  serviceStyle?: string | null;
  serviceStyleMultiplier?: number | null;
  preparationLossPercent: number;
  wastageAllowancePercent: number;
  includeStaffMeals: boolean;
  staffMealCount: number;
  includeComplimentaryItems: boolean;
  complimentaryGuestCount: number;
  includeBeverages: boolean;
  includePackaging: boolean;
  includeDisposables: boolean;
  extraItems?: EventConsumptionForecastExtraItemDto[] | null;
};

export type EventMenuPlanLineDto = {
  id: string;
  cateringPackageId?: string | null;
  cateringPackageVersionId?: string | null;
  menuItemId?: string | null;
  sourceType: string;
  courseName: string;
  menuItemName: string;
  description?: string | null;
  quantity: number;
  servingSize: number;
  servingUnit?: string | null;
  expectedYieldQuantity: number;
  yieldUnit?: string | null;
  activeRecipeId?: string | null;
  requiresRecipe: boolean;
  hasApprovedRecipeException: boolean;
  recipeExceptionReason?: string | null;
  dietaryTags?: string | null;
  allergenTags?: string | null;
  serviceStandard?: string | null;
  sortOrder: number;
};

export type EventMenuRequirementDto = {
  id: string;
  requirementType: string;
  description: string;
  guestScope?: string | null;
  severity: string;
  isHighlighted: boolean;
  sortOrder: number;
};

export type EventMenuPlanDto = {
  id: string;
  companyId: string;
  branchId: string;
  eventQuotationId: string;
  eventBanquetOrderId?: string | null;
  eventBanquetOrderVersionId?: string | null;
  status: string;
  serviceStandards?: string | null;
  notes?: string | null;
  approvedByUserId?: string | null;
  approvedAtUtc?: string | null;
  notificationRecordedAtUtc?: string | null;
  notificationSummary?: string | null;
  lines: EventMenuPlanLineDto[];
  requirements: EventMenuRequirementDto[];
};

export type EventMenuPlanVersionDto = {
  id: string;
  eventMenuPlanId: string;
  eventQuotationId: string;
  versionNo: number;
  status: string;
  snapshotReason: string;
  changeSummary?: string | null;
  createdByUserId?: string | null;
  createdAtUtc: string;
  snapshotJson: string;
};

export type EventMenuOperationalValidationDto = {
  eventQuotationId: string;
  eventMenuPlanId?: string | null;
  status: string;
  canRequestChefReview: boolean;
  canRequestCustomerApproval: boolean;
  canOperationallyApprove: boolean;
  canLockMenu: boolean;
  criticalIssueCount: number;
  warningIssueCount: number;
  passedCheckCount: number;
  issues: Array<{
    area: string;
    severity: string;
    message: string;
    entityId?: string | null;
  }>;
};

export type CateringPackageItemDto = {
  id: string;
  itemType: string;
  menuItemId?: string | null;
  eventVenueId?: string | null;
  referenceId?: string | null;
  name: string;
  description?: string | null;
  pricingType: string;
  quantity: number;
  unitPrice: number;
  isOptional: boolean;
  sortOrder: number;
};

export type CateringPackageVersionDto = {
  id: string;
  versionNo: number;
  versionLabel: string;
  effectiveFromUtc: string;
  effectiveToUtc?: string | null;
  minimumGuests?: number | null;
  maximumGuests?: number | null;
  pricingType: string;
  basePrice: number;
  isCurrent: boolean;
  isActive: boolean;
  notes?: string | null;
  items: CateringPackageItemDto[];
};

export type CateringPackageSummaryDto = {
  id: string;
  companyId: string;
  branchId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  publishToPortal: boolean;
  currentVersion?: CateringPackageVersionDto | null;
};

export type MenuItemDto = {
  id: string;
  companyId: string;
  branchId: string;
  name: string;
  code: string;
  externalCode?: string | null;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string | null;
  subCategoryName?: string | null;
  itemType: number | string;
  cost: number;
  sellingPrice: number;
  isActive: boolean;
  isAvailableForSale: boolean;
  consumptionBranchStockLocationId?: string | null;
  consumptionLocationName?: string | null;
  categoryConsumptionBranchStockLocationId?: string | null;
  categoryConsumptionLocationName?: string | null;
  outputItemId?: string | null;
  outputItemName?: string | null;
  outputUomId?: string | null;
  outputUomName?: string | null;
  hasRecipe: boolean;
  hasConsumptionLocation: boolean;
  unitsSold: number;
  createdAt: string;
  updatedAt?: string | null;
};

export type UpsertEventMenuPlanLineDto = {
  cateringPackageId?: string | null;
  cateringPackageVersionId?: string | null;
  menuItemId?: string | null;
  courseName?: string | null;
  menuItemName?: string | null;
  description?: string | null;
  quantity: number;
  servingSize: number;
  servingUnit?: string | null;
  expectedYieldQuantity: number;
  yieldUnit?: string | null;
  hasApprovedRecipeException: boolean;
  recipeExceptionReason?: string | null;
  dietaryTags?: string | null;
  allergenTags?: string | null;
  serviceStandard?: string | null;
  sortOrder: number;
};

export type UpsertEventMenuRequirementDto = {
  requirementType: string;
  description: string;
  guestScope?: string | null;
  severity: string;
  isHighlighted: boolean;
  sortOrder: number;
};

export type UpsertEventMenuPlanDto = {
  includeAcceptedQuotationMenu: boolean;
  packageVersionIds?: string[] | null;
  lines?: UpsertEventMenuPlanLineDto[] | null;
  requirements?: UpsertEventMenuRequirementDto[] | null;
  serviceStandards?: string | null;
  notes?: string | null;
};

export type ApproveEventMenuPlanDto = {
  comments?: string | null;
};

export type TransitionEventMenuPlanStatusDto = {
  status: string;
  comments?: string | null;
};

export type CreateEventMenuPlanRevisionDto = {
  reason?: string | null;
};

export type EventInventoryReservationDto = {
  id: string;
  status: string;
  reservedAtUtc: string;
  notes?: string | null;
  lines: Array<{
    id: string;
    eventConsumptionForecastLineId: string;
    branchId: string;
    productionLocationId?: string | null;
    sourceStockLocationId: string;
    inventoryItemId: string;
    inventoryItemName: string;
    uomId: string;
    uomName: string;
    requiredQuantity: number;
    reservedQuantity: number;
    status: string;
    sortOrder: number;
  }>;
};

export type ReserveEventInventoryDto = {
  replaceExistingReservation: boolean;
  notes?: string | null;
};

export type EventStockIssueVoucherDto = {
  id: string;
  companyId?: string;
  branchId?: string;
  eventQuotationId?: string;
  eventConsumptionForecastId?: string;
  eventBanquetOrderVersionId?: string | null;
  sivId?: string;
  sivNo?: string;
  nativeSivStatus?: string;
  sourceStockLocationId?: string;
  destinationStockLocationId?: string;
  responsibleCustodianUserId?: string;
  voucherNumber?: string | null;
  status: string;
  issueStatus?: string | null;
  totalIssuedCost?: number | null;
  requiredByDateUtc?: string;
  createdAtUtc?: string;
  submittedAtUtc?: string | null;
  submittedByUserId?: string | null;
  notes?: string | null;
  lines?: Array<{
    id: string;
    eventConsumptionForecastLineId: string;
    eventInventoryReservationLineId?: string | null;
    inventoryItemId: string;
    inventoryItemName: string;
    uomId: string;
    uomName: string;
    plannedQuantity: number;
    reservedQuantity: number;
    requestedQuantity: number;
    availableQuantity: number;
    requestJustification?: string | null;
    sortOrder: number;
  }>;
};

export type CreateEventStockIssueVoucherLineDto = {
  eventConsumptionForecastLineId: string;
  requestedQuantity: number;
  requestJustification?: string | null;
};

export type CreateEventStockIssueVoucherDto = {
  sourceStockLocationId: string;
  destinationStockLocationId: string;
  responsibleCustodianUserId: string;
  requiredByDateUtc: string;
  submit: boolean;
  notes?: string | null;
  lines?: CreateEventStockIssueVoucherLineDto[] | null;
};

export type EventStockIssueVoucherApprovalReviewDto = {
  eventStockIssueVoucherId: string;
  eventQuotationId: string;
  eventConsumptionForecastId: string;
  eventBanquetOrderVersionId?: string | null;
  sivId: string;
  sivNo: string;
  status: string;
  materialVarianceTolerancePercent: number;
  hasMaterialVariances: boolean;
  requesterIsCurrentApprover: boolean;
  lines: Array<{
    eventStockIssueVoucherLineId: string;
    eventConsumptionForecastLineId: string;
    inventoryItemId: string;
    inventoryItemName: string;
    uomId: string;
    uomName: string;
    plannedQuantity: number;
    reservedQuantity: number;
    requestedQuantity: number;
    availableQuantity: number;
    varianceQuantity: number;
    variancePercent: number;
    requiresJustification: boolean;
    requestJustification?: string | null;
    warning?: string | null;
  }>;
};

export type EventStockIssueVoucherApprovalLineDto = {
  eventStockIssueVoucherLineId: string;
  approvedQuantity: number;
};

export type DecideEventStockIssueVoucherDto = {
  decision: "Approve" | "Reject" | "Clarification" | string;
  remarks?: string | null;
  overrideReason?: string | null;
  materialVarianceTolerancePercent?: number | null;
  lines?: EventStockIssueVoucherApprovalLineDto[] | null;
};

export type IssueEventStockIssueVoucherLineDto = {
  eventStockIssueVoucherLineId: string;
  issuedQuantity: number;
  batchNo?: string | null;
  expiryDate?: string | null;
};

export type IssueEventStockIssueVoucherDto = {
  remarks?: string | null;
  lines?: IssueEventStockIssueVoucherLineDto[] | null;
};

export type PostEventStockIssueVoucherDto = {
  locationId?: string | null;
  remarks?: string | null;
};

export type EventStockIssueVoucherPostResultDto = {
  eventSiv: EventStockIssueVoucherDto;
  posting: unknown;
};

export type EventInventoryReturnDto = {
  id: string;
  eventStockIssueVoucherId: string;
  eventSivNo: string;
  returnNumber: string;
  status: string;
  returnToStockLocationId: string;
  returnedByUserId: string;
  receivedByUserId: string;
  returnedAtUtc: string;
  postedAtUtc?: string | null;
  totalReturnedCost: number;
  remarks?: string | null;
  lines: Array<{
    id: string;
    eventStockIssueVoucherLineId: string;
    inventoryItemId: string;
    inventoryItemName: string;
    uomId: string;
    uomName: string;
    issuedQuantity: number;
    previouslyReturnedQuantity: number;
    returnQuantity: number;
    condition: string;
    batchNo?: string | null;
    expiryDate?: string | null;
    returnedCost: number;
    validationRemarks?: string | null;
    sortOrder: number;
  }>;
};

export type CreateEventInventoryReturnDto = {
  eventStockIssueVoucherId: string;
  returnToStockLocationId: string;
  returnedByUserId: string;
  returnedAtUtc: string;
  remarks?: string | null;
  lines: Array<{
    eventStockIssueVoucherLineId: string;
    returnQuantity: number;
    condition: string;
    batchNo?: string | null;
    expiryDate?: string | null;
    validationRemarks?: string | null;
  }>;
};

export type PostEventInventoryReturnDto = {
  remarks?: string | null;
};

export type EventInventoryReturnPostResultDto = {
  return: EventInventoryReturnDto;
  posting: unknown;
};

export type EventOperationalLossDto = {
  id: string;
  eventStockIssueVoucherId?: string | null;
  lossNumber: string;
  status: string;
  varianceCategory: string;
  reason: string;
  responsibleArea: string;
  recordedAtUtc: string;
  requiresApproval: boolean;
  totalEstimatedCost: number;
  evidenceUri?: string | null;
  notes?: string | null;
  lines: Array<{
    id: string;
    eventStockIssueVoucherLineId?: string | null;
    inventoryItemId: string;
    inventoryItemName: string;
    uomId: string;
    uomName: string;
    issuedQuantity: number;
    previouslyReturnedQuantity: number;
    previouslyRecordedLossQuantity: number;
    quantity: number;
    unitCost: number;
    estimatedCost: number;
    variancePercent: number;
    requiresApproval: boolean;
    notes?: string | null;
    sortOrder: number;
  }>;
};

export type CreateEventOperationalLossDto = {
  eventStockIssueVoucherId?: string | null;
  varianceCategory: string;
  reason: string;
  responsibleArea: string;
  recordedAtUtc: string;
  highValueThresholdAmount?: number | null;
  quantityTolerancePercent?: number | null;
  evidenceUri?: string | null;
  notes?: string | null;
  lines: Array<{
    eventStockIssueVoucherLineId?: string | null;
    inventoryItemId: string;
    uomId: string;
    inventoryItemName?: string | null;
    uomName?: string | null;
    quantity: number;
    unitCost?: number | null;
    evidenceUri?: string | null;
    notes?: string | null;
  }>;
};

export type DecideEventOperationalLossDto = {
  decision: "Approve" | "Reject" | string;
  remarks?: string | null;
};

export type EventConsumptionReconciliationDto = {
  id: string;
  reconciliationNumber: string;
  status: string;
  quantityTolerancePercent?: number;
  reconciledAtUtc?: string;
  submittedAtUtc?: string | null;
  totalPlannedCost: number;
  totalActualConsumptionCost: number;
  totalWasteCost: number;
  totalDamageCost: number;
  totalVarianceCost: number;
  aboveToleranceLineCount: number;
  notes?: string | null;
  lines: Array<{
    id: string;
    eventConsumptionForecastLineId?: string | null;
    inventoryCategoryName?: string | null;
    inventoryItemName: string;
    uomName?: string;
    plannedQuantity: number;
    reservedQuantity?: number;
    issuedQuantity?: number;
    additionalIssuedQuantity?: number;
    returnedQuantity?: number;
    actualConsumptionQuantity: number;
    wasteQuantity: number;
    damageQuantity?: number;
    spoilageQuantity?: number;
    complimentaryQuantity?: number;
    varianceQuantity?: number;
    variancePercent: number;
    unitCost?: number;
    plannedCost?: number;
    actualConsumptionCost?: number;
    wasteCost?: number;
    damageCost?: number;
    spoilageCost?: number;
    complimentaryCost?: number;
    varianceCost?: number;
    aboveTolerance: boolean;
    explanation?: string | null;
    correctiveAction?: string | null;
  }>;
};

export type RunEventConsumptionReconciliationDto = {
  quantityTolerancePercent?: number | null;
  notes?: string | null;
};

export type SubmitEventConsumptionReconciliationDto = {
  notes?: string | null;
  explanations?: Array<{
    eventConsumptionReconciliationLineId: string;
    explanation?: string | null;
    correctiveAction?: string | null;
  }> | null;
};

export type EventClosureReadinessDto = {
  eventQuotationId: string;
  canClose: boolean;
  inventoryReconciliationCompleted: boolean;
  equipmentReady: boolean;
  requiredInvoicesRecorded: boolean;
  requiredPaymentsRecorded: boolean;
  requiredInvoiceAmount: number;
  invoicedAmount: number;
  outstandingBalanceAmount: number;
  outstandingActions: Array<{
    area: string;
    code: string;
    message: string;
    entityId?: string | null;
    amount?: number | null;
  }>;
};

export type EventClosureDto = {
  id: string;
  closureNumber: string;
  status: string;
  closedAtUtc: string;
  closureRemarks: string;
  revenueAmount: number;
  outstandingBalanceAmount: number;
  profitAmount: number;
  reopenedAtUtc?: string | null;
  reopenReason?: string | null;
  history: Array<{
    id: string;
    action: string;
    actionAtUtc: string;
    actorName?: string | null;
    remarks?: string | null;
    fromStatus: string;
    toStatus: string;
  }>;
};

export type CloseEventDto = {
  remarks: string;
};

export type ReopenEventDto = {
  reason: string;
};

export type EventProfitabilityCostBreakdownDto = {
  foodCostAmount: number;
  beverageCostAmount: number;
  laborCostAmount: number;
  overtimeCostAmount: number;
  equipmentCostAmount: number;
  logisticsCostAmount: number;
  outsourcedCostAmount: number;
  wasteCostAmount: number;
  lossCostAmount: number;
  otherCostAmount: number;
  totalCostAmount: number;
};

export type EventProfitabilityVarianceDto = {
  quotedRevenueAmount: number;
  actualRevenueAmount: number;
  revenueVarianceAmount: number;
  quotedCostAmount: number;
  actualCostAmount: number;
  costVarianceAmount: number;
  quotedGrossProfitAmount: number;
  actualGrossProfitAmount: number;
  grossProfitVarianceAmount: number;
};

export type EventProfitabilityReportDto = {
  eventQuotationId: string;
  reference: string;
  customerName: string;
  customerEmail?: string | null;
  eventType: string;
  eventStartUtc?: string | null;
  eventEndUtc?: string | null;
  guestCount: number;
  revenueAmount: number;
  grossProfitAmount: number;
  contributionMarginPercent: number;
  foodCostPercent: number;
  profitPerGuest: number;
  actualCosts: EventProfitabilityCostBreakdownDto;
  quotedCosts: EventProfitabilityCostBreakdownDto;
  variance: EventProfitabilityVarianceDto;
};


export type CateringEventDto = {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  inquiryId: string;
  inquiryNo: string;
  customerId: string;
  customerName: string;
  acceptedQuotationId: string;
  eventNo: string;
  status: string | number;
  eventType: string | number;
  serviceStyle: string | number;
  eventDateUtc: string;
  venueName: string;
  venueAddress?: string | null;
  guestCount: number;
  packageNameSnapshot?: string | null;
  quoteNoSnapshot: string;
  contractValue: number;
  requiredDepositAmount: number;
  depositReceivedAmount: number;
  paymentReceivedAmount: number;
  remainingBalance: number;
  confirmedAtUtc: string;
  notes?: string | null;
  payments: Array<{ id: string; amount: number; receivedAtUtc: string; referenceNo?: string | null; notes?: string | null }>;
};

export type ConfirmCateringEventDto = {
  acceptedQuotationId: string;
  eventDateUtc?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  notes?: string | null;
  initialDeposit?: unknown | null;
};

export type CateringCommandCenterDto = {
  eventId: string;
  eventNo: string;
  eventStatus: string | number;
  eventType: string | number;
  customerName: string;
  venueName: string;
  eventDateUtc: string;
  guestCount: number;
  packageName?: string | null;
  overallSignal: string | number;
  readinessPercent: number;
  outstandingIssueCount: number;
  tiles: Array<{ key: string; label: string; signal: string | number; percent?: number | null; current: number; target: number; summary: string }>;
  outstandingIssues: Array<{ area: string; signal: string | number; message: string; referenceNo?: string | null }>;
};

export type CateringEventRequirementSummaryDto = {
  eventId: string;
  eventNo: string;
  packageId?: string | null;
  packageName?: string | null;
  guestCount: number;
  hasPackage: boolean;
  hasMissingRecipes: boolean;
  hasShortages: boolean;
  menuItems: Array<{ menuItemId: string; menuItemName: string; quantityPerGuest: number; requiredMenuQuantity: number; hasActiveRecipe: boolean; note?: string | null }>;
  ingredients: Array<{ consumptionLocationId?: string|null; consumptionLocationName?: string|null; itemId: string; itemName: string; baseUomCode: string; requiredBaseQty: number; availableBaseQty: number; reservedBaseQty: number; shortageBaseQty: number; isShort: boolean }>;
};

export type CateringEventScopedSnapshot = {
  event: CateringEventDto;
  commandCenter?: CateringCommandCenterDto | null;
  requirements?: CateringEventRequirementSummaryDto | null;
  productionPlans: unknown[];
  equipmentPlans: unknown[];
  staffingPlans: unknown[];
  reservations: unknown[];
  dispatches: unknown[];
  returns: unknown[];
  waste: unknown[];
  reconciliations: unknown[];
  finalBills: unknown[];
  profitability: unknown[];
};
export type CateringOperationalSnapshot = {
  quotation: EventQuotationSummaryDto;
  menuPlan?: EventMenuPlanDto | null;
  menuVersions: EventMenuPlanVersionDto[];
  menuValidation?: EventMenuOperationalValidationDto | null;
  liveWorkspace?: EventLiveWorkspaceDto | null;
  consumptionForecast?: EventConsumptionForecastDto | null;
  inventoryReservation?: EventInventoryReservationDto | null;
  stockIssueVouchers: EventStockIssueVoucherDto[];
  inventoryReturns: EventInventoryReturnDto[];
  operationalLosses: EventOperationalLossDto[];
  reconciliation?: EventConsumptionReconciliationDto | null;
  closureReadiness?: EventClosureReadinessDto | null;
  closure?: EventClosureDto | null;
  profitability?: EventProfitabilityReportDto | null;
};

export type CateringMenuCatalogDto = {
  packages: CateringPackageSummaryDto[];
  menuItems: MenuItemDto[];
};

function cateringBase(companyId: string): string {
  return `/companies/${companyId}/catering`;
}

function withBranch(params?: { branchId?: string | null }) {
  return params?.branchId ? { branchId: params.branchId } : undefined;
}

async function optionalGet<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const { data } = await http.get<T>(url, { signal });
    return data ?? null;
  } catch (error: unknown) {
    const status = typeof error === "object" && error && "response" in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

    if (status === 403 || status === 404) return null;
    throw error;
  }
}

export async function getCateringDashboard(
  companyId: string,
  params?: { branchId?: string | null; signal?: AbortSignal }
): Promise<EventDashboardDto> {
  const { data } = await http.get<EventDashboardDto>(`${cateringBase(companyId)}/dashboard`, {
    params: withBranch(params),
    signal: params?.signal,
  });
  return data;
}

export async function getCateringExperience(
  companyId: string,
  params?: { branchId?: string | null; signal?: AbortSignal }
): Promise<CateringExperienceDto> {
  const { data } = await http.get<CateringExperienceDto>(`${cateringBase(companyId)}/dashboard/experience`, {
    params: withBranch(params),
    signal: params?.signal,
  });
  return data;
}

export async function listCateringQuotations(companyId: string, params?: { branchId?: string | null; signal?: AbortSignal }): Promise<EventQuotationSummaryDto[]> {
 const [quotes, inquiries] = await Promise.all([listQuotations(companyId,params),listInquiries(companyId,params)]);
 return quotes.map(q=>{ const i=inquiries.find(i=>i.id===q.inquiryId); return {id:q.id,companyId:q.companyId,branchId:q.branchId,eventInquiryId:q.inquiryId,reference:q.quoteNo,customerName:q.customerName,customerEmail:i?.contactEmail??"",customerPhone:i?.contactPhone,eventType:i?.eventType??"",eventStartUtc:i?.proposedEventDateUtc,guestCount:q.guestCount,status:q.status,acceptedVersionId:q.acceptedAtUtc?q.id:null,acceptedAtUtc:q.acceptedAtUtc,currentVersion:{id:q.id,versionNo:q.versionNo,status:q.status,totalAmount:q.grandTotal,depositAmount:q.requiredDepositAmount,requiresApproval:true,approvalStatus:q.approvedAtUtc?"approved":"pending"}}; });
}
export async function listCateringInquiries(companyId: string, signal?: AbortSignal): Promise<EventInquiryDto[]> {
 const rows=await listInquiries(companyId,{signal}); return rows.map(i=>({id:i.id,companyId:i.companyId,reference:i.inquiryNo,customerName:i.customerName,customerEmail:i.contactEmail??"",customerPhone:i.contactPhone,eventType:i.eventType,eventDate:i.proposedEventDateUtc,eventLocation:i.venueName,guestCount:i.expectedGuests,budget:i.budgetAmount,serviceStyle:i.serviceStyle,specialRequirements:i.notes,status:i.status,confirmationSentAtUtc:""}));
}
export async function listCateringPackages(companyId:string,params?:{branchId?:string|null;signal?:AbortSignal}):Promise<CateringPackageSummaryDto[]> {
 const {data}=await http.get<CateringPackage[]>(cateringBase(companyId)+"/packages",{params:withBranch(params),signal:params?.signal});
 return data.map(p=>({id:p.id!,companyId,branchId:p.branchId,code:p.packageNo??"",name:p.name,description:p.description,isActive:p.isActive,publishToPortal:false,currentVersion:{id:p.id!,versionNo:p.catalogVersion,versionLabel:"Catalog revision "+p.catalogVersion,effectiveFromUtc:"",minimumGuests:p.minimumGuests,maximumGuests:p.maximumGuests,pricingType:p.offering?.pricingMode==="Fixed"?"Fixed":"PerGuest",basePrice:p.offering?.pricingMode==="Fixed"?p.offering.fixedPrice:p.pricePerPerson,isCurrent:true,isActive:p.isActive,items:p.offering?p.offering.sections.flatMap((s,si)=>s.items.map((m,mi)=>({id:m.itemId,itemType:"Catering",menuItemId:m.itemId,name:m.name??"",pricingType:m.perGuest?"PerGuest":"Fixed",quantity:m.quantity,unitPrice:m.additionalCharge,isOptional:s.rule!=="All",sortOrder:si*100+mi}))):p.sections.flatMap(s=>s.menuItems.map(m=>({id:m.menuItemId,itemType:"Menu",menuItemId:m.menuItemId,name:m.menuItemName??"",pricingType:"PerGuest",quantity:m.quantityPerGuest,unitPrice:0,isOptional:m.isOptional,sortOrder:m.sortOrder})))}}));
}

export async function listBranchMenuItems(
  companyId: string,
  branchId: string,
  params?: { q?: string | null; activeOnly?: boolean; signal?: AbortSignal }
): Promise<MenuItemDto[]> {
  const { data } = await http.get<MenuItemDto[]>(`/companies/${companyId}/branches/${branchId}/menu/items`, {
    params: {
      q: params?.q || undefined,
      activeOnly: params?.activeOnly ?? true,
    },
    signal: params?.signal,
  });
  return data;
}

export async function getCateringOperationalSnapshot(
  companyId: string,
  quotation: EventQuotationSummaryDto,
  signal?: AbortSignal
): Promise<CateringOperationalSnapshot> {
  const quotationBase = `${cateringBase(companyId)}/quotations/${quotation.id}`;
  const [
    menuPlan,
    menuVersions,
    menuValidation,
    liveWorkspace,
    consumptionForecast,
    inventoryReservation,
    stockIssueVouchers,
    inventoryReturns,
    operationalLosses,
    reconciliation,
    closureReadiness,
    closure,
    profitability,
  ] = await Promise.all([
    optionalGet<EventMenuPlanDto>(`${quotationBase}/menu-plan`, signal),
    optionalGet<EventMenuPlanVersionDto[]>(`${quotationBase}/menu-plan/versions`, signal),
    optionalGet<EventMenuOperationalValidationDto>(`${quotationBase}/menu-plan/validation`, signal),
    optionalGet<EventLiveWorkspaceDto>(`${quotationBase}/live-workspace`, signal),
    optionalGet<EventConsumptionForecastDto>(`${quotationBase}/consumption-forecast`, signal),
    optionalGet<EventInventoryReservationDto>(`${quotationBase}/inventory-reservation`, signal),
    optionalGet<EventStockIssueVoucherDto[]>(`${quotationBase}/stock-issue-vouchers`, signal),
    optionalGet<EventInventoryReturnDto[]>(`${quotationBase}/inventory-returns`, signal),
    optionalGet<EventOperationalLossDto[]>(`${quotationBase}/operational-losses`, signal),
    optionalGet<EventConsumptionReconciliationDto>(`${quotationBase}/consumption-reconciliations/latest`, signal),
    optionalGet<EventClosureReadinessDto>(`${quotationBase}/closure/readiness`, signal),
    optionalGet<EventClosureDto>(`${quotationBase}/closure`, signal),
    optionalGet<EventProfitabilityReportDto>(`${cateringBase(companyId)}/profitability/quotations/${quotation.id}`, signal),
  ]);

  return {
    quotation,
    menuPlan,
    menuVersions: menuVersions ?? [],
    menuValidation,
    liveWorkspace,
    consumptionForecast,
    inventoryReservation,
    stockIssueVouchers: stockIssueVouchers ?? [],
    inventoryReturns: inventoryReturns ?? [],
    operationalLosses: operationalLosses ?? [],
    reconciliation,
    closureReadiness,
    closure,
    profitability,
  };
}

export async function listEventMenuPlanVersions(
  companyId: string,
  quotationId: string,
  signal?: AbortSignal
): Promise<EventMenuPlanVersionDto[]> {
  const { data } = await http.get<EventMenuPlanVersionDto[]>(
    `${cateringBase(companyId)}/quotations/${quotationId}/menu-plan/versions`,
    { signal }
  );
  return data;
}

export async function saveEventMenuPlan(
  companyId: string,
  quotationId: string,
  payload: UpsertEventMenuPlanDto,
  signal?: AbortSignal
): Promise<EventMenuPlanDto> {
  const { data } = await http.put<EventMenuPlanDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/menu-plan`,
    payload,
    { signal }
  );
  return data;
}

export async function approveEventMenuPlan(
  companyId: string,
  quotationId: string,
  payload: ApproveEventMenuPlanDto,
  signal?: AbortSignal
): Promise<EventMenuPlanDto> {
  const { data } = await http.post<EventMenuPlanDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/menu-plan/approval`,
    payload,
    { signal }
  );
  return data;
}

export async function transitionEventMenuPlanStatus(
  companyId: string,
  quotationId: string,
  payload: TransitionEventMenuPlanStatusDto,
  signal?: AbortSignal
): Promise<EventMenuPlanDto> {
  const { data } = await http.post<EventMenuPlanDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/menu-plan/status`,
    payload,
    { signal }
  );
  return data;
}

export async function createEventMenuPlanRevision(
  companyId: string,
  quotationId: string,
  payload: CreateEventMenuPlanRevisionDto,
  signal?: AbortSignal
): Promise<EventMenuPlanDto> {
  const { data } = await http.post<EventMenuPlanDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/menu-plan/revision`,
    payload,
    { signal }
  );
  return data;
}

export async function calculateEventConsumptionForecast(
  companyId: string,
  quotationId: string,
  payload: CalculateEventConsumptionForecastDto,
  signal?: AbortSignal
): Promise<EventConsumptionForecastDto> {
  const { data } = await http.post<EventConsumptionForecastDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/consumption-forecast/calculation`,
    payload,
    { signal }
  );
  return data;
}

export async function reserveEventInventory(
  companyId: string,
  quotationId: string,
  payload: ReserveEventInventoryDto,
  signal?: AbortSignal
): Promise<EventInventoryReservationDto> {
  const { data } = await http.post<EventInventoryReservationDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/inventory-reservation`,
    payload,
    { signal }
  );
  return data;
}

export async function createEventStockIssueVoucher(
  companyId: string,
  quotationId: string,
  payload: CreateEventStockIssueVoucherDto,
  signal?: AbortSignal
): Promise<EventStockIssueVoucherDto> {
  const { data } = await http.post<EventStockIssueVoucherDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/stock-issue-vouchers`,
    payload,
    { signal }
  );
  return data;
}

export async function getEventStockIssueVoucherApprovalReview(
  companyId: string,
  quotationId: string,
  eventSivId: string,
  params?: { materialVarianceTolerancePercent?: number | null; signal?: AbortSignal }
): Promise<EventStockIssueVoucherApprovalReviewDto> {
  const { data } = await http.get<EventStockIssueVoucherApprovalReviewDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/stock-issue-vouchers/${eventSivId}/approval-review`,
    {
      params: {
        materialVarianceTolerancePercent: params?.materialVarianceTolerancePercent ?? undefined,
      },
      signal: params?.signal,
    }
  );
  return data;
}

export async function decideEventStockIssueVoucher(
  companyId: string,
  quotationId: string,
  eventSivId: string,
  payload: DecideEventStockIssueVoucherDto,
  signal?: AbortSignal
): Promise<EventStockIssueVoucherDto> {
  const { data } = await http.post<EventStockIssueVoucherDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/stock-issue-vouchers/${eventSivId}/decision`,
    payload,
    { signal }
  );
  return data;
}

export async function issueEventStockIssueVoucher(
  companyId: string,
  quotationId: string,
  eventSivId: string,
  payload: IssueEventStockIssueVoucherDto,
  signal?: AbortSignal
): Promise<EventStockIssueVoucherDto> {
  const { data } = await http.post<EventStockIssueVoucherDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/stock-issue-vouchers/${eventSivId}/issue`,
    payload,
    { signal }
  );
  return data;
}

export async function postEventStockIssueVoucher(
  companyId: string,
  quotationId: string,
  eventSivId: string,
  payload: PostEventStockIssueVoucherDto,
  signal?: AbortSignal
): Promise<EventStockIssueVoucherPostResultDto> {
  const { data } = await http.post<EventStockIssueVoucherPostResultDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/stock-issue-vouchers/${eventSivId}/post`,
    payload,
    { signal }
  );
  return data;
}

export async function createEventInventoryReturn(
  companyId: string,
  quotationId: string,
  payload: CreateEventInventoryReturnDto,
  signal?: AbortSignal
): Promise<EventInventoryReturnDto> {
  const { data } = await http.post<EventInventoryReturnDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/inventory-returns`,
    payload,
    { signal }
  );
  return data;
}

export async function postEventInventoryReturn(
  companyId: string,
  quotationId: string,
  eventInventoryReturnId: string,
  payload: PostEventInventoryReturnDto,
  signal?: AbortSignal
): Promise<EventInventoryReturnPostResultDto> {
  const { data } = await http.post<EventInventoryReturnPostResultDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/inventory-returns/${eventInventoryReturnId}/post`,
    payload,
    { signal }
  );
  return data;
}

export async function createEventOperationalLoss(
  companyId: string,
  quotationId: string,
  payload: CreateEventOperationalLossDto,
  signal?: AbortSignal
): Promise<EventOperationalLossDto> {
  const { data } = await http.post<EventOperationalLossDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/operational-losses`,
    payload,
    { signal }
  );
  return data;
}

export async function decideEventOperationalLoss(
  companyId: string,
  quotationId: string,
  eventOperationalLossId: string,
  payload: DecideEventOperationalLossDto,
  signal?: AbortSignal
): Promise<EventOperationalLossDto> {
  const { data } = await http.post<EventOperationalLossDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/operational-losses/${eventOperationalLossId}/decision`,
    payload,
    { signal }
  );
  return data;
}

export async function runEventConsumptionReconciliation(
  companyId: string,
  quotationId: string,
  payload: RunEventConsumptionReconciliationDto,
  signal?: AbortSignal
): Promise<EventConsumptionReconciliationDto> {
  const { data } = await http.post<EventConsumptionReconciliationDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/consumption-reconciliations/run`,
    payload,
    { signal }
  );
  return data;
}

export async function submitEventConsumptionReconciliation(
  companyId: string,
  quotationId: string,
  reconciliationId: string,
  payload: SubmitEventConsumptionReconciliationDto,
  signal?: AbortSignal
): Promise<EventConsumptionReconciliationDto> {
  const { data } = await http.post<EventConsumptionReconciliationDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/consumption-reconciliations/${reconciliationId}/submit`,
    payload,
    { signal }
  );
  return data;
}

export async function closeEvent(
  companyId: string,
  quotationId: string,
  payload: CloseEventDto,
  signal?: AbortSignal
): Promise<EventClosureDto> {
  const { data } = await http.post<EventClosureDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/closure`,
    payload,
    { signal }
  );
  return data;
}

export async function reopenEvent(
  companyId: string,
  quotationId: string,
  payload: ReopenEventDto,
  signal?: AbortSignal
): Promise<EventClosureDto> {
  const { data } = await http.post<EventClosureDto>(
    `${cateringBase(companyId)}/quotations/${quotationId}/closure/reopen`,
    payload,
    { signal }
  );
  return data;
}

export async function getEventProfitability(
  companyId: string,
  quotationId: string,
  signal?: AbortSignal
): Promise<EventProfitabilityReportDto> {
  const { data } = await http.get<EventProfitabilityReportDto>(
    `${cateringBase(companyId)}/profitability/quotations/${quotationId}`,
    { signal }
  );
  return data;
}

export async function listCateringEvents(
  companyId: string,
  params?: { branchId?: string | null; status?: string | number | null; signal?: AbortSignal }
): Promise<CateringEventDto[]> {
  const { data } = await http.get<CateringEventDto[]>(`${cateringBase(companyId)}/events`, {
    params: { branchId: params?.branchId || undefined, status: params?.status ?? undefined },
    signal: params?.signal,
  });
  return data;
}

export async function getOrCreateCateringEventForQuotation(
  companyId: string,
  quotationId: string,
  signal?: AbortSignal
): Promise<CateringEventDto> {
  const { data } = await http.get<CateringEventDto>(`${cateringBase(companyId)}/quotations/${quotationId}/event`, { signal });
  return data;
}

export async function confirmCateringEventFromQuotation(
  companyId: string,
  payload: ConfirmCateringEventDto,
  signal?: AbortSignal
): Promise<CateringEventDto> {
  const { data } = await http.post<CateringEventDto>(`${cateringBase(companyId)}/events/from-quotation`, payload, { signal });
  return data;
}

function eventPath(companyId: string, eventId: string, suffix = ""): string {
  return `${cateringBase(companyId)}/events/${eventId}${suffix}`;
}

export const cateringEventApi = {
  async get(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<CateringEventDto>(eventPath(companyId, eventId), { signal });
    return data;
  },
  async commandCenter(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<CateringCommandCenterDto>(eventPath(companyId, eventId, "/command-center"), { signal });
    return data;
  },
  async requirements(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<CateringEventRequirementSummaryDto>(eventPath(companyId, eventId, "/requirements"), { signal });
    return data;
  },
  async generateButcheryDemand(companyId: string, eventId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/butchery/demand"), payload, { signal });
    return data;
  },
  async listProductionPlans(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/production-plans"), { signal });
    return data;
  },
  async generateProductionPlan(companyId: string, eventId: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/production-plans"), payload, { signal });
    return data;
  },
  async listEquipmentPlans(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/equipment-plans"), { signal });
    return data;
  },
  async generateEquipmentPlan(companyId: string, eventId: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/equipment-plans"), payload, { signal });
    return data;
  },
  async listStaffingPlans(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/staffing-plans"), { signal });
    return data;
  },
  async generateStaffingPlan(companyId: string, eventId: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/staffing-plans"), payload, { signal });
    return data;
  },
  async listReservations(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/reservations"), { signal });
    return data;
  },
  async createReservation(companyId: string, eventId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/reservations"), payload, { signal });
    return data;
  },
  async createSiv(companyId: string, eventId: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/sivs"), payload, { signal });
    return data;
  },
  async listDispatches(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/dispatches"), { signal });
    return data;
  },
  async createDispatch(companyId: string, eventId: string, payload: Record<string, unknown>, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/dispatches"), payload, { signal });
    return data;
  },
  async listReturns(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/returns"), { signal });
    return data;
  },
  async listWaste(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/waste"), { signal });
    return data;
  },
  async listReconciliations(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/reconciliations"), { signal });
    return data;
  },
  async createReconciliation(companyId: string, eventId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/reconciliations"), payload, { signal });
    return data;
  },
  async listFinalBills(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/final-bills"), { signal });
    return data;
  },
  async previewFinalBill(companyId: string, eventId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/final-bills/preview"), payload, { signal });
    return data;
  },
  async listProfitability(companyId: string, eventId: string, signal?: AbortSignal) {
    const { data } = await http.get<unknown[]>(eventPath(companyId, eventId, "/profitability"), { signal });
    return data;
  },
  async previewProfitability(companyId: string, eventId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/profitability/preview"), payload, { signal });
    return data;
  },
  async procurementRequisition(companyId: string, eventId: string, payload: Record<string, unknown> = {}, signal?: AbortSignal) {
    const { data } = await http.post<unknown>(eventPath(companyId, eventId, "/procurement/requisition"), payload, { signal });
    return data;
  },
};

export async function getCateringEventScopedSnapshot(
  companyId: string,
  event: CateringEventDto,
  signal?: AbortSignal
): Promise<CateringEventScopedSnapshot> {
  const [commandCenter, requirements, productionPlans, equipmentPlans, staffingPlans, reservations, dispatches, returns, waste, reconciliations, finalBills, profitability] = await Promise.all([
    optionalGet<CateringCommandCenterDto>(eventPath(companyId, event.id, "/command-center"), signal),
    optionalGet<CateringEventRequirementSummaryDto>(eventPath(companyId, event.id, "/requirements"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/production-plans"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/equipment-plans"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/staffing-plans"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/reservations"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/dispatches"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/returns"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/waste"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/reconciliations"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/final-bills"), signal),
    optionalGet<unknown[]>(eventPath(companyId, event.id, "/profitability"), signal),
  ]);

  return {
    event,
    commandCenter,
    requirements,
    productionPlans: productionPlans ?? [],
    equipmentPlans: equipmentPlans ?? [],
    staffingPlans: staffingPlans ?? [],
    reservations: reservations ?? [],
    dispatches: dispatches ?? [],
    returns: returns ?? [],
    waste: waste ?? [],
    reconciliations: reconciliations ?? [],
    finalBills: finalBills ?? [],
    profitability: profitability ?? [],
  };
}
