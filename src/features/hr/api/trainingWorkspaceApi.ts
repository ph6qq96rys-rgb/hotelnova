import { http } from '../../../api/http';

export interface OnboardingCurriculum {
  code: string; role: string; title: string; objectives: string; version: string;
  passScore: number; requiredObservedShifts: number;
  lessons: { id: string; title: string; minutes: number; content: string[]; exercise: string }[];
  criticalChecks: string[]; questions: { question: string; answer: string }[];
  criticalCheckIds?: string[];
}
export interface TrainingEnrollmentRow {
  id: string; employeeId: string; employeeName: string; status: string;
  attendancePercent?: number; score?: number; passed?: boolean; feedback?: string; completedAt?: string;
}
export interface TrainingWorkspace {
  programId: string; description?: string; objectives?: string; curriculum?: OnboardingCurriculum;
  sessions: { id: string; sessionNo: string; startDate: string; endDate: string; startTime: string; endTime: string;
    location?: string; meetingLink?: string; trainerName?: string; maxEnrollment: number; enrolledCount: number; status: string;
    enrollments: TrainingEnrollmentRow[] }[];
}
export interface TrainingCandidate { id: string; name: string; employeeNo: string; branchId?: string }
const base = (c: string) => `/api/companies/${c}/hr/training`;
export const trainingWorkspaceApi = {
  install: (c: string) => http.post<{ added: number }>(`${base(c)}/onboarding/install`).then(r => r.data),
  get: (c: string, p: string, language = 'en') => http.get<TrainingWorkspace>(`${base(c)}/programs/${p}`, { params: { language } }).then(r => r.data),
  installOnline: (c: string) => http.post<{ added: number; roles: number; unmatched: string[] }>(`${base(c)}/online/install`).then(r => r.data),
  assignRoles: (c: string) => http.post<{ added: number }>(`${base(c)}/online/assign-roles`).then(r => r.data),
  candidates: (c: string, search: string) => http.get<TrainingCandidate[]>(`${base(c)}/enrollment-candidates`, { params: { search } }).then(r => r.data),
};

export interface LearningDetail {
  id: string; employeeName: string; code: string; title: string; curriculum?: OnboardingCurriculum; status: string;
  meetingLink?: string; startDate: string; endDate: string; canEdit: boolean; assisted: boolean;
  progress?: { lessonIds: string[]; evidence?: string; version: string; updatedAtUtc: string; assisted: boolean };
}
export const onlineTrainingApi = {
  mine: (c: string, language: string) => http.get<{ linked: boolean; courses: { id: string; code: string; title: string; status: string; endDate: string; score?: number; passed?: boolean }[] }>(`${base(c)}/my-learning`, { params: { language } }).then(r => r.data),
  detail: (c: string, id: string, language: string) => http.get<LearningDetail>(`${base(c)}/learning/${id}`, { params: { language } }).then(r => r.data),
  save: (c: string, id: string, body: { lessonIds: string[]; evidence: string; version?: string }) => http.put<{ message: string }>(`${base(c)}/learning/${id}`, body).then(r => r.data),
};
