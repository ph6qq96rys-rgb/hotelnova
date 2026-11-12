import { http } from "../../../api/http";

export type AuthorityMode = "recommend" | "prepareForApproval" | "executeWithinPolicy";
export type ScopeLevel = "branch" | "department" | "stockLocation";
export type Metric =
  | "netSales" | "foodCostPercent" | "wastePercent" | "stockAvailabilityPercent" | "stockAccuracyPercent" | "purchasingOnTimePercent" | "taskCompletionPercent";
export type Direction = "atLeast" | "atMost";
export type PeriodType = "daily" | "weekly" | "monthly" | "custom";
export type TargetStatus = "draft" | "pendingApproval" | "active" | "superseded" | "retired" | "rejected";
export type FindingKind = "actualMiss" | "forecastRisk" | "exception" | "dataQuality" | "configuration";
export type Severity = "low" | "medium" | "high" | "critical";
export type EvidenceQuality = "weak" | "partial" | "strong";
export type FindingStatus = "open" | "acknowledged" | "resolved" | "dismissed";
export type ActionStatus = "proposed" | "pendingApproval" | "approved" | "executing" | "executed" | "failed" | "rejected" | "cancelled" | "blocked";
export type ProgressStatus = "onTrack" | "atRisk" | "missed" | "met" | "noData";

export type Ref = { id: string; name: string; branchId?: string | null; isActive: boolean };
export type ActionType = { key: string; group: string; label: string; description: string; executable: boolean; approverPermission?: string | null; availableFrom?: string | null };
export type MetricDefinition = { metric: Metric; label: string; unit: "money" | "percent"; defaultDirection: Direction; calculation: string; dataSource: string; pointInTime: boolean; additive: boolean };
export type References = { branches: Ref[]; departments: Ref[]; locations: Ref[]; employees: Ref[]; actionTypes: ActionType[]; metrics: MetricDefinition[] };
export type Evidence = { type: string; id?: string | null; no?: string | null; label: string };

export type Settings = {
  enabled: boolean; automationPaused: boolean; pausedAtUtc?: string | null; pausedByName?: string | null; pauseReason?: string | null; policyVersion: number;
  monitorIntervalMinutes: number; briefingHour: number; narrativeEnabled: boolean; unpaidSaleHours: number; posCloseHours: number; sivPendingHours: number;
  grnDraftHours: number; poOverdueDays: number; adjustmentPendingHours: number; dataFreshnessHours: number; forecastTolerancePercent: number;
  lastMonitoredAtUtc?: string | null; lastBriefingAtUtc?: string | null; version?: string | null; narrativeAvailable: boolean;
  acknowledgeHours: number; reminderHours: number; remindersBeforeEscalation: number;
  expiryWarningDays: number; transferDelayHours: number; countIntervalDays: number; countVarianceTolerancePercent: number; countVarianceMinValue: number;
  replenishmentLookbackDays: number; replenishmentCoverageDays: number;
  weightPrice: number; weightQuality: number; weightLeadTime: number; weightReliability: number; weightPaymentTerms: number; supplierAcknowledgeHours: number;
  productionReadyHour: number; yieldTolerancePercent: number; wasteSpikePercent: number; wasteMinValue: number; cateringReadinessDays: number;
  discountRatePercent: number; refundRatePercent: number; voidRatePercent: number; controlLookbackDays: number; staffingGraceMinutes: number;
  caseExplanationHours: number; caseChallengeDays: number; caseRecurrenceDays: number; caseEscalateRecurrence: number;
  scoreWeightTargets: number; scoreWeightInstructions: number; scoreWeightReporting: number; scoreWeightCorrections: number; scoreMinItems: number;
  reviewWeekday: number; commitmentConfirmHours: number; reviewRetentionDays: number;
};
export type SettingsInput = Omit<Settings, "automationPaused" | "pausedAtUtc" | "pausedByName" | "pauseReason" | "policyVersion" | "lastMonitoredAtUtc" | "lastBriefingAtUtc" | "narrativeAvailable">;

export type Scope = {
  id: string; level: ScopeLevel; branchId: string; branchName: string; departmentId?: string | null; departmentName?: string | null; stockLocationId?: string | null;
  stockLocationName?: string | null; isManaged: boolean; responsibleEmployeeId?: string | null; responsibleName?: string | null; escalationEmployeeId?: string | null;
  escalationName?: string | null; effectiveFrom: string; effectiveTo?: string | null; notes?: string | null; createdByName: string; createdAtUtc: string; version: string;
  allocationPriority?: number | null;
};
export type ScopeInput = {
  branchId: string; departmentId?: string | null; stockLocationId?: string | null; isManaged: boolean; responsibleEmployeeId?: string | null;
  escalationEmployeeId?: string | null; effectiveFrom?: string | null; notes?: string | null; allocationPriority?: number | null;
};
export type ConfigurationIssue = { severity: "Error" | "Warning" | "Info"; message: string; branchId?: string | null; scopeId?: string | null };

export type Policy = {
  id: string; actionType: string; actionLabel: string; mode: AuthorityMode; branchId?: string | null; branchName?: string | null; category?: string | null;
  supplierId?: string | null; maxValue?: number | null; allowedFromHour?: number | null; allowedToHour?: number | null; requiresIndependentApproval: boolean;
  approverPermission?: string | null; isActive: boolean; policyVersion: number; effectiveFromUtc: string; effectiveToUtc?: string | null;
  supersedesPolicyId?: string | null; notes?: string | null; createdByName: string; version: string;
};
export type PolicyInput = {
  actionType: string; mode: AuthorityMode; branchId?: string | null; category?: string | null; supplierId?: string | null; maxValue?: number | null;
  allowedFromHour?: number | null; allowedToHour?: number | null; requiresIndependentApproval: boolean; approverPermission?: string | null; notes?: string | null;
  version?: string | null;
};

export type Concern = { id: string; text: string; raisedByName: string; raisedAtUtc: string; response?: string | null; respondedByName?: string | null; respondedAtUtc?: string | null };
export type Target = {
  id: string; targetGroupId: string; versionNo: number; supersedesTargetId?: string | null; name: string; metric: Metric; metricLabel: string; unit: "money" | "percent";
  calculation: string; dataSource: string; direction: Direction; branchId?: string | null; branchName?: string | null; departmentId?: string | null;
  departmentName?: string | null; baseline?: number | null; targetValue: number; periodType: PeriodType; startDate: string; endDate: string; accountableRole: string;
  accountableEmployeeId?: string | null; accountableName?: string | null; dependencies?: string | null; constraints?: string | null; status: TargetStatus;
  amendmentReason?: string | null; appliesRetroactively: boolean; retroactiveDecision?: string | null; createdByName: string; createdAtUtc: string;
  decidedByName?: string | null; decidedAtUtc?: string | null; decisionNote?: string | null; version: string; concerns: Concern[];
};
export type TargetInput = {
  name: string; metric: Metric; direction?: Direction | null; branchId?: string | null; departmentId?: string | null; baseline?: number | null; targetValue: number;
  periodType: PeriodType; startDate: string; endDate: string; accountableRole: string; accountableEmployeeId?: string | null; dependencies?: string | null;
  constraints?: string | null; amendmentReason?: string | null; appliesRetroactively: boolean; retroactiveDecision?: string | null; version?: string | null;
};

