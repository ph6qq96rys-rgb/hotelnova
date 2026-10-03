// src/features/hr/types/index.ts

// Shared

export type Gender         = 'Male' | 'Female' | 'Other';
export type MaritalStatus  = 'Single' | 'Married' | 'Divorced' | 'Widowed';
export type EmploymentType = 'FullTime' | 'PartTime' | 'Contract' | 'Intern' | 'Casual';
export type EmploymentStatus = 'Probation' | 'Active' | 'Suspended' | 'OnLeave' | 'Terminated';
export type PayFrequency   = 'Monthly' | 'BiWeekly' | 'Weekly';
export type WorkSchedule   = 'Standard' | 'Shift' | 'Flexible' | 'Remote' | 'Hybrid';
export type PositionLevel  = 'EntryLevel' | 'Junior' | 'MidLevel' | 'Senior' | 'Lead' | 'Manager' | 'Director' | 'VicePresident' | 'CLevel';

// Employees

export interface EmployeeListDto {
  id: string;
  employeeNo: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  status: EmploymentStatus;
  employmentType: EmploymentType;
  hireDate: string;
  workEmail: string;
}

export interface EmployeeDetailDto {
  id: string;
  employeeNo: string;
  employeeCode?: string | null;
  fullName: string;
  firstName?: string | null;
  fatherName?: string | null;
  grandFatherName?: string | null;
  preferredName?: string | null;
  gender: Gender | string | null;
  dateOfBirth: string;
  maritalStatus: MaritalStatus | string | null;
  nationality?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  departmentId?: string | null;
  departmentName: string;
  positionId?: string | null;
  positionTitle: string;
  managerId?: string | null;
  managerName?: string | null;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  hireDate: string;
  confirmationDate?: string | null;
  terminationDate?: string | null;
  terminationReason?: string | null;
  basicSalary: number;
  payFrequency?: PayFrequency | string | null;
  workSchedule?: WorkSchedule | string | null;
  workEmail: string;
  personalEmail?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  city?: string | null;
  nationalId?: string | null;
  taxId?: string | null;
  tinNumber?: string | null;
  tin?: string | null;
  pensionId?: string | null;
  businessLicenseNo?: string | null;
  businessLicenceNo?: string | null;
  businessLicenseNumber?: string | null;
  vatNumber?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankBranch?: string | null;
  yearsOfService: number | string | null;
  employeePhotoUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  hasSystemAccess?: boolean | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  telegramChatId?: string | null;
  telegramUserName?: string | null;
  telegramLinkedAtUtc?: string | null;
}

export interface EmployeeDocumentDto {
  id: string;
  employeeId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  expiryDate?: string | null;
  uploadedAt: string;
  uploadedBy: string;
}

export interface OrgChartNodeDto {
  id: string;
  fullName: string;
  positionTitle: string;
  departmentName: string;
  photoUrl?: string;
  managerId?: string;
  directReports: OrgChartNodeDto[];
}

export interface Department {
  id: string;
  code: string;
  name: string;
  parentDepartmentId?: string;
  isActive: boolean;
}

export interface Position {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  level: PositionLevel;
  minSalary?: number;
  maxSalary?: number;
  isActive: boolean;
}

// Payroll

export type PayrollRunStatus = 'Draft' | 'Processing' | 'Pending' | 'Approved' | 'Paid' | 'Cancelled';
export type PaySlipStatus    = 'Draft' | 'Generated' | 'Approved' | 'Paid';

export interface PayrollRunDto {
  id: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdAt: string;
}

export interface PaySlipDetailDto {
  id: string;
  employeeNo: string;
  employeeName: string;
  periodName: string;
  tinNumber?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankBranch?: string | null;
  basicSalary: number;
  totalAllowances: number;
  overtimePay: number;
  bonusPay: number;
  grossPay: number;
  incomeTax: number;
  employeePension: number;
  employerPension: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  daysWorked: number;
  workingDays: number;
  status: PaySlipStatus;
  lines: PaySlipLineDto[];
}

export interface PaySlipLineDto {
  type: string;
  description: string;
  amount: number;
}

export interface PaySlipSummaryDto {
  id: string;
  periodName: string;
  employeeNo?: string | null;
  employeeName?: string | null;
  grossPay: number;
  netPay: number;
  status: PaySlipStatus;
}

// Leave

export type LeaveRequestStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Taken';
export type LeaveCategory      = 'Annual' | 'Sick' | 'Maternity' | 'Paternity' | 'Bereavement' | 'Study' | 'Unpaid' | 'Compensatory' | 'Other';
export type HalfDayPeriod      = 'Morning' | 'Afternoon';

export interface LeaveTypeDto {
  id: string;
  code: string;
  name: string;
  category: LeaveCategory;
  defaultDaysPerYear: number;
  maxCarryForwardDays: number;
  requiresApproval: boolean;
  requiresDocument: boolean;
  isPaid: boolean;
  allowNegativeBalance: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number;
}

export interface LeaveRequestDto {
  id: string;
  requestNo: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  status: LeaveRequestStatus;
  reason: string;
  createdAt: string;
}

