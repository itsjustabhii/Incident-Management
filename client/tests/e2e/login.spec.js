/**
 * @file E2E smoke test — Login flow
 * @description Verifies that a user can log in with valid credentials and
 * is redirected to the dashboard.
 */

import { test, expect } from '@playwright/test';

test('should login with valid credentials and show dashboard', async ({ page }) => {
  await page.goto('/login');

  // Fill in the login form using the seeded demo account
  await page.getByLabel('Email address').fill('engineer@incidenthub.dev');
  await page.getByLabel('Password').fill('Engineer1234!');

  await page.getByRole('button', { name: 'Sign In' }).click();

  // After login, expect to be on the dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Dashboard')).toBeVisible();
});

test('should show error with invalid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('nobody@example.com');
  await page.getByLabel('Password').fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
});

test('should redirect unauthenticated users to login', async ({ page }) => {
  // Attempt to access a protected route directly
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