export type Finding = {
  id: string; ruleKey: string; kind: FindingKind; severity: Severity; priority: number; evidenceQuality: EvidenceQuality; title: string; detail: string;
  branchId?: string | null; branchName?: string | null; departmentId?: string | null; departmentName?: string | null; targetId?: string | null;
  periodStart?: string | null; periodEnd?: string | null; actual?: number | null; expected?: number | null; impact?: number | null; evidence: Evidence[];
  dataAsOfUtc: string; occurrences: number; firstDetectedAtUtc: string; lastDetectedAtUtc: string; status: FindingStatus; ownerEmployeeId?: string | null;
  ownerName?: string | null; ownerRole?: string | null; acknowledgedAtUtc?: string | null; resolvedAtUtc?: string | null; resolvedByName?: string | null;
  resolutionNote?: string | null; version: string;
};

export type OfficerAction = {
  id: string; actionType: string; actionLabel: string; executable: boolean; branchId?: string | null; branchName?: string | null; title: string; reason?: string | null;
  mode: AuthorityMode; status: ActionStatus; trigger: string; findingId?: string | null; value?: number | null; authorityNote?: string | null; requestedByName: string;
  requestedAtUtc: string; decidedByName?: string | null; decidedAtUtc?: string | null; decisionNote?: string | null; attempts: number; maxAttempts: number;
  nextAttemptAtUtc?: string | null; lastError?: string | null; resultReference?: string | null; executedAtUtc?: string | null; policyVersion: number;
  modelVersion?: string | null; evidence: Evidence[]; payloadJson: string; version: string; canDecide: boolean;
};
export type Check = { name: string; passed: boolean; detail: string };
export type Attempt = { attemptNo: number; startedAtUtc: string; finishedAtUtc?: string | null; outcome: string; message?: string | null; checks: Check[] };

export type TargetProgress = {
  targetId: string; name: string; metricLabel: string; unit: "money" | "percent"; direction: Direction; targetValue: number; branchId?: string | null;
  branchName?: string | null; accountableRole: string; accountableName?: string | null; periodStart: string; periodEnd: string; value?: number | null;
  projected?: number | null; status: ProgressStatus; quality: EvidenceQuality; dataAsOfUtc?: string | null; limitations: string[];
  lastPeriodStart?: string | null; lastPeriodEnd?: string | null; lastValue?: number | null; lastStatus?: ProgressStatus | null;
};
export type Commitment = { type: string; id?: string | null; reference: string; label: string; dueUtc: string; branchId?: string | null; branchName?: string | null };
export type BranchSummary = { branchId: string; branchName: string; critical: number; high: number; open: number; targetsAtRisk: number; targetsMissed: number };
export type Briefing = {
  id?: string | null; branchId?: string | null; scopeName: string; businessDate: string; generatedAtUtc: string; dataAsOfUtc?: string | null; dataStale: boolean;
  enabled: boolean; automationPaused: boolean; policyVersion: number; targets: TargetProgress[]; priorities: Finding[]; dataQuality: Finding[];
  unacknowledged: Finding[]; decisions: OfficerAction[]; targetsAwaitingApproval: Target[]; upcoming: Commitment[]; configuration: ConfigurationIssue[];
  branches: BranchSummary[]; narrative?: string | null; modelVersion?: string | null; notes: string[];
  overdueInstructions?: Instruction[] | null; blockers?: Blocker[] | null;
};
export type BriefingListItem = { id: string; branchId?: string | null; businessDate: string; generatedAtUtc: string; modelVersion?: string | null };
export type AuditEntry = { id: string; entityType: string; entityId: string; event: string; detailJson?: string | null; actorName: string; policyVersion: number; atUtc: string };
export type MonitorResult = { detected: number; opened: number; updated: number; resolved: number; targetsChecked: number; actionsProposed: number };

export type Package = "none" | "insights" | "operations" | "leadership";
export type SubscriptionStatus = "notSubscribed" | "trial" | "active" | "suspended" | "cancelled" | "expired";
export type PackageDefinition = { package: Package; label: string; description: string; capabilities: string[]; defaultIncludedUnits: number; dependencies: string[] };
export type Subscription = {
  package: Package; status: SubscriptionStatus; active: boolean; startsOn?: string | null; endsOn?: string | null; includedUnitsPerMonth: number;
  monthlyPrice?: number | null; overagePricePerUnit?: number | null; currency: string; overageAuthorized: boolean; overageBudgetUnits?: number | null;
  overageAuthorizedByName?: string | null; overageAuthorizedAtUtc?: string | null; warningPercent: number; chargesAcceptedByName?: string | null;
  chargesAcceptedAtUtc?: string | null; statusReason?: string | null; version?: string | null; period: number; usedUnits: number; remainingUnits?: number | null;
  warning: boolean; exhausted: boolean; usage: { kind: string; count: number; units: number }[]; capabilities: string[];
  branches: { branchId: string; branchName: string; active: boolean; activatedAtUtc?: string | null; activatedByName?: string | null }[];
  packages: PackageDefinition[]; issues: string[];
};
export type SubscribeInput = {
  package: Package; acceptCharges: boolean; startsOn?: string | null; endsOn?: string | null; includedUnitsPerMonth?: number | null; monthlyPrice?: number | null;
  overagePricePerUnit?: number | null; currency?: string | null; warningPercent?: number | null; trial: boolean; version?: string | null;
};