export interface LeaveBalanceDto {
  entitled: number;
  taken: number;
  balance: number;
  carryForward: null;
  leaveTypeId: string;
  leaveTypeName: string;
  entitlement: number;
  used: number;
  pending: number;
  available: number;
  carriedForward: number;
}

export interface LeaveCalendarEntryDto {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveTypeName: string;
  status: LeaveRequestStatus;
}

// Attendance

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'OnLeave' | 'Holiday' | 'WeekOff' | 'EarlyDeparture' | 'MissingPunch' | 'ApprovedException';
export type ClockMethod      = 'Manual' | 'Biometric' | 'Mobile' | 'Card' | 'Web';
export type OvertimeStatus   = 'Pending' | 'Approved' | 'Rejected' | 'Processed';
export type OvertimeCategory =
  | 'Planned'
  | 'Emergency'
  | 'PeakOperations'
  | 'CustomerDemand'
  | 'ProductionDelay'
  | 'EquipmentFailure'
  | 'InventoryCount'
  | 'MonthEndClosing'
  | 'EventSupport'
  | 'Catering'
  | 'SpecialProject';
export type OvertimeEffectiveness = 'Necessary' | 'Useful' | 'Avoidable' | 'Wasteful';

export interface AttendanceRecordDto {
  clockInSource?: string | null;
  clockOutSource?: string | null;
  isManualEntry?: boolean;
  regularHours?: number | null;
  earlyLeaveMinutes?: number | null;
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  workedHours?: number;
  overtimeHours?: number;
  overtimeStatus?: OvertimeStatus;
  overtimeCategory?: OvertimeCategory | string | null;
  overtimeBusinessJustification?: string | null;
  overtimeRelatedTask?: string | null;
  overtimeProject?: string | null;
  overtimeCostCenter?: string | null;
  overtimeExpectedOutput?: string | null;
  overtimeActualOutput?: string | null;
  overtimeEffectivenessRating?: number | null;
  overtimeEffectiveness?: OvertimeEffectiveness | string | null;
  overtimeLaborCost?: number | null;
  approvalRequired?: boolean;
  managerApproved?: boolean;
  hrApproved?: boolean;
  clockMethod?: ClockMethod;
  deviceId?: string | null;
  branchVerified?: boolean | null;
  geofenceVerified?: boolean | null;
  lateMinutes?: number;
  status: AttendanceStatus;
}

export interface AttendanceReportDto {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeave: number;
  averageAttendancePercent: number;
  records: AttendanceRecordDto[];
}

export interface AttendancePolicyDto {
  id: string;
  companyId: string;
  branchId?: string | null;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  timeZoneId: string;
  standardDailyHours: number;
  mealBreakMinutes: number;
  deductMealBreakAutomatically: boolean;
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  overtimeThresholdHours: number;
  requiresOvertimeApproval: boolean;
  overtimeApprovalThresholdHours: number;
  overtimeRate: number;
  duplicateScanGuardMinutes: number;
  allowManualEntry: boolean;
  requiresManualEntryApproval: boolean;
  requireQrClocking: boolean;
  shiftPatternName?: string | null;
  rosterGroupName?: string | null;
  attendanceDeviceName?: string | null;
  latePolicyName?: string | null;
  overtimePolicyName?: string | null;
  holidayCalendarName?: string | null;
  mealBreakRuleName?: string | null;
}

export interface ShiftDto {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  workingHours: number;
  isNightShift: boolean;
}

export interface OvertimeRequestDto {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  rate: number;
  reason: string;
  status: OvertimeStatus;
  createdAt: string;
}

// Recruitment

export type JobPostingStatus  = 'Draft' | 'PendingApproval' | 'Published' | 'Closed' | 'OnHold' | 'Cancelled';
export type ApplicationStatus = 'New' | 'Screening' | 'Shortlisted' | 'Interview' | 'Assessment' | 'Offered' | 'Hired' | 'Rejected' | 'Withdrawn';
export type InterviewType     = 'Phone' | 'Video' | 'InPerson' | 'Panel' | 'Technical' | 'HR';
export type InterviewStatus   = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow' | 'Rescheduled';
export type OfferStatus       = 'Draft' | 'Issued' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Expired';
export type ApplicationSource = 'Direct' | 'Referral' | 'LinkedIn' | 'JobBoard' | 'Agency' | 'Walk_In';

export interface JobPostingDto {
  id: string;
  postingNo: string;
  title: string;
  departmentName: string;
  positionTitle: string;
  vacancyCount: number;
  closingDate: string;
  status: JobPostingStatus;
  applicationCount: number;
  employmentType: EmploymentType;
  minSalary?: number;
  maxSalary?: number;
}

export interface JobApplicationDto {
  id: string;
  applicationNo: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  appliedOn: string;
  status: ApplicationStatus;
  appliedAt: string;
  screeningScore?: number;
  isInternal: boolean;
  source: ApplicationSource;

}

