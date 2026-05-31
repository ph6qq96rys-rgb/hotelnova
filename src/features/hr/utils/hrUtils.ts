// src/features/hr/utils/hrUtils.ts

import type {
  EmploymentStatus, PayrollRunStatus, LeaveRequestStatus,
  ApplicationStatus, ReviewStatus, EnrollmentStatus,
  AttendanceStatus, JobPostingStatus, CycleStatus,
} from '../types';

// ── Date / Number formatters ──────────────────────────────────────────────────

export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function fmtTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function fmtMoney(v?: number | null): string {
  return 'ETB ' + Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function fmtNumber(v?: number | null, decimals = 2): string {
  return Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
}

export function fmtPercent(v?: number | null): string {
  return `${Number(v ?? 0).toFixed(1)}%`;
}

export function getApiError(e: unknown, fallback: string): string {
  const err = e as any;
  const data = err?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message ?? data?.title ?? err?.message ?? fallback;
}

// ── Badge class maps ──────────────────────────────────────────────────────────

export const EMPLOYMENT_STATUS_CLASS: Record<EmploymentStatus, string> = {
  Probation:  'badge badge-warn',
  Active:     'badge badge-success',
  Suspended:  'badge badge-danger',
  OnLeave:    'badge badge-info',
  Terminated: 'badge badge-neutral',
};

export const PAYROLL_STATUS_CLASS: Record<PayrollRunStatus, string> = {
  Draft:      'badge badge-neutral',
  Processing: 'badge badge-info',
  Pending:    'badge badge-warn',
  Approved:   'badge badge-success',
  Paid:       'badge badge-success',
  Cancelled:  'badge badge-danger',
};

export const LEAVE_STATUS_CLASS: Record<LeaveRequestStatus, string> = {
  Draft:     'badge badge-neutral',
  Pending:   'badge badge-warn',
  Approved:  'badge badge-success',
  Rejected:  'badge badge-danger',
  Cancelled: 'badge badge-neutral',
  Taken:     'badge badge-info',
};

export const APPLICATION_STATUS_CLASS: Record<ApplicationStatus, string> = {
  New:        'badge badge-neutral',
  Screening:  'badge badge-info',
  Shortlisted:'badge badge-warn',
  Interview:  'badge badge-info',
  Assessment: 'badge badge-warn',
  Offered:    'badge badge-success',
  Hired:      'badge badge-success',
  Rejected:   'badge badge-danger',
  Withdrawn:  'badge badge-neutral',
};

export const REVIEW_STATUS_CLASS: Record<ReviewStatus, string> = {
  NotStarted:     'badge badge-neutral',
  SelfReview:     'badge badge-info',
  ManagerReview:  'badge badge-warn',
  Calibration:    'badge badge-warn',
  Completed:      'badge badge-success',
};

export const ENROLLMENT_STATUS_CLASS: Record<EnrollmentStatus, string> = {
  Enrolled:   'badge badge-info',
  WaitListed: 'badge badge-warn',
  InProgress: 'badge badge-info',
  Completed:  'badge badge-success',
  Failed:     'badge badge-danger',
  Cancelled:  'badge badge-neutral',
  NoShow:     'badge badge-danger',
};

export const ATTENDANCE_STATUS_CLASS: Record<AttendanceStatus, string> = {
  Present:  'badge badge-success',
  Absent:   'badge badge-danger',
  Late:     'badge badge-warn',
  HalfDay:  'badge badge-info',
  OnLeave:  'badge badge-info',
  Holiday:  'badge badge-neutral',
  WeekOff:  'badge badge-neutral',
};

export const JOB_STATUS_CLASS: Record<JobPostingStatus, string> = {
  Draft:          'badge badge-neutral',
  PendingApproval:'badge badge-warn',
  Published:      'badge badge-success',
  Closed:         'badge badge-neutral',
  OnHold:         'badge badge-warn',
  Cancelled:      'badge badge-danger',
};

export const CYCLE_STATUS_CLASS: Record<CycleStatus, string> = {
  Draft:    'badge badge-neutral',
  Active:   'badge badge-success',
  Closed:   'badge badge-info',
  Archived: 'badge badge-neutral',
};

// ── Rating label helpers ──────────────────────────────────────────────────────

export function ratingColor(rating?: number | null): string {
  if (!rating) return 'var(--text-muted)';
  if (rating >= 4.5) return 'var(--success)';
  if (rating >= 3.5) return 'var(--accent)';
  if (rating >= 2.5) return 'var(--warn)';
  return 'var(--danger)';
}

export function ratingLabel(rating?: number | null): string {
  if (!rating) return '—';
  if (rating >= 4.5) return 'Exceptional';
  if (rating >= 3.5) return 'Exceeds Expectations';
  if (rating >= 2.5) return 'Meets Expectations';
  if (rating >= 1.5) return 'Needs Improvement';
  return 'Unsatisfactory';
}