export type CompletionMode = "transaction" | "evidence";
export type InstructionKind = "mandatory" | "recommendation";
export type InstructionPriority = "low" | "normal" | "high" | "urgent";
export type InstructionStatus = "issued" | "acknowledged" | "inProgress" | "blocked" | "awaitingReview" | "completed" | "cancelled" | "superseded";
export type BlockerStatus = "open" | "resolved" | "escalated";
export type ExceptionStatus = "pending" | "approved" | "rejected";
export type Blocker = {
  id: string; instructionId: string; cause: string; impact?: string | null; evidence?: string | null; assistanceRequired?: string | null; assignedRole: string;
  assignedEmployeeId?: string | null; assignedName?: string | null; status: BlockerStatus; reportedByName: string; reportedAtUtc: string; reportedBeforeDue: boolean;
  escalatedAtUtc?: string | null; resolvedAtUtc?: string | null; resolvedByName?: string | null; resolution?: string | null;
};
export type InstructionException = {
  id: string; instructionId: string; requestedDueAtUtc?: string | null; waive: boolean; reason: string; status: ExceptionStatus; requestedByName: string;
  requestedAtUtc: string; originalDueAtUtc: string; decidedByName?: string | null; decidedAtUtc?: string | null; decisionNote?: string | null;
};
export type InstructionEvent = { event: string; note?: string | null; fromName?: string | null; toName?: string | null; actorName: string; atUtc: string };
export type Instruction = {
  id: string; branchId: string; branchName?: string | null; departmentId?: string | null; departmentName?: string | null; planId?: string | null; findingId?: string | null;
  kind: InstructionKind; priority: InstructionPriority; title: string; actionText: string; reason: string; authority: string; ownerEmployeeId: string;
  ownerName?: string | null; ownerRole?: string | null; dueAtUtc: string; acknowledgeByUtc: string; requiredEvidence: string; completionMode: CompletionMode;
  completionRef?: string | null; status: InstructionStatus; overdue: boolean; acknowledgementOverdue: boolean; progressPercent: number; progressNote?: string | null;
  acknowledgedAtUtc?: string | null; evidenceText?: string | null; evidenceReference?: string | null; completedAtUtc?: string | null; completedByName?: string | null;
  completionNote?: string | null; remindersSent: number; escalatedAtUtc?: string | null; escalatedToName?: string | null; issuedByName: string; issuedAtUtc: string;
  version: string; isMine: boolean; blockers: Blocker[]; exceptions: InstructionException[]; history: InstructionEvent[];
};
export type InstructionInput = {
  branchId: string; departmentId?: string | null; ownerEmployeeId: string; title: string; actionText: string; reason: string; priority: InstructionPriority;
  dueAtUtc: string; requiredEvidence: string; completionMode: CompletionMode; completionRef?: string | null; findingId?: string | null; mandatory: boolean; clientRequestId: string;
};

export type PlanKind = "daily" | "event" | "production";
export type PlanChange = {
  activityKey: string; change: "added" | "removed" | "changed" | "unchanged" | "completed"; title: string; previousTitle?: string | null; ownerName?: string | null;
  previousOwnerName?: string | null; dueAtUtc?: string | null; previousDueAtUtc?: string | null; dependsOn?: string | null; previousDependsOn?: string | null;
  quantity?: number | null; previousQuantity?: number | null; unit?: string | null; costChange?: number | null; instructionEffect: string;
};
export type PlanChanges = {
  planId: string; versionNo: number; comparedPlanId?: string | null; comparedVersionNo?: number | null; revisionReason?: string | null; material: boolean;
  materialReasons: string[]; costChange?: number | null; changes: PlanChange[];
};
export type InstructionChange = { instructionId: string; title: string; event: string; note: string; atUtc: string; status: string; dueAtUtc: string; planId?: string | null };
export type ProductionIngredient = { itemId: string; itemName: string; baseUnit: string; needed: number; onHand: number; short: number };
export type ProductionLine = {
  itemId: string; itemName: string; baseUnit: string; recipeId: string; recipeVersion: number; demand: number; usableStock: number; required: number; yieldPerBatch: number;
  batches: number; plannedQuantity: number; locationId?: string | null; locationName?: string | null; supervisorEmployeeId?: string | null; supervisorName?: string | null;
  readyByUtc: string; demandFrom: string[]; ingredients: ProductionIngredient[];
};
export type ProductionRequirements = { branchId: string; branchName: string; businessDate: string; calculatedAtUtc: string; assumptions: string[]; blocked: string[]; lines: ProductionLine[] };
export type PlanStatus = "draft" | "pendingActivation" | "active" | "superseded" | "completed" | "cancelled";
export type ActivityStatus = "planned" | "instructed" | "done" | "cancelled";
export type PlanActivity = {
  id: string; activityKey: string; sortOrder: number; title: string; detail?: string | null; departmentId?: string | null; departmentName?: string | null;
  ownerEmployeeId?: string | null; ownerName?: string | null; ownerRole: string; dueAtUtc: string; dependsOn?: string | null; completionCriteria: string;
  completionMode: CompletionMode; completionRef?: string | null; linkedDocNo?: string | null; status: ActivityStatus; instructionId?: string | null;
  instructionStatus?: InstructionStatus | null;
};
export type Plan = {
  id: string; branchId: string; branchName?: string | null; kind: PlanKind; businessDate: string; cateringEventId?: string | null; title: string; planGroupId: string;
  versionNo: number; supersedesPlanId?: string | null; status: PlanStatus; assumptions?: string | null; constraints?: string | null; revisionReason?: string | null;
  createdByName: string; createdAtUtc: string; activatedByName?: string | null; activatedAtUtc?: string | null; activationActionId?: string | null;
  activationStatus?: ActionStatus | null; activationNote?: string | null; version: string; activities: PlanActivity[]; issues: string[];
};
export type PlanListItem = {
  id: string; branchId: string; branchName?: string | null; kind: PlanKind; businessDate: string; title: string; versionNo: number; status: PlanStatus;
  activities: number; done: number; createdAtUtc: string;
};
export type OfficerMessage = {
  id: string; threadId: string; role: "User" | "Officer"; text: string; sources: Evidence[]; dataAsOfUtc?: string | null; modelVersion?: string | null;
  language?: string | null; atUtc: string;
};
export type ReplenishmentLine = {
  itemId: string; itemName: string; baseUom: string; uomId: string; uom: string; toBaseFactor: number; onHand: number; reserved: number; inbound: number;
  dailyUsage: number; usageBasis: string; daysOfCover?: number | null; coverageDays: number; leadTimeDays: number; target: number; suggested: number;
  sourceFree: number; allocated: number; allocatedQty: number; shortfall: number; unitCost?: number | null; estimatedCost?: number | null; status: string;
  warnings: string[]; ruleVersions: string[];
};
export type ReplenishmentLocation = {
  locationId: string; locationName: string; allocationPriority?: number | null; error?: string | null; itemsEvaluated: number; itemsCovered: number;
  closedDays: number; openSivs: number; recipeIssues: string[]; lines: ReplenishmentLine[];
};
export type AllocationConflict = { itemId: string; itemName: string; baseUom: string; needed: number; available: number; allocation: string[] };
export type TransferOption = {
  itemId: string; itemName: string; baseUom: string; toLocationId: string; toLocationName: string; shortfall: number; fromBranchId: string;
  fromBranchName: string; fromLocationId: string; fromLocationName: string; available: number; unitCost?: number | null;
};
export type PurchaseNeed = { itemId: string; itemName: string; baseUom: string; shortfall: number; onOrder: number; openOrders: string[]; locationId: string; unitCost?: number | null };

