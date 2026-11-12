import { test, expect } from '@playwright/test';
import { seedWorkspaceAuth, TEST_COMPANY_ID } from '../fixtures/auth';

const program = { id: 'p1', code: 'ONB-WAITER-V1', title: 'Waiter onboarding', durationHours: 4, mode: 'Blended', category: 'Onboarding', isActive: true, isMandatory: false };
const detail = { programId: 'p1', objectives: 'Safe guest service', curriculum: { code: program.code, role: 'Waiter', version: '1', passScore: 80, requiredObservedShifts: 2,
  lessons: [{ id: 'foundation', title: 'Safe service foundation', minutes: 60, content: ['Confirm allergens before service.'], exercise: 'Practise a guest handover.' }],
  criticalChecks: ['Allergens checked'], questions: [{ question: 'Who approves a refund?', answer: 'An authorized supervisor.' }] }, sessions: [] };

test('Installation is repeatable and opens the company programme', async ({ page }) => {
  await seedWorkspaceAuth(page, ['hr.training.view', 'hr.training.manage']);
  let installed = false;
  await page.route('**/api/companies/*/hr/training/programs?*', r => r.fulfill({ json: installed ? [program] : [] }));
  await page.route('**/api/companies/*/hr/training/compliance-report*', r => r.fulfill({ json: [] }));
  await page.route('**/api/companies/*/hr/training/onboarding/install', r => { const added = installed ? 0 : 4; installed = true; return r.fulfill({ json: { added } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/training`);
  await page.getByRole('button', { name: 'Add staff onboarding tracks' }).click();
  await expect(page.getByRole('status')).toContainText('Added 4 onboarding tracks');
  await page.getByRole('button', { name: 'Add staff onboarding tracks' }).click();
  await expect(page.getByRole('status')).toHaveText('All four onboarding tracks are already available.');
});

test('Assessment sends evidence and renders a server validation error', async ({ page }) => {
  await seedWorkspaceAuth(page, ['hr.training.view', 'hr.training.manage']);
  await page.route('**/api/companies/*/hr/training/programs?*', r => r.fulfill({ json: [program] }));
  await page.route('**/api/companies/*/hr/training/programs/p1?*', r => r.fulfill({ json: { ...detail, sessions: [{ id: 's1', sessionNo: 'TRS-001', startDate: '2026-11-01', endDate: '2026-11-01', startTime: '09:00:00', endTime: '13:00:00', status: 'Scheduled', enrolledCount: 1, maxEnrollment: 20, enrollments: [{ id: 'e1', employeeName: 'Sara', status: 'Enrolled' }] }] } }));
  let payload: any;
  await page.route('**/api/companies/*/hr/training/enrollments/e1/complete', r => { payload = r.request().postDataJSON(); return r.fulfill({ status: 400, json: { success: false, error: 'Two observed shifts are required.' } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/training/programs/p1`);
  await page.getByRole('button', { name: 'Sessions and progress' }).click();
  await page.getByRole('button', { name: 'Assess Sara' }).click();
  await page.getByLabel('Knowledge score out of 100').fill('80');
  await page.getByLabel('Supervisor evidence and coaching notes').fill('Demonstrated service handover.');
  await page.getByRole('button', { name: 'Record assessment' }).click();
  await expect(page.getByRole('alert')).toContainText('Two observed shifts are required.');
  expect(payload).toMatchObject({ passed: true, score: 80, attendancePercent: 100, observedShiftDates: [] });
});

test('A supervisor can read the curriculum and schedule with the API date and time contract', async ({ page }) => {
  await seedWorkspaceAuth(page, ['hr.training.view', 'hr.training.manage']);
  await page.route('**/api/companies/*/hr/training/programs?*', r => r.fulfill({ json: [program] }));
  await page.route('**/api/companies/*/hr/training/programs/p1?*', r => r.fulfill({ json: detail }));
  let payload: any;
  await page.route('**/api/companies/*/hr/training/sessions', r => { payload = r.request().postDataJSON(); return r.fulfill({ json: { success: true } }); });
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/training/programs/p1`);
  await expect(page.getByRole('heading', { name: 'Waiter onboarding' })).toBeVisible();
  await expect(page.getByText('Confirm allergens before service.')).toBeVisible();
  await page.getByRole('button', { name: 'Schedule session', exact: true }).click();
  const form = page.getByRole('form', { name: 'Schedule training session' });
  await form.getByLabel('Date', { exact: true }).fill('2026-11-20');
  await form.getByLabel('Trainer', { exact: true }).fill('Service supervisor');
  await form.getByLabel('Branch and venue').fill('Head Office training room');
  await form.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Session scheduled. Assign the employees who need this training.')).toBeVisible();
  expect(payload).toMatchObject({ programId: 'p1', startDate: '2026-11-20', endDate: '2026-11-20', startTime: '09:00:00', endTime: '13:00:00', maxEnrollment: 20 });
});

test('A training viewer can read lessons without supervisor actions', async ({ page }) => {
  await seedWorkspaceAuth(page, ['hr.training.view'], []);
  await page.route('**/api/companies/*/hr/training/programs?*', r => r.fulfill({ json: [program] }));
  await page.route('**/api/companies/*/hr/training/programs/p1?*', r => r.fulfill({ json: detail }));
  await page.goto(`/companies/${TEST_COMPANY_ID}/hr/training/programs/p1`);
  await expect(page.getByText('Confirm allergens before service.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schedule session', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sessions and progress' }).click();
  await expect(page.getByRole('button', { name: 'Enroll employee', exact: true })).toHaveCount(0);
});

