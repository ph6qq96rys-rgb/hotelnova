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
};
export type SettingsInput = Omit<Settings, "automationPaused" | "pausedAtUtc" | "pausedByName" | "pauseReason" | "policyVersion" | "lastMonitoredAtUtc" | "lastBriefingAtUtc" | "narrativeAvailable">;

export type Scope = {
  id: string; level: ScopeLevel; branchId: string; branchName: string; departmentId?: string | null; departmentName?: string | null; stockLocationId?: string | null;
  stockLocationName?: string | null; isManaged: boolean; responsibleEmployeeId?: string | null; responsibleName?: string | null; escalationEmployeeId?: string | null;
  escalationName?: string | null; effectiveFrom: string; effectiveTo?: string | null; notes?: string | null; createdByName: string; createdAtUtc: string; version: string;
};
export type ScopeInput = {
  branchId: string; departmentId?: string | null; stockLocationId?: string | null; isManaged: boolean; responsibleEmployeeId?: string | null;
  escalationEmployeeId?: string | null; effectiveFrom?: string | null; notes?: string | null;
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
};
export type BriefingListItem = { id: string; branchId?: string | null; businessDate: string; generatedAtUtc: string; modelVersion?: string | null };
export type AuditEntry = { id: string; entityType: string; entityId: string; event: string; detailJson?: string | null; actorName: string; policyVersion: number; atUtc: string };
export type MonitorResult = { detected: number; opened: number; updated: number; resolved: number; targetsChecked: number; actionsProposed: number };

const base = (c: string) => `/companies/${c}/operations-officer`;
const list = <T,>(data: unknown) => (Array.isArray(data) ? (data as T[]) : []);

export const officerApi = {
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
  audit: (c: string, q: { entityType?: string; entityId?: string; take?: number }) => http.get(`${base(c)}/audit`, { params: q }).then((r) => list<AuditEntry>(r.data)),
};