export type RequirementOrigin = {
  requisitionId: string; requisitionLineId: string; requisitionNo: string; branchId?: string | null; branchName?: string | null; status: string; priority: string;
  purpose: string; quantity: number; unit: string; baseQuantity?: number | null; needByUtc: string; specification?: string | null; consolidable: boolean;
};
export type SupplierOption = { supplierId: string; name: string; preferred: boolean; agreedPrice?: number | null; lastPrice?: number | null; leadTimeDays?: number | null; suggested: boolean };
export type Requirement = {
  itemId: string; itemName: string; baseUnit: string; required: number; awaitingApproval: number; freeAtMainStore: number; inTransit: number; onOrder: number;
  netToBuy: number; needByUtc: string; urgency: string; urgencyRank: number; issues: string[]; origins: RequirementOrigin[]; suppliers: SupplierOption[];
};
export type Requirements = { calculatedAtUtc: string; assumptions: string[]; items: Requirement[]; excluded: string[] };
export type QuotationRequestSummary = { id: string; reference: string; status: string; branchId?: string | null; branchName?: string | null; responseDue: string; lines: number; quotes: number };
export type QuoteScore = {
  quoteId: string; supplierId: string; supplierName: string; rank: number; score?: number | null; unitCostBase: number; lineTotal: number; currency: string;
  exchangeRate: number; validUntil: string; deliveryDate: string; paymentTermDays: number; quotedBaseQty: number; priceScore?: number | null;
  leadTimeScore?: number | null; reliabilityScore?: number | null; qualityScore?: number | null; paymentScore?: number | null; eligible: boolean; notes: string[];
};
export type ComparisonLine = {
  requisitionLineId: string; requisitionNo: string; itemName: string; unit: string; quantity: number; baseQuantity: number; needByUtc?: string | null;
  specification?: string | null; quotes: QuoteScore[]; recommendedQuoteId?: string | null;
};
export type Comparison = {
  requestId: string; reference: string; status: string; version: string; currency: string; calculatedAtUtc: string;
  weights: { price: number; quality: number; leadTime: number; reliability: number; paymentTerms: number };
  assumptions: string[]; missingData: string[]; lines: ComparisonLine[];
};
export type ReplenishmentReview = {
  branchId: string; branchName: string; calculatedAtUtc: string; lookbackDays: number; coverageDays: number; assumptions: string[];
  locations: ReplenishmentLocation[]; conflicts: AllocationConflict[]; transfers: TransferOption[]; purchaseNeeds: PurchaseNeed[]; estimatedCost?: number | null;
};
export type ReplenishDestination = { toLocationId: string; lines: { itemId: string; qty: number }[] };

export type OfficerAnswer = { threadId: string; question: OfficerMessage; answer: OfficerMessage; usedModel: boolean; notes: string[] };

