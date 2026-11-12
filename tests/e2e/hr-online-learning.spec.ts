import { test, expect } from '@playwright/test';
import { seedWorkspaceAuth, TEST_COMPANY_ID } from '../fixtures/auth';

for (const assisted of [false, true]) {
  test(`Online learning records named employee progress (${assisted ? 'assisted tablet' : 'personal phone'})`, async ({ page }) => {
    await seedWorkspaceAuth(page, assisted ? ['hr.training.manage'] : [], []);
    await page.setViewportSize(assisted ? { width: 1024, height: 768 } : { width: 390, height: 844 });
    let saved: any;
    await page.route('**/api/companies/*/hr/training/learning/e1*', async route => {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { message: 'Learning progress saved. Supervisor assessment is still required.' } });
      }
      return route.fulfill({ json: { id: 'e1', employeeName: 'Sara Test', code: 'ONL-058-V1', status: 'Enrolled', assisted, canEdit: true,
        curriculum: { title: 'Waiter online training', lessons: [{ id: 'foundation', title: 'Safe service foundation', minutes: 30, content: ['Verify the guest order.'], exercise: 'Explain your check.' }], questions: [], criticalChecks: [] },
        progress: saved ? { ...saved, version: 'v2' } : null } });
    });
    await page.goto(`/companies/${TEST_COMPANY_ID}/hr/my-training/e1`);
    await expect(page.getByRole('heading', { name: 'Sara Test' })).toBeVisible();
    if (assisted) await expect(page.getByText('Assisted learning:', { exact: false })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Safe service foundation' }).check();
    await page.getByLabel('Practice evidence or help needed (optional)').fill('በቃል ተወያይተናል');
    await page.getByRole('button', { name: 'Save learning progress' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Learning progress saved.' })).toContainText('Supervisor assessment is still required.');
    expect(saved.lessonIds).toEqual(['foundation']);
    expect(saved.evidence).toBe('በቃል ተወያይተናል');
    expect(saved).not.toHaveProperty('passed');
    await expect(page.getByRole('button', { name: 'Record assessment' })).toHaveCount(0);
    await page.getByRole('button', { name: 'አማርኛ', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'የእኔ የመስመር ላይ ሥልጠና' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'የመማር እድገትን አስቀምጥ' })).toBeVisible();
  });
}
