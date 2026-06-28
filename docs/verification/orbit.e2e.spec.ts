import { test, expect } from 'playwright/test';

test('orbit career tracker end-to-end flow', async ({ page }) => {
  const email = `orbit-${Date.now()}@example.com`;

  await page.goto('http://127.0.0.1:5174');
  await expect(page.getByText('Career operating system')).toBeVisible();

  await page.getByPlaceholder('Full name').fill('Gokhan Candidate');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('Password123');
  await page.getByRole('button', { name: 'Launch tracker' }).click();

  await expect(page.getByText('Stay intentional, Gokhan')).toBeVisible();
  await expect(page.getByText('Career command center')).toBeVisible();

  await page.getByPlaceholder('Company').fill('GitHub');
  await page.getByPlaceholder('Role').fill('Frontend Engineer');
  await page.getByPlaceholder('Location').fill('Remote');
  await page.getByPlaceholder('Salary band').fill('$135k-$165k');
  await page.getByPlaceholder('Source').fill('Referral');
  await page.getByRole('button', { name: 'Add application' }).click();

  await expect(page.getByText('GitHub · Frontend Engineer')).toBeVisible();

  await page.locator('select').selectOption({ label: 'GitHub · Frontend Engineer' });
  await page.getByPlaceholder('Interview type').fill('Panel');
  await page.getByPlaceholder('Scheduled at').fill('2026-07-03 16:30');
  await page.getByPlaceholder('Prep note').fill('Algorithms + product collaboration');
  await page.getByRole('button', { name: 'Schedule interview' }).click();

  await expect(page.getByText('Panel · 2026-07-03 16:30')).toBeVisible();
  await expect(page.getByText('Algorithms + product collaboration')).toBeVisible();
  await expect(page.getByText('Interviewing')).toBeVisible();

  await page.screenshot({ path: '/Users/gokhansigircik/dev/open-source-suite/orbit-career-tracker/docs/verification/orbit-dashboard-e2e.png', fullPage: true });
});