export type CaseStatus = "awaitingExplanation" | "awaitingAssessment" | "assessed" | "challenged" | "final" | "closed" | "withdrawn";
export type Responsibility = "managerControlled" | "shared" | "externalDependency" | "insufficientEvidence";
export type FailureType = "resultMissed" | "instructionNotFollowed" | "both";
export type ReviewDecision = "upheld" | "amended" | "withdrawn";
export type CorrectionStatus = "proposed" | "instructed" | "done" | "verified" | "notEffective" | "cancelled";
export type PersonnelDecision = "noAction" | "coaching" | "formalWarning" | "deduction" | "suspension" | "termination";
export type CaseListItem = {
  id: string; caseNo: string; kind: "missedTarget" | "instructionFailure"; status: CaseStatus; branchId: string; branchName?: string | null; subjectEmployeeId: string;
  subjectName?: string | null; title: string; severity: Severity; openedAtUtc: string; explanationDueUtc: string; explanationOverdue: boolean; recurrenceNo: number;
  escalated: boolean; dataLimited: boolean; responsibility?: Responsibility | null; isMine: boolean;
};
export type CaseCorrection = {
  id: string; action: string; ownerEmployeeId: string; ownerName?: string | null; dueAtUtc: string; support?: string | null; recoveryMeasure: string; spendAmount?: number | null;
  policyException: boolean; status: CorrectionStatus; actionId?: string | null; actionStatus?: string | null; authorityNote?: string | null; instructionId?: string | null;
  instructionStatus?: string | null; verificationNote?: string | null; verifiedAtUtc?: string | null; verifiedByName?: string | null; version: string;
};
export type CaseDetail = CaseListItem & {
  departmentName?: string | null; summary: string; findingId?: string | null; targetId?: string | null; instructionId?: string | null; periodStart?: string | null;
  periodEnd?: string | null; expected?: number | null; actual?: number | null; dueAtUtc?: string | null; evidence: Evidence[]; dataLimitation?: string | null;
  dataResolvedAtUtc?: string | null; dataResolvedByName?: string | null; dataResolution?: string | null; causes?: string | null; mitigation?: string | null;
  priorBlockers?: string | null; proposedCorrection?: string | null; explainedAtUtc?: string | null; explainedByName?: string | null; nonResponseEscalatedAtUtc?: string | null;
  suggestion?: { responsibility: Responsibility; failureType: FailureType; dependencies: string[]; mitigationReasonable?: boolean | null; reasons: string[] } | null;
  failureType?: FailureType | null; dependencies: string[]; mitigationReasonable?: boolean | null; uncertainty?: string | null; assessmentNote?: string | null;
  assessedAtUtc?: string | null; assessedByName?: string | null; challengeByUtc?: string | null; challenge?: string | null; challengeEvidence?: string | null;
  challengedAtUtc?: string | null; reviewDecision?: ReviewDecision | null; reviewNote?: string | null; reviewedByName?: string | null; reviewedAtUtc?: string | null;
  previousCaseId?: string | null; escalatedAtUtc?: string | null; escalatedToName?: string | null; escalationReason?: string | null; recommendation?: string | null;
  outcome?: string | null; closedAtUtc?: string | null; closedByName?: string | null; openedByName: string; version: string; corrections: CaseCorrection[];
  decisions: { decision: PersonnelDecision; note: string; decidedByName: string; decidedAtUtc: string }[]; events: { event: string; note?: string | null; actorName: string; atUtc: string }[];
  canDo: string[];
};
export type ReviewEntryKind = "opening" | "question" | "answer" | "statement" | "evidence" | "correction" | "challenge" | "recognition" | "decision" | "note" | "escalation" | "humanReview" | "changes" | "timeline" | "demoRequest" | "decisionRecord";
export type ReviewClassification = "statement" | "verified" | "assumed" | "disputed" | "agreed";
export type CommitmentKind = "agreed" | "instruction";
export type CommitmentStatus = "proposed" | "confirmed" | "constrained" | "issued" | "completed" | "withdrawn";
export type ReviewRole = "accountable" | "contributor" | "observer";
export type ReviewEntry = {
  id: string; seq: number; kind: ReviewEntryKind; classification: ReviewClassification; byOfficer: boolean; authorName: string; authorEmployeeId?: string | null;
  audienceEmployeeId?: string | null; audienceName?: string | null; replyToId?: string | null; amendsEntryId?: string | null; subject?: string | null; text: string;
  evidence: Evidence[]; atUtc: string; classifiedByName?: string | null;
};
export type ReviewCommitment = {
  id: string; kind: CommitmentKind; status: CommitmentStatus; ownerEmployeeId: string; ownerName?: string | null; deliverable: string; dueAtUtc: string; originalDueAtUtc: string;
  dependencies?: string | null; requiredEvidence: string; constraint?: string | null; respondedAtUtc?: string | null;
  revisions: { from: string; to: string; reason: string; by: string; at: string }[]; actionId?: string | null; actionStatus?: string | null; instructionId?: string | null;
  instructionStatus?: string | null; awaitingResponse: boolean; version: string;
};
export type ReviewSummary = {
  version: number; atUtc: string; by: string; decisions: string[]; verifiedFacts: string[]; statements: string[]; assumptions: string[]; disputed: string[];
  commitments: string[]; openIssues: string[]; amendment?: string | null; responsibilities?: string[] | null; milestones?: string[] | null; decision?: string | null;
};
export type ReviewListItem = {
  id: string; reviewNo: string; kind: string; trigger: string; status: "open" | "concluded" | "cancelled"; branchId?: string | null; branchName?: string | null; title: string;
  openedAtUtc: string; participants: number; openCommitments: number; awaitingMe: number; escalated: boolean;
};
export type Review = {
  id: string; reviewNo: string; kind: string; trigger: string; status: ReviewListItem["status"]; tone: "standard" | "firm"; branchId?: string | null; branchName?: string | null;
  title: string; purpose: string; expectedOutcome: string; language: "en" | "am"; links: Evidence[]; facts: Evidence[]; factsAsOfUtc: string; previousReviewId?: string | null;
  escalatedAtUtc?: string | null; escalatedToName?: string | null; escalationReason?: string | null; openedByName: string; openedAtUtc: string; concludedAtUtc?: string | null;
  concludedByName?: string | null; retainUntilUtc?: string | null; redacted: boolean; version: string;
  participants: { employeeId: string; name?: string | null; role: ReviewRole; responsibility?: string | null; restricted: boolean; channel: string }[];
  entries: ReviewEntry[]; commitments: ReviewCommitment[]; summaries: ReviewSummary[]; facilitator: boolean; restricted: boolean; canDo: string[]; details: ReviewDetails;
};
export type ReviewKind = "operational" | "crossDepartment" | "implementation" | "decision";
export type DecisionOutcome = "approved" | "rejected" | "conditional" | "moreInformation";
export type MilestoneStage = "notStarted" | "developed" | "deployed" | "accepted" | "adopted";
export type MilestoneCategory = "deliverable" | "defect" | "training" | "configuration" | "businessDecision";
export type ChangeKind = "scope" | "budget" | "release";
export type ReviewOption = { id: string; label: string; description: string; expectedImpact: string; evidence?: string | null; value?: number | null; contractual: boolean; recommended: boolean };
export type ReviewMilestone = {
  id: string; category: MilestoneCategory; title: string; ownerEmployeeId: string; ownerName?: string | null; dueAtUtc: string; dependencies?: string | null; acceptanceEvidence: string;
  targetStage: MilestoneStage; claimedStage: MilestoneStage; verifiedStage: MilestoneStage; claimedAtUtc?: string | null; claimNote?: string | null;
  verifications: { stage: MilestoneStage; evidence: string; by: string; at: string }[]; awaitingProof: boolean; overdue: boolean; version: string;
};
export type ReviewChange = {
  id: string; kind: ChangeKind; description: string; reason: string; value?: number | null; actionId?: string | null; actionStatus?: string | null; requestedByName: string; requestedAtUtc: string;
};
export type ReviewDetails = {
  decisionMakerEmployeeId?: string | null; decisionMakerName?: string | null; decisionDueUtc?: string | null; decisionOutcome?: DecisionOutcome | null; decidedOptionId?: string | null;
  decisionNote?: string | null; decidedAtUtc?: string | null; decidedByName?: string | null; contractActionId?: string | null; contractStatus?: string | null;
  externalParties?: string | null; externalChannel?: string | null; externalAuthorizedByName?: string | null; externalAuthorizedAtUtc?: string | null;
  options: ReviewOption[]; milestones: ReviewMilestone[]; changes: ReviewChange[]; departments: Record<string, string>; canDo: string[];
};
export type ReviewOptionInput = { label: string; description?: string; expectedImpact: string; evidence?: string; value?: number | null; contractual: boolean; recommended: boolean };
export type ReviewOpenInput = {
  kind: ReviewKind; trigger: "request"; decisionMakerEmployeeId?: string | null; decisionDueUtc?: string | null; options?: ReviewOptionInput[]; branchId: string; title: string; purpose: string; expectedOutcome: string; language: "en" | "am";
  links: { type: string; id: string }[]; participants: { employeeId: string; role: ReviewRole; responsibility?: string; restricted: boolean }[];
};

export type ScoreItem = { type: string; id?: string | null; label: string; dueAtUtc?: string | null; result: string; met?: boolean | null };
export type ScoreComponent = { key: string; label: string; weight: number; met: number; counted: number; score?: number | null; rated: boolean; rule: string; items: ScoreItem[]; notes: string[] };
export type Scorecard = {
  branchId: string; branchName?: string | null; departmentId?: string | null; departmentName?: string | null; subjectEmployeeId?: string | null; subjectName?: string | null;
  from: string; to: string; overall?: number | null; withheld: boolean; withheldReason?: string | null; disputes: number; components: ScoreComponent[]; context: string[];
  calculation: string; calculatedAtUtc: string;
};