export interface RecruitmentPipelineDto {
  new: number;
  screening: number;
  shortlisted: number;
  interview: number;
  offered: number;
  hired: number;
  rejected: number;
}

export interface InterviewDto {
  id: string;
  round: number;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes: number;
  location?: string;
  meetingLink?: string;
  status: InterviewStatus;
  score?: number;
}

// Performance

export type CycleType         = 'Annual' | 'SemiAnnual' | 'Quarterly' | 'Probation' | 'PIP';
export type CycleStatus       = 'Draft' | 'Active' | 'Closed' | 'Archived';
export type ReviewStatus      = 'NotStarted' | 'SelfReview' | 'ManagerReview' | 'Calibration' | 'Completed';
export type PerformanceRating = 'Exceptional' | 'ExceedsExpectations' | 'MeetsExpectations' | 'NeedsImprovement' | 'Unsatisfactory';
export type GoalStatus        = 'Draft' | 'Active' | 'OnTrack' | 'AtRisk' | 'Achieved' | 'NotAchieved' | 'Cancelled';
export type GoalCategory      = 'Individual' | 'Team' | 'Department' | 'Company';

export interface PerformanceCycleDto {
  id: string;
  name: string;
  type: CycleType;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  totalReviews: number;
  completedReviews: number;
}

export interface PerformanceReviewDetailDto {
  cycleId: any;
  reviewerName: string;
  selfScore: null;
  managerScore: null;
  reviewDate: import("react/jsx-runtime").JSX.Element;
  selfComments: import("react/jsx-runtime").JSX.Element;
  managerComments: import("react/jsx-runtime").JSX.Element;
  overallScore: null;
  id: string;
  employeeName: string;
  cycleName: string;
  status: ReviewStatus;
  selfRating?: number;
  managerRating?: number;
  finalRating?: number;
  ratingLabel?: PerformanceRating;
  selfSummary?: string;
  managerSummary?: string;
  goals: GoalReviewResultDto[];
  competencies: CompetencyReviewResultDto[];
  developmentPlans: DevelopmentPlanResultDto[];
}

export interface GoalReviewResultDto {
  goalTitle: string;
  weight: number;
  selfAchievement?: number;
  managerAchievement?: number;
  finalScore?: number;
}

export interface CompetencyReviewResultDto {
  competencyName: string;
  type: string;
  selfRating?: number;
  managerRating?: number;
  finalRating?: number;
}

export interface DevelopmentPlanResultDto {
  area: string;
  action: string;
  targetDate: string;
  status: string;
}

export interface GoalDto {
  id: string;
  title: string;
  category: GoalCategory;
  weight: number;
  targetValue: number;
  actualValue?: number;
  unit?: string;
  dueDate: string;
  status: GoalStatus;
  achievementPercent?: number;
}

// Training

export type TrainingCategory  = 'Onboarding' | 'Compliance' | 'TechnicalSkills' | 'SoftSkills' | 'Leadership' | 'Safety' | 'ProductKnowledge' | 'Other';
export type TrainingMode      = 'InPerson' | 'Online' | 'Blended' | 'OnTheJob' | 'External';
export type SessionStatus     = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled' | 'Postponed';
export type EnrollmentStatus  = 'Enrolled' | 'WaitListed' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled' | 'NoShow';
export type EnrollmentType    = 'Self' | 'Nominated' | 'Mandatory';

export interface TrainingProgramDto {
  id: string;
  code: string;
  title: string;
  category: TrainingCategory;
  mode: TrainingMode;
  durationHours: number;
  isMandatory: boolean;
  cost?: number;
  provider?: string;
  upcomingSessions: number;
}

export interface TrainingSessionDto {
  id: string;
  sessionNo: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  meetingLink?: string;
  trainerName?: string;
  maxEnrollment: number;
  enrolledCount: number;
  status: SessionStatus;
}

export interface MyTrainingDto {
  enrollmentId: string;
  programTitle: string;
  sessionNo: string;
  startDate: string;
  endDate: string;
  status: EnrollmentStatus;
  score?: number;
  passed?: boolean;
  certificateUrl?: string;
}

export interface TrainingComplianceDto {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  mandatoryRequired: number;
  mandatoryCompleted: number;
  compliancePercent: number;
}

// Dashboard

export interface HRDashboardDto {
  totalEmployees: number;
  activeEmployees: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
  openPositions: number;
  pendingLeaveRequests: number;
  pendingOvertimeRequests: number;
  upcomingReviews: number;
  trainingsDue: number;
  averageAttendancePercent: number;
  headcountByDept: { departmentName: string; count: number }[];
  leaveStatusSummary: { leaveType: string; onLeaveToday: number }[];
}
export interface DepartmentDto {
  id:                   string;
  code:                 string;
  name:                 string;
  parentDepartmentId?:  string | null;
  parentDepartmentName?: string | null;
}

export interface PositionDto {
  id:             string;
  code:           string;
  title:          string;
  departmentId:   string;
  departmentName: string;
  level:          string;
  minSalary?:     number | null;
  maxSalary?:     number | null;
  headCount:      number;
  isActive:       boolean;
}
