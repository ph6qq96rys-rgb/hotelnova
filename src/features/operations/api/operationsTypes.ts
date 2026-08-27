export type Guid = string;

export interface CashierShiftDto {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  cashierId: Guid;
  cashierName: string;
  terminal: string;
  openingFloat: number;
  closingCash?: number | null;
  openedAtUtc: string;
  closedAtUtc?: string | null;
  status: string;
}

export interface OperationsPosStoreDto {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  code?: string | null;
  name: string;
  isActive: boolean;
  issueStockLocationId?: Guid | null;
  issueStockLocationName?: string | null;
}

export interface SafeDropDto {
  id: Guid;
  cashierShiftId: Guid;
  amount: number;
  method: string;
  referenceNo: string;
  droppedByName: string;
  droppedAtUtc: string;
  notes?: string | null;
}

export interface SalesSummaryDto {
  salesCount: number;
  grossSales: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  netSales: number;
  totalCogs: number;
  grossProfit: number;
  payments: Array<{ method: string; amount: number; count: number }>;
}

export interface EndOfDayReportDto {
  id: Guid;
  businessDate: string;
  grossSales: number;
  netSales: number;
  totalPayments: number;
  totalSafeDrops: number;
  cashVariance: number;
  salesCount: number;
  generatedAtUtc: string;
  generatedByName: string;
}

export interface WorkflowReasonCodeDto {
  id: Guid;
  categoryId: Guid;
  categoryName: string;
  code: string;
  description: string;
  requiresComment: boolean;
  requiresAttachment: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface BackOfficeEfficiencySnapshotDto {
  companyId: Guid;
  branchId: Guid;
  businessDate: string;
  generatedAtUtc: string;
  assignedStockLocations: number;
  lowStockItems: number;
  outOfStockItems: number;
  expiringLots: number;
  pendingSivs: number;
  pendingPurchaseRequisitions: number;
  pendingProductionBatches: number;
  openWasteRecords: number;
  equipmentIssues: number;
  inventoryAlerts: BackOfficeInventoryAlertDto[];
  expiringStock: BackOfficeExpiringLotDto[];
  recommendations: BackOfficeActionRecommendationDto[];
}

export interface BackOfficeInventoryAlertDto {
  itemId: Guid;
  itemName: string;
  stockLocationId: Guid;
  stockLocationName: string;
  stockLocationCode: string;
  onHandBaseQty: number;
  availableBaseQty: number;
  reorderLevel: number;
  baseUom: string;
  severity: string;
  recommendedAction: string;
}

export interface BackOfficeExpiringLotDto {
  lotId: Guid;
  itemId: Guid;
  itemName: string;
  stockLocationId: Guid;
  stockLocationName: string;
  batchNo: string;
  expiryDate: string;
  qtyRemainingBase: number;
  baseUom: string;
  daysToExpiry: number;
}

export interface BackOfficeActionRecommendationDto {
  useCase: string;
  severity: string;
  title: string;
  detail: string;
  recommendedAction: string;
}
export interface DailyOperationChecklistItemDto {
  id: Guid;
  area: string;
  item: string;
  isCritical: boolean;
  isCompleted: boolean;
  notes: string;
}

export interface DailyOperationBriefingAcknowledgementDto {
  id: Guid;
  employeeId: Guid;
  employeeName: string;
  channel: string;
  acknowledgedAtUtc: string;
}

export interface DailyOperationPlanDto {
  id: Guid;
  companyId: Guid;
  branchId: Guid;
  isPersisted: boolean;
  businessDate: string;
  shiftName: string;
  status: string;
  expectedCovers: number;
  expectedSales: number;
  requiredEmployees: number;
  requiredEmployeesByPosition: string;
  requiredFoodProduction: string;
  criticalInventoryLevels: string;
  outstandingPurchaseOrders: string;
  equipmentAvailability: string;
  openOperationalIssues: string;
  salesTargets: string;
  planningInputs: string;
  briefingNotes: string;
  briefedAtUtc?: string | null;
  briefedByName: string;
  readyAtUtc?: string | null;
  readyByName: string;
  readinessExceptionReason: string;
  criticalOpenCount: number;
  checklistItems: DailyOperationChecklistItemDto[];
  acknowledgements: DailyOperationBriefingAcknowledgementDto[];
}

export interface UpsertDailyOperationPlanDto {
  businessDate: string;
  shiftName: string;
  expectedCovers: number;
  expectedSales: number;
  requiredEmployees: number;
  requiredEmployeesByPosition?: string | null;
  requiredFoodProduction?: string | null;
  criticalInventoryLevels?: string | null;
  outstandingPurchaseOrders?: string | null;
  equipmentAvailability?: string | null;
  openOperationalIssues?: string | null;
  salesTargets?: string | null;
  planningInputs?: string | null;
}