export type DayMetric = { targetId?: string | null; name: string; calculation: string; unit: string; target?: number | null; actual?: number | null;
  from: string; to: string; status: string; dataAsOfUtc?: string | null; guidance: string[]; evidence: Evidence[] };
export type BranchDay = { id: string; branchId: string; branchName?: string | null; managerEmployeeId?: string | null; managerName?: string | null;
  businessDate: string; openedAtUtc: string; planDueAtUtc: string; explanationDueAtUtc: string; status: string; late: boolean; planId?: string | null; submittedAtUtc?: string | null;
  salesPlan: string; foodCostPlan: string; wastePlan: string; staffingPlan: string; validation: string[]; yesterday: DayMetric[]; today: DayMetric[];
  explanationRequired: boolean; explanation?: string | null; correctivePlan?: string | null; correctionDueAtUtc?: string | null;
  correctionActionId?: string | null; correctionStatus?: string | null; canSubmit: boolean; canRespond: boolean; version: string };
export type DailyCycle = { enabled: boolean; timeZone: string; opensAt: string; plansDueAt: string; today: string; branches: BranchDay[] };

const base = (c: string) => `/companies/${c}/operations-officer`;
const list = <T,>(data: unknown) => (Array.isArray(data) ? (data as T[]) : []);

export const officerApi = {
  dailyCycle: (c: string, date?: string) => http.get<DailyCycle>(`${base(c)}/daily-cycle`, { params: { date } }).then(r => r.data),
  setDailyCycle: (c: string, enabled: boolean) => http.put(`${base(c)}/daily-cycle/settings`, { enabled }),
  runDailyCycle: (c: string) => http.post(`${base(c)}/daily-cycle/run`),
  submitDailyPlan: (c: string, id: string, input: { planId: string; planVersion: string; salesPlan: string; foodCostPlan: string; wastePlan: string; staffingPlan: string; version: string }) =>
    http.post(`${base(c)}/daily-cycle/${id}/submit`, input),
  respondDailyCycle: (c: string, id: string, input: { explanation: string; correctivePlan: string; dueAtUtc: string; version: string }) =>
    http.post(`${base(c)}/daily-cycle/${id}/respond`, input),
  references: (c: string) => http.get<References>(`${base(c)}/references`).then((r) => r.data),
  settings: (c: string) => http.get<Settings>(`${base(c)}/settings`).then((r) => r.data),
  saveSettings: (c: string, s: SettingsInput) => http.put(`${base(c)}/settings`, s),
  pause: (c: string, reason: string) => http.post(`${base(c)}/pause`, { reason }),
  resume: (c: string, reason?: string) => http.post(`${base(c)}/resume`, { reason }),
  scopes: (c: string, history = false) => http.get(`${base(c)}/scopes`, { params: { history } }).then((r) => list<Scope>(r.data)),
  saveScope: (c: string, input: ScopeInput) => http.post<{ id: string }>(`${base(c)}/scopes`, input).then((r) => r.data),
  configurationIssues: (c: string) => http.get(`${base(c)}/configuration-issues`).then((r) => list<ConfigurationIssue>(r.data)),
  policies: (c: string, history = false) => http.get(`${base(c)}/policies`, { params: { history } }).then((r) => list<Policy>(r.data)),
  savePolicy: (c: string, id: string | null, input: PolicyInput) =>
    (id ? http.put<{ id: string }>(`${base(c)}/policies/${id}`, input) : http.post<{ id: string }>(`${base(c)}/policies`, input)).then((r) => r.data),
  retirePolicy: (c: string, id: string, reason: string) => http.post(`${base(c)}/policies/${id}/retire`, { reason }),

  targets: (c: string, history = false, branchId?: string) => http.get(`${base(c)}/targets`, { params: { history, branchId } }).then((r) => list<Target>(r.data)),
  targetVersions: (c: string, groupId: string) => http.get(`${base(c)}/targets/groups/${groupId}`).then((r) => list<Target>(r.data)),
  createTarget: (c: string, input: TargetInput) => http.post<{ id: string }>(`${base(c)}/targets`, input).then((r) => r.data),
  updateTarget: (c: string, id: string, input: TargetInput) => http.put(`${base(c)}/targets/${id}`, input),
  deleteTarget: (c: string, id: string) => http.delete(`${base(c)}/targets/${id}`),
  amendTarget: (c: string, id: string, input: TargetInput) => http.post<{ id: string }>(`${base(c)}/targets/${id}/amend`, input).then((r) => r.data),
  submitTarget: (c: string, id: string, version?: string) => http.post(`${base(c)}/targets/${id}/submit`, { version }),
  approveTarget: (c: string, id: string, reason?: string, version?: string) => http.post(`${base(c)}/targets/${id}/approve`, { reason, version }),
  rejectTarget: (c: string, id: string, reason: string, version?: string) => http.post(`${base(c)}/targets/${id}/reject`, { reason, version }),
  retireTarget: (c: string, id: string, reason: string, version?: string) => http.post(`${base(c)}/targets/${id}/retire`, { reason, version }),
  raiseConcern: (c: string, id: string, text: string) => http.post(`${base(c)}/targets/${id}/concerns`, { text }),
  respondConcern: (c: string, id: string, text: string) => http.post(`${base(c)}/concerns/${id}/respond`, { text }),

  runMonitor: (c: string) => http.post<MonitorResult>(`${base(c)}/monitor/run`).then((r) => r.data),
  findings: (c: string, q: { status?: FindingStatus[]; kind?: FindingKind[]; minSeverity?: Severity; branchId?: string }) =>
    http.get(`${base(c)}/findings`, { params: q, paramsSerializer: { indexes: null } }).then((r) => list<Finding>(r.data)),
  finding: (c: string, id: string) => http.get<Finding>(`${base(c)}/findings/${id}`).then((r) => r.data),
  acknowledge: (c: string, id: string, version?: string) => http.post(`${base(c)}/findings/${id}/acknowledge`, { version }),
  resolve: (c: string, id: string, reason: string, version?: string) => http.post(`${base(c)}/findings/${id}/resolve`, { reason, version }),
  dismiss: (c: string, id: string, reason: string, version?: string) => http.post(`${base(c)}/findings/${id}/dismiss`, { reason, version }),
  assign: (c: string, id: string, employeeId: string, version?: string) => http.post(`${base(c)}/findings/${id}/assign`, { employeeId, version }),

  briefing: (c: string, branchId?: string) => http.get<Briefing>(`${base(c)}/briefing`, { params: { branchId } }).then((r) => r.data),
  liveBriefing: (c: string, branchId?: string) => http.get<Briefing>(`${base(c)}/briefing/live`, { params: { branchId } }).then((r) => r.data),
  prepareBriefing: (c: string, branchId?: string) => http.post<Briefing>(`${base(c)}/briefing/prepare`, null, { params: { branchId } }).then((r) => r.data),
  briefings: (c: string, branchId?: string, days = 30) => http.get(`${base(c)}/briefings`, { params: { branchId, days } }).then((r) => list<BriefingListItem>(r.data)),
  storedBriefing: (c: string, id: string) => http.get<Briefing>(`${base(c)}/briefings/${id}`).then((r) => r.data),

  actions: (c: string, q: { status?: ActionStatus[]; branchId?: string; take?: number }) =>
    http.get(`${base(c)}/actions`, { params: q, paramsSerializer: { indexes: null } }).then((r) => list<OfficerAction>(r.data)),
  action: (c: string, id: string) => http.get<{ action: OfficerAction; attempts: Attempt[] }>(`${base(c)}/actions/${id}`).then((r) => r.data),
  requestAction: (c: string, input: { actionType: string; branchId?: string | null; reason?: string; findingId?: string | null; employeeId?: string | null; clientRequestId: string }) =>
    http.post<OfficerAction>(`${base(c)}/actions`, input).then((r) => r.data),
  approveAction: (c: string, id: string, reason?: string, version?: string) => http.post<OfficerAction>(`${base(c)}/actions/${id}/approve`, { reason, version }).then((r) => r.data),
  rejectAction: (c: string, id: string, reason: string, version?: string) => http.post<OfficerAction>(`${base(c)}/actions/${id}/reject`, { reason, version }).then((r) => r.data),
  completeAction: (c: string, id: string, reference: string, version?: string) => http.post<OfficerAction>(`${base(c)}/actions/${id}/complete`, { reference, version }).then((r) => r.data),
  retryAction: (c: string, id: string, version?: string) => http.post<OfficerAction>(`${base(c)}/actions/${id}/retry`, { version }).then((r) => r.data),
  subscription: (c: string) => http.get<Subscription>(`${base(c)}/subscription`).then((r) => r.data),
  subscribe: (c: string, input: SubscribeInput) => http.post(`${base(c)}/subscription`, input),
  setSubscriptionBranches: (c: string, branchIds: string[]) => http.put(`${base(c)}/subscription/branches`, { branchIds }),
  setOverage: (c: string, authorize: boolean, budgetUnits: number | null, acceptCharges: boolean) => http.post(`${base(c)}/subscription/overage`, { authorize, budgetUnits, acceptCharges }),
  suspendSubscription: (c: string, reason: string) => http.post(`${base(c)}/subscription/suspend`, { reason }),
  cancelSubscription: (c: string, reason: string) => http.post(`${base(c)}/subscription/cancel`, { reason }),
  pendingWork: (c: string) => http.get(`${base(c)}/pending-work`).then((r) => list<OfficerAction>(r.data)),
  audit: (c: string, q: { entityType?: string; entityId?: string; take?: number }) => http.get(`${base(c)}/audit`, { params: q }).then((r) => list<AuditEntry>(r.data)),

  myInstructionChanges: (c: string) => http.get(`${base(c)}/instructions/mine/changes`).then((r) => list<InstructionChange>(r.data)),
  planChanges: (c: string, id: string) => http.get<PlanChanges>(`${base(c)}/plans/${id}/changes`).then((r) => r.data),
  myInstructions: (c: string, open = true) => http.get(`${base(c)}/instructions/mine`, { params: { open } }).then((r) => list<Instruction>(r.data)),
  teamInstructions: (c: string, open = true, branchId?: string) => http.get(`${base(c)}/instructions`, { params: { open, branchId } }).then((r) => list<Instruction>(r.data)),
  instruction: (c: string, id: string) => http.get<Instruction>(`${base(c)}/instructions/${id}`).then((r) => r.data),
  requestInstruction: (c: string, input: InstructionInput) => http.post<OfficerAction>(`${base(c)}/instructions`, input).then((r) => r.data),
  acknowledgeInstruction: (c: string, id: string, version?: string) => http.post<Instruction>(`${base(c)}/instructions/${id}/acknowledge`, { version }).then((r) => r.data),
  progressInstruction: (c: string, id: string, percent: number, note: string, version?: string) =>
    http.post<Instruction>(`${base(c)}/instructions/${id}/progress`, { percent, note, version }).then((r) => r.data),
  submitEvidence: (c: string, id: string, evidence: string, reference: string, version?: string) =>
    http.post<Instruction>(`${base(c)}/instructions/${id}/evidence`, { evidence, reference, version }).then((r) => r.data),
  reviewInstruction: (c: string, id: string, accept: boolean, note: string, version?: string) =>
    http.post<Instruction>(`${base(c)}/instructions/${id}/review`, { accept, note, version }).then((r) => r.data),
  reassignInstruction: (c: string, id: string, employeeId: string, reason: string, version?: string) =>
    http.post<Instruction>(`${base(c)}/instructions/${id}/reassign`, { employeeId, reason, version }).then((r) => r.data),
  cancelInstruction: (c: string, id: string, reason: string, version?: string) => http.post<Instruction>(`${base(c)}/instructions/${id}/cancel`, { reason, version }).then((r) => r.data),
  reportBlocker: (c: string, id: string, input: { cause: string; impact?: string; evidence?: string; assistanceRequired?: string }) =>
    http.post<Instruction>(`${base(c)}/instructions/${id}/blockers`, input).then((r) => r.data),
  resolveBlocker: (c: string, id: string, resolution: string) => http.post(`${base(c)}/blockers/${id}/resolve`, { resolution }),
  requestException: (c: string, id: string, input: { newDueAtUtc?: string | null; waive: boolean; reason: string }) =>
    http.post<Instruction>(`${base(c)}/instructions/${id}/exceptions`, input).then((r) => r.data),
  decideException: (c: string, id: string, approve: boolean, note?: string) => http.post(`${base(c)}/exceptions/${id}/decide`, { approve, note }),

  plans: (c: string, branchId?: string, current = false) => http.get(`${base(c)}/plans`, { params: { branchId, current } }).then((r) => list<PlanListItem>(r.data)),
  plan: (c: string, id: string) => http.get<Plan>(`${base(c)}/plans/${id}`).then((r) => r.data),
  prepareDailyPlan: (c: string, branchId: string, businessDate?: string | null, revisionReason?: string | null) =>
    http.post<Plan>(`${base(c)}/plans/daily`, { branchId, businessDate: businessDate || null, revisionReason: revisionReason || null }).then((r) => r.data),
  productionRequirements: (c: string, branchId: string, date?: string | null) =>
    http.get<ProductionRequirements>(`${base(c)}/production/requirements`, { params: { branchId, date: date || undefined } }).then((r) => r.data),
  prepareProductionPlan: (c: string, branchId: string, businessDate?: string | null, revisionReason?: string | null) =>
    http.post<Plan>(`${base(c)}/plans/production`, { branchId, businessDate: businessDate || null, revisionReason: revisionReason || null }).then((r) => r.data),
  prepareEventPlan: (c: string, cateringEventId: string, revisionReason?: string | null) =>
    http.post<Plan>(`${base(c)}/plans/event`, { cateringEventId, revisionReason: revisionReason || null }).then((r) => r.data),
  updateActivity: (c: string, planId: string, activityId: string, input: { ownerEmployeeId?: string | null; dueAtUtc?: string | null; title?: string | null; detail?: string | null; version?: string }) =>
    http.put<Plan>(`${base(c)}/plans/${planId}/activities/${activityId}`, input).then((r) => r.data),
  addActivity: (c: string, planId: string, input: { title: string; detail?: string | null; departmentId?: string | null; ownerEmployeeId?: string | null; dueAtUtc: string; completionCriteria: string; version?: string }) =>
    http.post<Plan>(`${base(c)}/plans/${planId}/activities`, input).then((r) => r.data),
  removeActivity: (c: string, planId: string, activityId: string, version?: string) =>
    http.post<Plan>(`${base(c)}/plans/${planId}/activities/${activityId}/remove`, { version }).then((r) => r.data),
  activatePlan: (c: string, id: string, version?: string) => http.post<Plan>(`${base(c)}/plans/${id}/activate`, { version }).then((r) => r.data),
  cancelPlan: (c: string, id: string, reason: string, version?: string) => http.post(`${base(c)}/plans/${id}/cancel`, { reason, version }),

  replenishmentReview: (c: string, branchId: string) => http.get<ReplenishmentReview>(`${base(c)}/stock/replenishment`, { params: { branchId } }).then((r) => r.data),
  proposeReplenishment: (c: string, input: { branchId: string; destinations: ReplenishDestination[]; reason?: string | null; clientRequestId: string }) =>
    http.post<OfficerAction>(`${base(c)}/stock/replenishment`, input).then((r) => r.data),
  proposeTransfer: (c: string, input: { fromBranchId: string; fromLocationId: string; toBranchId: string; toLocationId: string; itemId: string; baseQty: number; reason?: string | null }) =>
    http.post<OfficerAction>(`${base(c)}/stock/transfers`, input).then((r) => r.data),
  requestCount: (c: string, input: { branchId: string; locationId: string; ownerEmployeeId?: string | null; dueAtUtc: string; itemIds?: string[] | null; reason?: string | null; clientRequestId: string }) =>
    http.post<OfficerAction>(`${base(c)}/stock/counts`, input).then((r) => r.data),

  requirements: (c: string, branchId?: string) => http.get<Requirements>(`${base(c)}/purchasing/requirements`, { params: { branchId } }).then((r) => r.data),
  proposeRequisition: (c: string, input: { branchId: string; locationId: string; itemId: string; supplierId?: string | null; baseQty: number; estimatedUnitPrice: number; reason?: string | null }) =>
    http.post<OfficerAction>(`${base(c)}/purchasing/requisitions`, input).then((r) => r.data),
  proposeConsolidation: (c: string, input: { supplierId: string; mode: "Direct" | "Central"; centralBranchId?: string | null; centralLocationId?: string | null; expectedDate: string;
    reason?: string | null; lines: { requisitionLineId: string; quantity: number; unitPrice?: number | null }[]; clientRequestId: string }) =>
    http.post<OfficerAction>(`${base(c)}/purchasing/consolidations`, input).then((r) => r.data),
  quotationRequests: (c: string) => http.get(`${base(c)}/purchasing/quotations`).then((r) => list<QuotationRequestSummary>(r.data)),
  comparison: (c: string, id: string) => http.get<Comparison>(`${base(c)}/purchasing/quotations/${id}/comparison`).then((r) => r.data),
  proposeAward: (c: string, id: string, input: { lines: { quoteId: string; requisitionLineId: string; quantity: number }[]; overrideReason?: string | null; clientRequestId: string }) =>
    http.post<OfficerAction>(`${base(c)}/purchasing/quotations/${id}/award`, input).then((r) => r.data),

  ask: (c: string, input: { question: string; branchId?: string | null; threadId?: string | null; language?: string | null }) =>
    http.post<OfficerAnswer>(`${base(c)}/ask`, input).then((r) => r.data),
  cases: (c: string, q: { mine?: boolean; open?: boolean; branchId?: string }) => http.get(`${base(c)}/cases`, { params: q }).then((r) => list<CaseListItem>(r.data)),
  caseDetail: (c: string, id: string) => http.get<CaseDetail>(`${base(c)}/cases/${id}`).then((r) => r.data),
  openCase: (c: string, input: { findingId?: string | null; instructionId?: string | null }) => http.post<CaseDetail>(`${base(c)}/cases`, input).then((r) => r.data),
  caseStep: (c: string, id: string, step: string, body: Record<string, unknown>) => http.post<CaseDetail>(`${base(c)}/cases/${id}/${step}`, body).then((r) => r.data),
  acceptCase: (c: string, id: string, version: string) => http.post<CaseDetail>(`${base(c)}/cases/${id}/accept`, null, { params: { version } }).then((r) => r.data),
  verifyCorrection: (c: string, id: string, correctionId: string, body: { effective: boolean; note: string; version: string }) =>
    http.post<CaseDetail>(`${base(c)}/cases/${id}/corrections/${correctionId}/verify`, body).then((r) => r.data),
  reviews: (c: string, q: { mine: boolean; open: boolean }) => http.get(`${base(c)}/reviews`, { params: q }).then((r) => list<ReviewListItem>(r.data)),
  review: (c: string, id: string) => http.get<Review>(`${base(c)}/reviews/${id}`).then((r) => r.data),
  openReview: (c: string, input: ReviewOpenInput) => http.post<Review>(`${base(c)}/reviews`, input).then((r) => r.data),
  reviewStep: (c: string, id: string, path: string, body?: Record<string, unknown>) => http.post<Review>(`${base(c)}/reviews/${id}/${path}`, body ?? {}).then((r) => r.data),
  scorecards: (c: string, q: { from?: string; to?: string; branchId?: string }) => http.get(`${base(c)}/scorecards`, { params: q }).then((r) => list<Scorecard>(r.data)),
  conversation: (c: string, threadId?: string) => http.get(`${base(c)}/conversation`, { params: { threadId } }).then((r) => list<OfficerMessage>(r.data)),
};
